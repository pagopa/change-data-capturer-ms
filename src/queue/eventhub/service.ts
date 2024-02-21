import { KafkaProducerCompact } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as E from "fp-ts/Either";

import { pipe } from "fp-ts/lib/function";
import { IQueueService } from "../factory";
import {
  fromSasPlain,
  getEventHubProducer,
  getNativeEventHubProducer,
  sendMessageEventHub,
  sendMessageNativeEventHub,
} from "./utils";

export type QueueProducer<T> = KafkaProducerCompact<T>;

export const createNativeEventHubService = (
  connectionString: string,
): E.Either<Error, IQueueService> =>
  pipe(
    getNativeEventHubProducer(connectionString),
    E.map((producer) => ({
      produce: sendMessageNativeEventHub(producer),
    })),
  );

export const createKafkaService = (
  connectionString: string,
): E.Either<Error, IQueueService> =>
  pipe(
    getEventHubProducer(connectionString),
    E.map((producer) => ({
      produce: sendMessageEventHub(producer),
    })),
  );

export const createPlainEventHubService = (
  broker: string,
  clientId: string,
  topic: string,
): E.Either<Error, IQueueService> =>
  pipe(
    E.tryCatch(() => fromSasPlain(broker, clientId, topic), E.toError),
    E.map((producer) => ({
      produce: sendMessageEventHub(producer),
    })),
  );
