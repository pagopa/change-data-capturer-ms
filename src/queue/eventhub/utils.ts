import {
  AzureEventhubSasFromString,
  KafkaProducerCompact,
  fromSas,
  sendMessages,
} from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import { defaultLog } from "@pagopa/winston-ts";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

export const getEventHubProducer = <T>(
  connectionString: string,
): E.Either<Error, KafkaProducerCompact<T>> =>
  pipe(
    AzureEventhubSasFromString.decode(connectionString),
    E.map((sas) => fromSas<T>(sas)),
    E.mapLeft((errors) =>
      pipe(
        defaultLog.either.error(
          `Error during decoding EventHub ConnectionURI - ${errors}`,
        ),
        () => new Error(`Error during decoding Event Hub SAS`),
      ),
    ),
  );

export const sendMessageEventHub =
  <T>(messagingClient: KafkaProducerCompact<T>) =>
  (messages: ReadonlyArray<T>): TE.TaskEither<Error, void> =>
    pipe(
      messages,
      sendMessages<T>(messagingClient),
      TE.map(() => void 0),
      TE.mapLeft(
        (sendFailureErrors) =>
          new Error(
            `Error during sending messages to Event Hub - ${sendFailureErrors
              .map((error) => error.message)
              .join(", ")}`,
          ),
      ),
    );
