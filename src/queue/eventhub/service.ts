import { KafkaProducerCompact } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";

import { pipe } from "fp-ts/lib/function";
import { getEventHubProducer, sendMessageEventHub } from "./utils";

export type QueueProducer<T> = KafkaProducerCompact<T>;
export interface IQueueService {
  readonly produce: <T>(
    messages: ReadonlyArray<T>,
  ) => TE.TaskEither<Error, void>;
}

export const eventHubService = {
  produce: sendMessageEventHub,
};

export const createEventHubService = (
  connectionString: string,
): E.Either<Error, IQueueService> =>
  pipe(
    getEventHubProducer(connectionString),
    E.map((producer) => ({
      produce: sendMessageEventHub(producer),
    })),
  );
