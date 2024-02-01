import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { Kafka } from "kafkajs";
import {
  MESSAGEQUEUE_CLIENTID,
  MESSAGEQUEUE_CONNECTION_STRING,
  MESSAGEQUEUE_TOPIC,
} from "../env";

export const createTopic = (): TE.TaskEither<Error, void> =>
  pipe(
    new Kafka({
      clientId: MESSAGEQUEUE_CLIENTID,
      brokers: [MESSAGEQUEUE_CONNECTION_STRING],
    }),
    (kafka) => E.tryCatch(() => kafka.admin(), E.toError),
    TE.fromEither,
    TE.chainFirst((admin) => TE.tryCatch(() => admin.connect(), E.toError)),
    TE.chainFirst((admin) =>
      TE.tryCatch(
        () =>
          admin.createTopics({
            topics: [
              {
                topic: MESSAGEQUEUE_TOPIC,
                numPartitions: 2,
                replicationFactor: 1,
              },
            ],
          }),
        E.toError,
      ),
    ),
    TE.chain((admin) => TE.tryCatch(() => admin.disconnect(), E.toError)),
  );
