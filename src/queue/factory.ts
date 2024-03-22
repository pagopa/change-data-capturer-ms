import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import {
  createKafkaService,
  createNativeEventHubService,
} from "./eventhub/service";

export interface IQueueService {
  readonly produce: <T>(
    messages: ReadonlyArray<T>,
  ) => TE.TaskEither<Error, void>;
}
export enum QueueType {
  EventHub,
  Kafka,
}

export const BaseQueueParams = t.type({
  connectionString: t.string,
});
export type BaseQueueParams = t.TypeOf<typeof BaseQueueParams>;

export const EvhPasswordLessQueueParams = t.type({
  hostName: t.string,
  queueType: t.literal(QueueType.EventHub),
  topicName: t.string,
  useManagedIdentity: t.literal(true),
});
export type EvhPasswordLessQueueParams = t.TypeOf<
  typeof EvhPasswordLessQueueParams
>;
export const EvhAuthQueueParams = t.intersection([
  BaseQueueParams,
  t.type({
    queueType: t.literal(QueueType.EventHub),
    useManagedIdentity: t.literal(false),
  }),
]);
export type EvhAuthQueueParams = t.TypeOf<typeof EvhAuthQueueParams>;

export const KafkaQueueParams = t.intersection([
  BaseQueueParams,
  t.type({
    queueType: t.literal(QueueType.Kafka),
  }),
]);

export type KafkaQueueParams = t.TypeOf<typeof KafkaQueueParams>;

export type EvhQueueParams = EvhAuthQueueParams | EvhPasswordLessQueueParams;

export type QueueParams = EvhQueueParams | KafkaQueueParams;

export const notSupportedError = "Queue type still not supported";

export const createInternalQueueService = (
  queueParams: QueueParams,
): E.Either<Error, IQueueService> => {
  switch (queueParams.queueType) {
    case QueueType.Kafka:
      return createKafkaService(queueParams.connectionString);
    case QueueType.EventHub:
      return createNativeEventHubService(queueParams);
    default:
      E.left(new Error(notSupportedError));
  }
};
