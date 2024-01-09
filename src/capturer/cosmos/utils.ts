import {
  Container,
  CosmosClient,
  CosmosClientOptions,
  Database,
} from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import * as T from "io-ts";

export const ContinuationTokenItem = T.type({
  id: T.string,
  lease: T.string,
});

export type ContinuationTokenItem = T.TypeOf<typeof ContinuationTokenItem>;

const cosmosConnectionRegex = (s: string): RegExpExecArray | null =>
  /AccountEndpoint=([^;]+);AccountKey=([^;]+)/.exec(s);

export const getCosmosConfig = (
  connectionString: string,
): E.Either<Error, CosmosClientOptions> =>
  pipe(
    connectionString,
    cosmosConnectionRegex,
    O.fromNullable,
    E.fromOption(
      () => "cosmos connection string does not match the expected format",
    ),
    E.mapLeft(E.toError),
    E.map((groups) => ({
      endpoint: groups[1],
      key: groups[2],
    })),
  );

export const cosmosConnect = (
  endpoint: string,
  key: string,
): E.Either<Error, CosmosClient> =>
  pipe(
    E.tryCatch(
      () => new CosmosClient({ endpoint, key }),
      (reason) =>
        new Error(`Impossible to connect to Cosmos: " ${String(reason)}`),
    ),
  );

export const getDatabase = (
  client: CosmosClient,
  databaseName: string,
): TE.TaskEither<Error, Database> =>
  pipe(
    TE.tryCatch(
      () => client.database(databaseName).read(),
      () => new Error(`Impossible to get database ${databaseName}`),
    ),
    TE.map((resp) => resp.database),
  );

export const getContainer = (
  database: Database,
  containerName: string,
): TE.TaskEither<Error, Container> =>
  pipe(
    TE.tryCatch(
      () => database.container(containerName).read(),
      () => new Error(`Impossible to get container ${containerName}`),
    ),
    TE.map((resp) => resp.container),
  );

export const createContainer = (
  database: Database,
  containerName: string,
): TE.TaskEither<Error, Container> =>
  pipe(
    TE.tryCatch(
      () => database.containers.createIfNotExists({ id: containerName }),
      () => new Error(`Impossible to create container ${containerName}`),
    ),
    TE.map((resp) => resp.container),
  );

export const upsertItem = <T>(
  container: Container,
  item: T,
): TE.TaskEither<Error, void> =>
  pipe(
    TE.tryCatch(() => container.items.upsert(item), E.toError),
    TE.map(constVoid),
  );

export const getItemByID = (
  container: Container,
  id: string,
): TE.TaskEither<Error, O.Option<ContinuationTokenItem>> =>
  pipe(
    TE.tryCatch(
      () => container.item(id, id).read(),
      (reason) =>
        new Error(
          `Impossible to get item ${id} from container ${
            container.id
          }: ${String(reason)}`,
        ),
    ),
    TE.map((resp) =>
      pipe(resp.resource, ContinuationTokenItem.decode, O.fromEither),
    ),
  );
