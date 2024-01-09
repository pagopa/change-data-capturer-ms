/* eslint-disable @typescript-eslint/no-shadow */
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { constVoid, flow, pipe } from "fp-ts/lib/function";
import { Collection, MongoClient } from "mongodb";
import { ContinuationTokenItem } from "../capturer/cosmos/utils";
import {
  setMongoListenerOnEventChange,
  watchMongoCollection,
} from "../capturer/mongo/mongo";
import { mongoDBService } from "./mongoDBService";
import { ICDCService } from "./service";

export const watchChangeFeed = (
  collection: Collection,
  resumeToken?: string,
): E.Either<Error, void> =>
  pipe(
    watchMongoCollection(collection, resumeToken),
    E.chain((watcher) => setMongoListenerOnEventChange(watcher, (_) => void 0)),
  );

export const mongoCDCService = {
  processChangeFeed:
    (
      client: MongoClient,
      database: string,
      resource: string,
      leaseResource?: string,
      prefix?: string,
    ) =>
    (mongoDBServiceClient: typeof mongoDBService): TaskEither<Error, void> =>
      pipe(
        TE.Do,
        TE.bind("database", () =>
          mongoDBServiceClient.getDatabase(client, database),
        ),
        TE.bind("collection", ({ database }) =>
          mongoDBServiceClient.getResource(database, resource),
        ),
        TE.bind("leaseCollection", ({ database }) =>
          mongoDBServiceClient.getResource(database, leaseResource),
        ),
        TE.bind("leaseDocument", ({ leaseCollection }) =>
          mongoDBServiceClient.getItemByID(leaseCollection, prefix),
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
            (lease) => TE.fromEither(watchChangeFeed(collection, lease)),
          ),
        ),
        TE.map(constVoid),
      ),
} satisfies ICDCService;
