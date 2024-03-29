import {
  Container,
  CosmosClient,
  Database,
  IndexingPolicy,
} from "@azure/cosmos";
import * as RA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { upsertItem } from "../../src/capturer/cosmos/utils";

export const COSMOS_COLLECTION_NAME = "integration-collection";
export const COSMOS_LEASE_COLLECTION_NAME = "integration-lease-collection";
export const ID = Math.random().toString();
/**
 * Create DB and collections
 */
export const createCosmosDbAndCollections = (
  client: CosmosClient,
  cosmosDbName: string,
): TE.TaskEither<Error, Database> =>
  pipe(
    createDatabase(client, cosmosDbName),
    TE.chainFirst(createAllCollections),
  );

export const createDatabase = (
  client: CosmosClient,
  dbName: string,
): TE.TaskEither<Error, Database> =>
  pipe(
    TE.tryCatch(() => {
      return client.databases.createIfNotExists({ id: dbName });
    }, E.toError),
    TE.map((databaseResponse) => databaseResponse.database),
  );

export const deleteDatabase = (
  client: CosmosClient,
  dbName: string,
): TE.TaskEither<Error, Database> =>
  pipe(
    TE.tryCatch(() => {
      return client.database(dbName).delete();
    }, E.toError),
    TE.map((databaseResponse) => databaseResponse.database),
  );

export const createAllCollections = (
  database: Database,
): TE.TaskEither<Error, readonly Container[]> =>
  pipe(
    [
      pipe(
        createCollection(database, COSMOS_COLLECTION_NAME, "id"),
        TE.chainFirst((collection) => upsertItem(collection, { id: ID })),
      ),
      createCollection(database, COSMOS_LEASE_COLLECTION_NAME, "id"),
    ],
    RA.sequence(TE.ApplicativePar),
  );

export const createCollection = (
  db: Database,
  containerName: string,
  partitionKey: string,
  indexingPolicy?: IndexingPolicy,
): TE.TaskEither<Error, Container> =>
  pipe(
    TE.tryCatch(
      () =>
        db.containers.createIfNotExists({
          id: containerName,
          indexingPolicy,
          partitionKey: `/${partitionKey}`,
        }),
      E.toError,
    ),
    TE.map((containerResponse) => containerResponse.container),
  );

export const deleteCollection = (
  db: Database,
  containerName: string,
): TE.TaskEither<Error, Container> =>
  pipe(
    TE.tryCatch(() => {
      return db.container(containerName).delete();
    }, E.toError),
    TE.map((containerResponse) => containerResponse.container),
  );

export const deleteAllCollections = (
  database: Database,
): TE.TaskEither<Error, readonly Container[]> => {
  return pipe(
    database,
    TE.of,
    TE.bindTo("db"),
    TE.bind("collectionNames", ({ db }) =>
      pipe(
        TE.tryCatch(() => db.containers.readAll().fetchAll(), E.toError),
        TE.map((r) => r.resources),
        TE.map(RA.map((r) => r.id)),
      ),
    ),
    TE.chain(({ db, collectionNames }) =>
      pipe(
        collectionNames,
        RA.map((r) => deleteCollection(db, r)),
        RA.sequence(TE.ApplicativePar),
      ),
    ),
  );
};
