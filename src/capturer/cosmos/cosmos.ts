/* eslint-disable sonarjs/no-use-of-empty-return-value */
import {
  ChangeFeedIteratorOptions,
  ChangeFeedStartFrom,
  Container,
  StatusCodes,
} from "@azure/cosmos";
import { KafkaProducerCompact } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as B from "fp-ts/boolean";
import { constVoid, pipe } from "fp-ts/lib/function";
import { sendMessageEventHub } from "../../queue/eventhub/utils";
import { ContinuationTokenItem, upsertItem } from "./utils";

export const getChangeFeedIteratorOptions = (
  continuationToken?: string,
  maxItemCount?: number,
): ChangeFeedIteratorOptions => ({
  changeFeedStartFrom: continuationToken
    ? ChangeFeedStartFrom.Continuation(continuationToken)
    : ChangeFeedStartFrom.Beginning(),
  maxItemCount: maxItemCount && maxItemCount > 0 ? maxItemCount : 1,
});

const generateCustomId = (id: string, prefix?: string): string => {
  const modifiedPrefix = prefix ? prefix.replace(" ", "-") : "";
  const modifiedId = id.replace(" ", "-");

  return `${modifiedPrefix}${modifiedId}`;
};

const processResult = <T>(
  mqueueClient: KafkaProducerCompact<T>,
  results: ReadonlyArray<T>,
): TE.TaskEither<Error, void> =>
  pipe(results, sendMessageEventHub<T>(mqueueClient));

export const processChangeFeed = (
  changeFeedContainer: Container,
  changeFeedIteratorOptions: ChangeFeedIteratorOptions,
  leaseContainer: Container,
  mqueueClient: KafkaProducerCompact<unknown>,
  prefix?: string,
): TE.TaskEither<Error, void> =>
  TE.tryCatch(async () => {
    const changeFeedIterator = changeFeedContainer.items.getChangeFeedIterator(
      changeFeedIteratorOptions,
    );

    for await (const result of changeFeedIterator.getAsyncIterator()) {
      pipe(
        result.statusCode === StatusCodes.NotModified,
        B.fold(
          // If the status code is NotModified, process the document by
          // sending it to the queue (or any other processing logic).
          // TODO implement a generic logic to process the document
          () =>
            pipe(
              processResult(mqueueClient, result.result),
              TE.map(() =>
                upsertItem<ContinuationTokenItem>(leaseContainer, {
                  id: generateCustomId(changeFeedContainer.id, prefix),
                  lease: result.continuationToken,
                } as ContinuationTokenItem),
              ),
            ),
          () => constVoid,
        ),
      );
    }
  }, E.toError);
