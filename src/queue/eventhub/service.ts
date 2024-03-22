import { KafkaProducerCompact } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as E from "fp-ts/Either";

import { pipe } from "fp-ts/lib/function";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import {
  EvhAuthQueueParams,
  EvhPasswordLessQueueParams,
  EvhQueueParams,
  IQueueService,
} from "../factory";
import {
  fromSasPlain,
  getEventHubProducer,
  getNativeEventHubProducer,
  getPasswordLessNativeEventHubProducer,
  sendMessageEventHub,
  sendMessageNativeEventHub,
} from "./utils";

export type QueueProducer<T> = KafkaProducerCompact<T>;

export const createNativeEventHubService = (
  params: EvhQueueParams,
): E.Either<Error, IQueueService> =>
  pipe(
    params,
    EvhPasswordLessQueueParams.decode,
    E.mapLeft((errs) =>
      Error(
        `Cannot decode Event Hub passwordless params|ERROR=${errorsToReadableMessages(
          errs,
        )}`,
      ),
    ),
    E.chain((passwordLessParams) =>
      getPasswordLessNativeEventHubProducer(
        passwordLessParams.hostName,
        passwordLessParams.topicName,
      ),
    ),
    E.orElse(() =>
      pipe(
        params,
        EvhAuthQueueParams.decode,
        E.mapLeft((errs) =>
          Error(
            `Cannot decode Event Hub plain connection params|ERROR=${errorsToReadableMessages(
              errs,
            )}`,
          ),
        ),
        E.chain((connectionParams) =>
          getNativeEventHubProducer(connectionParams.connectionString),
        ),
      ),
    ),
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
