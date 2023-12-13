import { KafkaProducerCompact } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { createEventHubService } from "../service";
import * as EventHubUtils from "../utils";
import { MessageType } from "./utils.test";

jest.mock("../utils");
const getEventHubProducerSpy = jest.spyOn(EventHubUtils, "getEventHubProducer");
const sendMessageEventHubSpy = jest.spyOn(EventHubUtils, "sendMessageEventHub");
const connectionString = "your_connection_string";
const mockError = new Error("Failed to get event hub producer");
const mockProducer = {} as KafkaProducerCompact<MessageType>;

describe("EventHubService", () => {
  it("should create EventHubService", async () => {
    getEventHubProducerSpy.mockImplementationOnce(() => E.right(mockProducer));
    sendMessageEventHubSpy.mockImplementationOnce((_) => () => TE.right(true));

    const result = createEventHubService(connectionString);

    expect(getEventHubProducerSpy).toHaveBeenCalledWith(connectionString);
    expect(result).toEqual(
      E.right(expect.objectContaining({ produce: expect.any(Function) }))
    );
  });

  it("should return an error when getEventHubProducer fails", async () => {
    getEventHubProducerSpy.mockImplementationOnce(() => E.left(mockError));

    const result = createEventHubService(connectionString);

    expect(getEventHubProducerSpy).toHaveBeenCalledWith(connectionString);
    expect(result).toEqual(E.left(mockError));
  });
});
