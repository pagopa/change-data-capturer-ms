import * as AR from "fp-ts/Array";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import {
  Collection,
  Db,
  Document,
  InsertOneResult,
  MongoClient,
  OptionalUnlessRequiredId,
} from "mongodb";

export const mongoConnect = (uri: string): TE.TaskEither<Error, MongoClient> =>
  TE.tryCatch(
    () => MongoClient.connect(uri),
    (reason) =>
      new Error(`Impossible to connect to MongoDB: ${String(reason)}`),
  );

export const getMongoDb = (
  client: MongoClient,
  dbName: string,
): TE.TaskEither<Error, Db> =>
  TE.tryCatch(
    () => Promise.resolve(client.db(dbName)),
    () => new Error(`Impossible to Get the ${dbName} db`),
  );

export const getMongoCollection = <T = Document>(
  db: Db,
  collectionName: string,
): TE.TaskEither<Error, Collection<T>> =>
  pipe(
    TE.tryCatch(
      () => db.listCollections({ name: collectionName }).toArray(),
      () => new Error(`Impossible to Get the ${collectionName} collection`),
    ),
    TE.map(AR.head),
    TE.chain(
      TE.fromOption(() =>
        Error(`Collection ${collectionName} does not exists`),
      ),
    ),
    TE.map(() => db.collection(collectionName)),
  );

export const getOrCreateMongoCollection = <T extends Document>(
  db: Db,
  collectionName: string,
): TE.TaskEither<Error, Collection<T>> =>
  pipe(
    TE.tryCatch(
      () => db.listCollections({ name: collectionName }).toArray(),
      // eslint-disable-next-line sonarjs/no-identical-functions
      () => new Error(`Impossible to Get the ${collectionName} collection`),
    ),
    TE.map(AR.head),
    TE.chain(
      flow(
        O.map(() => TE.of(db.collection<T>(collectionName))),
        O.getOrElse(() =>
          TE.tryCatch(() => db.createCollection(collectionName), E.toError),
        ),
      ),
    ),
  );

export const disconnectMongo = (
  client: MongoClient,
): TE.TaskEither<Error, void> =>
  TE.tryCatch(
    () => client.close(),
    () => new Error(`Impossible to disconnect the mongo client`),
  );

export const findDocumentByID = (
  collection: Collection,
  id: string,
): TE.TaskEither<Error, O.Option<Document>> =>
  pipe(
    TE.tryCatch(
      async () => {
        const query = { id };
        return collection.findOne(query);
      },
      () =>
        new Error(
          `Unable to get the the document with ID ${id} from collection ${collection.namespace}`,
        ),
    ),
    TE.map(O.fromNullable),
  );

export const insertDocument = <T>(
  collection: Collection<T>,
  doc: OptionalUnlessRequiredId<T>,
): TE.TaskEither<Error, InsertOneResult<T>> =>
  TE.tryCatch(
    () => collection.insertOne(doc),
    () => new Error(`Unable to insert the document`),
  );
