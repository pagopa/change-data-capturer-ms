import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import { Collection, MongoClient } from "mongodb";
import { ContinuationTokenItem } from "../capturer/cosmos/utils";
import {
  setMongoListenerOnEventChange,
  watchMongoCollection,
} from "../capturer/mongo/mongo";
import { mongoDBService } from "./mongoDBService";
import { ICDCService } from "./service";

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
        E.Do,
        E.bind("database", () =>
          mongoDBServiceClient.getDatabase(client, database),
        ),
        TE.fromEither,
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
            O.fold(
              () => TE.fromEither(watchChangeFeed(collection)),
              (token) =>
                pipe(token as ContinuationTokenItem, (leaseToken) =>
                  TE.fromEither(watchChangeFeed(collection, leaseToken.lease)),
                ),
            ),
          ),
        ),
        TE.map(constVoid),
      ),
} satisfies ICDCService;

export const watchChangeFeed = (
  collection: Collection,
  resumeToken?: string,
): E.Either<Error, void> =>
  pipe(
    watchMongoCollection(collection, resumeToken),
    E.chain((watcher) => setMongoListenerOnEventChange(watcher, (_) => void 0)),
  );
