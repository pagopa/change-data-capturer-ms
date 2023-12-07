import * as AR from "fp-ts/Array";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";
import {
  Collection,
  Db,
  Document,
  InferIdType,
  InsertOneResult,
  MongoClient,
  OptionalUnlessRequiredId,
  WithId,
} from "mongodb";

export const mongoConnect = (uri: string): TE.TaskEither<Error, MongoClient> =>
  TE.tryCatch(
    () => MongoClient.connect(uri),
    (reason) =>
      new Error(`Impossible to connect to MongoDB: " ${String(reason)}`)
  );

export const getMongoDb = (
  client: MongoClient,
  dbName: string
): E.Either<Error, Db> =>
  E.tryCatch(
    () => client.db(dbName),
    (reason) => new Error(`Impossible to Get the ${dbName} db: " ${reason}`)
  );

export const getMongoCollection = <T = Document>(
  db: Db,
  collectionName: string
): TE.TaskEither<Error, Collection<T>> =>
  pipe(
    TE.tryCatch(
      () => db.listCollections({ name: collectionName }).toArray(),
      (reason) =>
        new Error(
          `Impossible to Get the ${collectionName} collection: " ${reason}`
        )
    ),
    TE.map(AR.head),
    TE.chain(
      TE.fromOption(() => Error(`collection ${collectionName} does not exists`))
    ),
    TE.map(() => db.collection(collectionName))
  );

export const getOrCreateMongoCollection = <T extends Document>(
  db: Db,
  collectionName: string
): TE.TaskEither<Error, Collection<T>> =>
  pipe(
    TE.tryCatch(
      () => db.listCollections({ name: collectionName }).toArray(),
      // eslint-disable-next-line sonarjs/no-identical-functions
      (reason) =>
        new Error(
          `Impossible to Get the ${collectionName} collection: " ${reason}`
        )
    ),
    TE.map(AR.head),
    TE.chain(
      flow(
        O.map(() => TE.of(db.collection<T>(collectionName))),
        O.getOrElse(() =>
          TE.tryCatch(() => db.createCollection(collectionName), E.toError)
        )
      )
    )
  );

export const disconnectMongo = (
  client: MongoClient
): TE.TaskEither<Error, void> =>
  TE.tryCatch(
    () => client.close(),
    (reason) =>
      new Error(`Impossible to disconnect the mongo client: " ${reason}`)
  );

export const findLastDocument = <T>(
  collection: Collection<T>
): TE.TaskEither<Error, O.Option<T>> =>
  pipe(
    TE.tryCatch(
      () => collection.find<T>({}).sort({ _id: -1 }).limit(1).tryNext(),
      (reason) =>
        new Error(
          `Unable to get the last inserted document from collection: " ${reason}`
        )
    ),
    TE.map(O.fromNullable)
  );

export const findDocumentByID = <T>(
  collection: Collection<T>,
  id: InferIdType<T>
): TE.TaskEither<Error, WithId<T>> =>
  pipe(
    TE.tryCatch(
      () =>
        collection
          .find({
            $where() {
              // eslint-disable-next-line no-underscore-dangle
              return this._id === id;
            },
          })
          .tryNext(),
      (reason) =>
        new Error(
          `Unable to get the the document with ID ${id} from collection: " ${reason}`
        )
    )
  );

export const insertDocument = <T>(
  collection: Collection<T>,
  doc: OptionalUnlessRequiredId<T>
): TE.TaskEither<Error, InsertOneResult<T>> =>
  TE.tryCatch(
    () => collection.insertOne(doc),
    (reason) => new Error(String(reason))
  );
