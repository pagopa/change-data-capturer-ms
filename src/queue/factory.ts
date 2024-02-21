import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/function";
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

export const notSupportedError = "Queue type still not supported";

export const createInternalQueueService = (
  type: QueueType,
  connectionString: string,
): E.Either<Error, IQueueService> => {
  switch (type) {
    case QueueType.Kafka:
      return createKafkaService(connectionString);
    case QueueType.EventHub:
      return createNativeEventHubService(connectionString);
    default:
      E.left(new Error(notSupportedError));
  }
};

export const getInternalQueueService = (
  connectionString: string,
  queueType?: QueueType,
): E.Either<Error, IQueueService> =>
  pipe(
    queueType,
    O.fromNullable,
    O.map((type) => createInternalQueueService(type, connectionString)),
    O.getOrElse(() => createNativeEventHubService(connectionString)),
  );
