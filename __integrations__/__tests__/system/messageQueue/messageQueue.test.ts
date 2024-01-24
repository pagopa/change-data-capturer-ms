import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import {
  Consumer,
  ConsumerCrashEvent,
  ConsumerGroupJoinEvent,
  EachMessagePayload,
  Kafka,
  KafkaConfig,
} from "kafkajs";
import {
  createEventHubService,
  createPlainEventHubService,
} from "../../../../src/queue/eventhub/service";
import {
  MESSAGEQUEUE_CLIENTID,
  MESSAGEQUEUE_CONNECTION_STRING,
  MESSAGEQUEUE_GROUPID,
  MESSAGEQUEUE_TOPIC,
} from "../../../env";

function getRandomKeyValueObject(): { [key: string]: any } {
  const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const randomKey = characters.charAt(
    Math.floor(Math.random() * characters.length),
  );
  const randomValue = Math.random();

  const randomObject: { [key: string]: any } = {};
  randomObject[randomKey] = randomValue;

  return randomObject;
}

const waitForMessage = () =>
  new Promise((resolve, _) => {
    const timeoutId = setTimeout(() => {
      resolve(`Timeout`);
    }, 10000);
  });

const waitForConsumerToJoinGroup = (consumer: Consumer) =>
  new Promise((resolve, _) => {
    const timeoutId = setTimeout(() => {
      consumer.disconnect().then(() => {
        resolve(`Timeout`);
      });
    }, 10000);
    consumer.on(consumer.events.GROUP_JOIN, (event: ConsumerGroupJoinEvent) => {
      clearTimeout(timeoutId);
      resolve(event);
    });
    consumer.on(consumer.events.CRASH, (event: ConsumerCrashEvent) => {
      clearTimeout(timeoutId);
      consumer.disconnect().then(() => {
        resolve(event.payload.error);
      });
    });
  });

describe("EventHubService", () => {
  it("Sending event to EventHub succesfully", async () => {
    const messageToSend = getRandomKeyValueObject();
    const result = await pipe(
      createPlainEventHubService(
        MESSAGEQUEUE_CONNECTION_STRING,
        MESSAGEQUEUE_CLIENTID,
        MESSAGEQUEUE_TOPIC,
      ),
      TE.fromEither,
      TE.chain((producer) => producer.produce([messageToSend])),
    )();

    expect(E.isRight(result)).toBeTruthy();

    const kafkaConfig: KafkaConfig = {
      brokers: [MESSAGEQUEUE_CONNECTION_STRING],
    };
    const kafka = new Kafka(kafkaConfig);
    const consumer = kafka.consumer({
      groupId: MESSAGEQUEUE_GROUPID,
    });

    await consumer.connect();
    await consumer.subscribe({
      topic: MESSAGEQUEUE_TOPIC,
      fromBeginning: true,
    });
    var messageToCompare = {};
    consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        messageToCompare = JSON.parse(message.value?.toString()!);
      },
    });

    await waitForConsumerToJoinGroup(consumer);
    await waitForMessage();

    expect(messageToCompare).toEqual(messageToSend);
    await consumer.disconnect();
  }, 25000);

  it("Sending event to EventHub with error", async () => {
    const message = getRandomKeyValueObject();
    const result = await pipe(
      createEventHubService("fake-connection"),
      TE.fromEither,
      TE.chain((producer) => producer.produce([message])),
    )();

    expect(E.isLeft(result)).toBeTruthy();
  });
});
