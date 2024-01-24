/* eslint-disable max-params */
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
  Db,
  MongoClient,
} from "mongodb";
import { IOpts } from "../capturer/cosmos/cosmos";
import {
  setMongoListenerOnEventChange,
  watchMongoCollection,
} from "../capturer/mongo/mongo";
import {
  getOrCreateMongoCollection,
  insertDocument,
} from "../capturer/mongo/utils";
import { mongoDBService } from "./mongoDBService";
import { ICDCService } from "./service";
import { ProcessResult } from "./types";

export const MONGO_LEASE_COLLECTION_NAME = "cdc-data-lease";

const extractResultsFromChange = <T = Document>(
  change: ChangeStreamDocument<T>,
): ReadonlyArray<unknown> =>
  // switch (change?.operationType) {
  //   case "insert":
  //     return [{ data: change.fullDocument, operationType: "insert" }];
  //   case "update":
  //     return [{ data: change.fullDocument, operationType: "update" }];
  //   case "delete":
  //     return [{ data: change.documentKey, operationType: "delete" }];
  //   default:
  //     throw new Error(`Unsupported operation type: ${change.operationType}`);
  // }
  [{ data: change as ChangeStreamInsertDocument<T>, operationType: "insert" }];
const adaptProcessResults =
  (
    processResults: ProcessResult,
    leaseCollection: Collection,
    collection: Collection,
  ): (<T = Document>(change: ChangeStreamDocument<T>) => void) =>
  async (change) => {
    await pipe(
      change,
      extractResultsFromChange,
      processResults,
      TE.chain(() =>
        insertDocument(leaseCollection, {
          id: collection.collectionName,
          // eslint-disable-next-line no-underscore-dangle
          lease: change._id,
        }),
      ),
    )();
  };

export const watchChangeFeed = (
  collection: Collection,
  processResults: ProcessResult,
  leaseCollection: Collection,
  resumeToken?: string,
  opts?: IOpts,
): E.Either<Error, void> =>
  pipe(
    watchMongoCollection(collection, resumeToken, opts),
    E.chain((watcher) =>
      setMongoListenerOnEventChange(
        watcher,
        adaptProcessResults(processResults, leaseCollection, collection),
      ),
    ),
    E.map(constVoid),
  );

export const mongoCDCService = {
  processChangeFeed:
    (
      client: MongoClient,
      databaseName: string,
      resourceName: string,
      processResults: ProcessResult,
      leaseResourceName?: string,
      opts?: IOpts,
    ) =>
    (mongoDBServiceClient: typeof mongoDBService): TaskEither<Error, void> =>
      pipe(
        TE.Do,
        TE.bind("database", () =>
          mongoDBServiceClient.getDatabase(client, databaseName),
        ),
        TE.bind("collection", ({ database }) =>
          mongoDBServiceClient.getResource(database, resourceName),
        ),
        // Checking that the lease collection {leaseResourceName} exists
        // If not, a default lease container will be created in the next steps
        TE.bind("leaseCollection", ({ database }) =>
          pipe(
            O.fromNullable(leaseResourceName),
            O.fold(
              () => TE.right(O.none),
              (lease) =>
                pipe(
                  mongoDBServiceClient.getResource(database, lease),
                  TE.map(O.some),
                ),
            ),
          ),
        ),
        // Checking from the lease container {leaseResourceName that there is a continuationToken stored
        TE.bind("continuationToken", ({ leaseCollection }) =>
          pipe(
            leaseCollection,
            O.fold(
              () => TE.right(O.none),
              (container) =>
                pipe(
                  O.fromNullable(opts),
                  O.chainNullableK((options) => options.prefix),
                  O.fold(
                    () => TE.right(O.none),
                    (id) => mongoDBServiceClient.getItemByID(container, id),
                  ),
                ),
            ),
          ),
        ),
        TE.chain(
          ({ collection, continuationToken, leaseCollection, database }) =>
            pipe(
              leaseCollection,
              O.fold(
                () =>
                  getOrCreateMongoCollection(
                    database as Db,
                    MONGO_LEASE_COLLECTION_NAME,
                  ),
                (lContainer) => TE.right(lContainer),
              ),
              TE.chain((lContainer) =>
                pipe(
                  watchChangeFeed(
                    collection as Collection,
                    processResults,
                    lContainer as Collection,
                    pipe(
                      continuationToken,
                      O.map((token) => token.lease),
                      O.toUndefined,
                    ),
                    opts,
                  ),
                  TE.fromEither,
                ),
              ),
            ),
        ),
        TE.map(constVoid),
      ),
} satisfies ICDCService;
