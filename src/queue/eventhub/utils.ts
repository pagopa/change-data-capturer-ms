import {
  AzureEventhubSasFromString,
  KafkaProducerCompact,
  fromConfig,
  fromSas,
  sendMessages,
} from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import { EventHubProducerClient } from "@azure/event-hubs";
import { DefaultAzureCredential } from "@azure/identity";

export const getEventHubProducer = <T>(
  connectionString: string,
): E.Either<Error, KafkaProducerCompact<T>> =>
  pipe(
    AzureEventhubSasFromString.decode(connectionString),
    E.map((sas) => fromSas<T>(sas)),
    E.mapLeft(() => new Error(`Error during decoding Event Hub SAS`)),
  );

export const fromSasPlain = <T>(
  broker: string,
  clientId: string,
  topic: string,
): KafkaProducerCompact<T> =>
  pipe(
    {
      brokers: [`${broker}`],
      clientId,
      idempotent: true,
      maxInFlightRequests: 1,
      ssl: false,
      topic,
      transactionalId: clientId,
    },
    (fullConfig) => fromConfig(fullConfig, fullConfig),
  );
export const getPlainEventHubProducer = <T>(
  broker: string,
  clientId: string,
  topic: string,
): E.Either<Error, KafkaProducerCompact<T>> =>
  pipe(
    E.tryCatch(
      () => fromSasPlain<T>(broker, clientId, topic),
      (error) =>
        new Error(
          `Error during creating Event Hub producer - ${JSON.stringify(error)}`,
        ),
    ),
  );

export const sendMessageEventHub =
  <T>(messagingClient: KafkaProducerCompact<T>) =>
  (messages: ReadonlyArray<T>): TE.TaskEither<Error, void> =>
    pipe(
      sendMessages<T>(messagingClient)(messages),
      TE.map(constVoid),
      TE.mapLeft(
        (sendFailureErrors) =>
          new Error(
            `Error during sending messages to Event Hub - ${sendFailureErrors
              .map((error) => error.message)
              .join(", ")}`,
          ),
      ),
    );

export const getNativeEventHubProducer = (
  connectionString: string,
): E.Either<Error, EventHubProducerClient> =>
  pipe(
    AzureEventhubSasFromString.decode(connectionString),
    E.map(() => new EventHubProducerClient(connectionString)),
    E.mapLeft(() => new Error(`Error during decoding Event Hub SAS`)),
  );

export const getPasswordLessNativeEventHubProducer = (
  hostName: string,
  topicName: string,
): E.Either<Error, EventHubProducerClient> =>
  pipe(
    new DefaultAzureCredential(),
    (credentials) =>
      E.right(new EventHubProducerClient(hostName, topicName, credentials)),
    E.mapLeft(() => new Error(`Error during decoding Event Hub SAS`)),
  );

export const sendMessageNativeEventHub =
  <T>(messagingClient: EventHubProducerClient) =>
  (messages: ReadonlyArray<T>): TE.TaskEither<Error, void> =>
    pipe(
      messages.map((msg) => ({ body: msg })),
      (msgEventData) =>
        TE.tryCatch(() => messagingClient.sendBatch(msgEventData), E.toError),
    );
