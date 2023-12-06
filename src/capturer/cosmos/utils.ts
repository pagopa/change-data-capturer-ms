import {
  Container,
  CosmosClient,
  ItemDefinition,
  ItemResponse,
} from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

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

export const upsertItem = <T>(
  container: Container,
  item: T
): TE.TaskEither<Error, ItemResponse<ItemDefinition>> =>
  TE.tryCatch(() => container.items.upsert(item), E.toError);

export const getItemById = (
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
      pipe(
        resp.resource,
        ContinuationTokenItem.decode,
        E.fold(
          () => O.none,
          (v) => O.some(v)
        )
      )
    )
  );
