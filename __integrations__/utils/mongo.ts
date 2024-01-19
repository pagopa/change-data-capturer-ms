import * as RA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { Collection, Db, MongoClient } from "mongodb";
import { insertDocument } from "../../src/capturer/mongo/utils";

export const MONGO_COLLECTION_NAME = "integration-collection";
export const MONGO_LEASE_COLLECTION_NAME = "integration-lease-collection";
export const ID = Math.random().toString();

export const createMongoClient = (
  connectionString: string,
): TE.TaskEither<Error, MongoClient> =>
  pipe(
    E.tryCatch(() => new MongoClient(connectionString), E.toError),
    TE.fromEither,
  );

export const createMongoDBAndCollections = (
  client: MongoClient,
  dbName: string,
): TE.TaskEither<Error, Db> =>
  pipe(createDatabase(client, dbName), TE.chainFirst(createAllCollections));

export const createDatabase = (
  client: MongoClient,
  dbName: string,
): TE.TaskEither<Error, Db> =>
  pipe(
    E.tryCatch(() => client.db(dbName), E.toError),
    TE.fromEither,
  );

export const deleteDatabase = (
  client: MongoClient,
  dbName: string,
): TE.TaskEither<Error, boolean> =>
  pipe(
    TE.tryCatch(() => {
      return client.db(dbName).dropDatabase();
    }, E.toError),
  );

export const createAllCollections = (
  database: Db,
): TE.TaskEither<Error, readonly Collection[]> =>
  pipe(
    [
      pipe(
        createCollection(database, MONGO_COLLECTION_NAME),
        TE.chainFirst((collection) => insertDocument(collection, { id: ID })),
      ),
      createCollection(database, MONGO_LEASE_COLLECTION_NAME),
    ],
    RA.sequence(TE.ApplicativePar),
  );

export const createCollection = (
  db: Db,
  containerName: string,
): TE.TaskEither<Error, Collection> =>
  pipe(TE.tryCatch(() => db.createCollection(containerName, {}), E.toError));
