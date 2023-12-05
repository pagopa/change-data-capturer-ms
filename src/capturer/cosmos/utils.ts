export interface ContinuationTokenItem {
  readonly id: string;
  readonly lease: string;
}
import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

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
): E.Either<Error, Container> =>
  pipe(
    E.tryCatch(
      () => database.container(containerName),
      (reason) =>
        new Error(
          `Impossible to get container ${containerName}: ${String(reason)}`
        )
    )
  );

export const upsertItem = <T>(
  container: Container,
  item: T
): TE.TaskEither<Error, void> =>
  TE.tryCatch(async () => {
    await container.items.upsert(item);
  }, E.toError);

export const getItemById = (
  container: Container,
  id: string
): TE.TaskEither<Error, O.Option<ContinuationTokenItem>> =>
  pipe(
    TE.tryCatch(
      async () => await container.item(id, id).read(),
      (reason) =>
        new Error(
          `Impossible to get item ${id} from container ${
            container.id
          }: ${String(reason)}`
        )
    ),
    TE.map((resp) => O.fromNullable(resp.resource as ContinuationTokenItem))
  );
