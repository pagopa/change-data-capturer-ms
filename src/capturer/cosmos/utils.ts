import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import * as T from "io-ts";

const ContinuationTokenItem = T.type({
  id: T.string,
  lease: T.string,
});

export type ContinuationTokenItem = T.TypeOf<typeof ContinuationTokenItem>;
export const cosmosConnect = (
  endpoint: string,
  key: string
): E.Either<Error, CosmosClient> =>
  pipe(
    E.tryCatch(
      () => new CosmosClient({ endpoint, key }),
      (reason) =>
        new Error(`Impossible to connect to Cosmos: " ${String(reason)}`)
    )
  );

export const getDatabase = (
  client: CosmosClient,
  databaseName: string
): E.Either<Error, Database> =>
  pipe(
    E.tryCatch(
      () => client.database(databaseName),
      (reason) =>
        new Error(
          `Impossible to get database ${databaseName}: ${String(reason)}`
        )
    )
  );

export const getContainer = (
  database: Database,
  containerName: string
): TE.TaskEither<Error, Container> =>
  pipe(
    E.tryCatch(
      () => database.container(containerName),
      (reason) =>
        new Error(
          `Impossible to get container ${containerName}: ${String(reason)}`
        )
    ),
    TE.fromEither
  );

export const upsertItem = <T>(
  container: Container,
  item: T
): TE.TaskEither<Error, void> =>
  pipe(
    TE.tryCatch(() => container.items.upsert(item), E.toError),
    TE.map(constVoid)
  );

export const getItemByID = (
  container: Container,
  id: string
): TE.TaskEither<Error, O.Option<ContinuationTokenItem>> =>
  pipe(
    TE.tryCatch(
      () => container.item(id, id).read(),
      (reason) =>
        new Error(
          `Impossible to get item ${id} from container ${
            container.id
          }: ${String(reason)}`
        )
    ),
    TE.map((resp) =>
      pipe(resp.resource, ContinuationTokenItem.decode, O.fromEither)
    )
  );
