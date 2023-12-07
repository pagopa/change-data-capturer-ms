import {
  ChangeFeedIteratorOptions,
  ChangeFeedStartFrom,
  Container,
  StatusCodes,
} from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as B from "fp-ts/boolean";
import { constVoid, pipe } from "fp-ts/lib/function";
import { ContinuationTokenItem, upsertItem } from "./utils";

export const getChangeFeedIteratorOptions = (
  continuationToken?: string,
  maxItemCount?: number
): ChangeFeedIteratorOptions => ({
  maxItemCount: maxItemCount && maxItemCount > 0 ? maxItemCount : 1,
  changeFeedStartFrom: continuationToken
    ? ChangeFeedStartFrom.Continuation(continuationToken)
    : ChangeFeedStartFrom.Beginning(),
});

export const processChangeFeed = (
  changeFeedContainer: Container,
  changeFeedIteratorOptions: ChangeFeedIteratorOptions,
  leaseContainer: Container
): TE.TaskEither<Error, void> =>
  TE.tryCatch(async () => {
    const changeFeedIterator = changeFeedContainer.items.getChangeFeedIterator(
      changeFeedIteratorOptions
    );
    for await (const result of changeFeedIterator.getAsyncIterator()) {
      pipe(
        result.statusCode === StatusCodes.NotModified,
        B.fold(
          // If the status code is NotModified, process the document by
          // sending it to the queue (or any other processing logic).
          // TODO implement a generic logic to process the document
          () =>
            void upsertItem<ContinuationTokenItem>(leaseContainer, {
              id: changeFeedContainer.id.replace(" ", "-"),
              lease: result.continuationToken,
            } as ContinuationTokenItem)(),
          () => TE.right(constVoid)
        )
      );
    }
  }, E.toError);
