import { KafkaProducerCompact } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as TE from "fp-ts/TaskEither";
import { RecordMetadata } from "kafkajs";
import { getEventHubProducer, sendMessageEventHub } from "./utils";

export type QueueProducer<T> = KafkaProducerCompact<T>;
export type MessageMetadata = RecordMetadata;
export interface QueueService {
  getProducer<T>(connectionString: string): QueueProducer<T>;
  produce<T>(
    producer: QueueProducer<T>,
    messages: ReadonlyArray<T>
  ): TE.TaskEither<Error, ReadonlyArray<MessageMetadata>>;
}

export const eventHubService = {
  getProducer: getEventHubProducer,
  produce: sendMessageEventHub,
};
