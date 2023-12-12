import { IStorableSendFailureError } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaOperation";
import * as KafkaFpTs from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import { KafkaProducerCompact } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { RecordMetadata } from "kafkajs";
import { getEventHubProducer, sendMessageEventHub } from "../utils";

const DUMMY_SAS = {
  url: "dummy.servicebus.windows.net",
  key: "dummykeytp5bIGW+QCTtGh8RIpcOCHg2CfJU7ij1uQmA=",
  policy: "dummy-policy",
  name: "dummy-name",
};
const DUMMY_CONNECTION_STRING = `Endpoint=sb://${DUMMY_SAS.url}/;SharedAccessKeyName=${DUMMY_SAS.policy};SharedAccessKey=${DUMMY_SAS.key};EntityPath=${DUMMY_SAS.name}`;

describe("getEventHubProducer", () => {
  it("should return a KafkaProducerCompact on successful decoding", () => {
    const result = getEventHubProducer(DUMMY_CONNECTION_STRING);

    expect(E.isRight(result)).toBe(true);
  });

  it("should return an Either with an error on decoding failure", () => {
    const invalidConnectionString =
      "DefaultEndpointsProtocol=https;AccountName=dummy;AccountKey=key;EndpointSuffix=core.windows.net";

    const result = getEventHubProducer(invalidConnectionString);

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error("Error during decoding Event Hub SAS")
      );
    }
  });
});

type MessageType = { id: string; message: string };

const mockMessagingClient: KafkaProducerCompact<MessageType> =
  {} as unknown as KafkaProducerCompact<MessageType>;
const recordMetadata: RecordMetadata[] = [
  { topicName: "test", partition: 0, errorCode: 0 },
];

const sendMessagingMock = jest.spyOn(KafkaFpTs, "sendMessages");
describe("sendMessageEventHub", () => {
  it("should send messages successfully and return a valid boolean", async () => {
    const messages: MessageType[] = [{ id: "1", message: "test" }];

    sendMessagingMock.mockReturnValue((_) =>
      TE.rightTask(() => Promise.resolve(recordMetadata))
    );
    const result = await sendMessageEventHub(mockMessagingClient, messages)();

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right).toEqual(true);
    }

    const errorMessages: MessageType[] = [
      { id: "1", message: "test" },
      { id: "2", message: "test" },
    ];

    sendMessagingMock.mockReturnValue((_) =>
      TE.rightTask(() => Promise.resolve(recordMetadata))
    );

    const wrongResult = await sendMessageEventHub(
      mockMessagingClient,
      errorMessages
    )();

    expect(E.isRight(wrongResult)).toBe(true);
    if (E.isRight(wrongResult)) {
      expect(wrongResult.right).toEqual(false);
    }
  });

  it("should handle send failure and return an error", async () => {
    const storableSendFailureError: Array<
      IStorableSendFailureError<MessageType>
    > = [
      {
        name: "KafkaJSError",
        message: "Broker unavailable",
        body: {
          id: "",
          message: "",
        },
        retriable: false,
      },
    ];
    sendMessagingMock.mockReturnValue((_) =>
      TE.leftTask(() => Promise.resolve(storableSendFailureError))
    );

    const result = await sendMessageEventHub(mockMessagingClient, [])();

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error(
          "Error during sending messages to Event Hub - Broker unavailable"
        )
      );
    }
  });
});
