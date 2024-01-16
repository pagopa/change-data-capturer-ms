import {
  ChangeFeedIteratorOptions,
  ChangeFeedStartFrom,
  Container,
  StatusCodes,
} from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as B from "fp-ts/boolean";
import { pipe } from "fp-ts/lib/function";
import { ContinuationTokenItem, ProcessResult } from "../../factory/types";
import { upsertItem } from "./utils";

/**
 * Returns the options for creating a change feed iterator.
 *
 * @param {string} continuationToken - The continuation token to start reading from.
 * @param {number} maxItemCount - The maximum number of items to return per request.
 * @return {ChangeFeedIteratorOptions} The options for creating a change feed iterator.
 */
export const getChangeFeedIteratorOptions = (
  continuationToken?: string,
  maxItemCount?: number,
): ChangeFeedIteratorOptions => ({
  changeFeedStartFrom: continuationToken
    ? ChangeFeedStartFrom.Continuation(continuationToken)
    : ChangeFeedStartFrom.Beginning(),
  maxItemCount: maxItemCount && maxItemCount > 0 ? maxItemCount : 1,
});

/**
 * Generates a custom ID by combining the given ID and prefix.
 *
 * @param {string} id - The original ID.
 * @param {string} [prefix] - The prefix to be added to the ID. Defaults to an empty string.
 * @return {string} The generated custom ID.
 */
const generateCustomId = (id: string, prefix?: string): string => {
  const modifiedPrefix = prefix ? prefix.replace(" ", "-") : "";
  const modifiedId = id.replace(" ", "-");

  return `${modifiedPrefix}${modifiedId}`;
};

// eslint-disable-next-line no-var
var shouldExitExternal = false;

export const setShouldExitExternal = (value: boolean): void => {
  shouldExitExternal = value;
};

export const processChangeFeed = (
  changeFeedContainer: Container,
  changeFeedIteratorOptions: ChangeFeedIteratorOptions,
  leaseContainer: Container,
  processResults: ProcessResult,
  prefix?: string,
): TE.TaskEither<Error, void> =>
  TE.tryCatch(async () => {
    const items = changeFeedContainer.items;
    const feedIteratorOptions = items.getChangeFeedIterator(
      changeFeedIteratorOptions,
    );

    const feedIterator = feedIteratorOptions.getAsyncIterator();
    for await (const result of feedIterator) {
      if (shouldExitExternal) {
        break;
      }
      await pipe(
        result.statusCode === StatusCodes.NotModified,
        B.fold(
          // If the status code is NotModified, process the document by
          // sending it to the queue (or any other processing logic).
          // TODO implement a generic logic to process the document
          () =>
            pipe(
              result.result,
              processResults,
              TE.chain(() =>
                upsertItem<ContinuationTokenItem>(leaseContainer, {
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  "/id": generateCustomId(changeFeedContainer.id, prefix),
                  id: generateCustomId(changeFeedContainer.id, prefix),
                  lease: result.continuationToken,
                } as ContinuationTokenItem),
              ),
              TE.mapLeft(E.toError),
            ),
          () => TE.right(void 0),
        ),
      )();
    }
  }, E.toError);
