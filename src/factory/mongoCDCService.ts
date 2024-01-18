/* eslint-disable max-params */
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { constVoid, flow, pipe } from "fp-ts/lib/function";
import { ChangeStreamDocument, Collection, MongoClient } from "mongodb";
import { IOpts } from "../capturer/cosmos/cosmos";
import {
  setMongoListenerOnEventChange,
  watchMongoCollection,
} from "../capturer/mongo/mongo";
import { mongoDBService } from "./mongoDBService";
import { ICDCService } from "./service";
import { ContinuationTokenItem, ProcessResult } from "./types";

const extractResultsFromChange = <T extends Document>(
  change: ChangeStreamDocument<T>,
): ReadonlyArray<unknown> => {
  switch (change.operationType) {
    case "insert":
      return [{ data: change.fullDocument, operationType: "insert" }];
    case "update":
      return [{ data: change.fullDocument, operationType: "update" }];
    case "delete":
      return [{ data: change.documentKey, operationType: "delete" }];
    default:
      throw new Error(`Unsupported operation type: ${change.operationType}`);
  }
};

const adaptProcessResults =
  <T extends Document>(
    processResults: ProcessResult,
  ): ((change: ChangeStreamDocument<T>) => void) =>
  async (change) => {
    const results = extractResultsFromChange(change);
    await processResults(results)();
  };

export const watchChangeFeed = (
  collection: Collection,
  processResults: ProcessResult,
  resumeToken?: string,
): E.Either<Error, void> =>
  pipe(
    watchMongoCollection(collection, resumeToken),
    E.chain((watcher) =>
      setMongoListenerOnEventChange(
        watcher,
        adaptProcessResults(processResults),
      ),
    ),
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
        TE.bind("leaseCollection", ({ database }) =>
          mongoDBServiceClient.getResource(database, leaseResourceName),
        ),
        TE.bind("leaseDocument", ({ leaseCollection }) =>
          mongoDBServiceClient.getItemByID(leaseCollection, opts?.prefix),
        ),
        TE.chain(({ collection, leaseDocument }) =>
          pipe(
            leaseDocument,
            O.map(
              flow(
                ContinuationTokenItem.decode,
                E.mapLeft((errs) => Error(String(errs.join("|")))),
                E.map((leaseToken) => leaseToken.lease),
                O.fromEither,
              ),
            ),
            O.flatten,
            O.toUndefined,
            (lease) =>
              TE.fromEither(
                watchChangeFeed(
                  collection as Collection,
                  processResults,
                  lease,
                ),
              ),
          ),
        ),
        TE.map(constVoid),
      ),
} satisfies ICDCService;
export { ProcessResult };
