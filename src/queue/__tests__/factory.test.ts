import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import * as S from "../eventhub/service";
import { QueueType, createInternalQueueService } from "../factory";

const spiedCreateKafkaService = jest.spyOn(S, "createKafkaService");
const spiedCreateNativeEventHubService = jest.spyOn(
  S,
  "createNativeEventHubService",
);

const aConnectionString =
  "Endpoint=sb://foo.windows.net/;SharedAccessKeyName=foo;SharedAccessKey=SharedAccessKey=;EntityPath=foo";
const failTest = (msg: string) => {
  throw Error(msg);
};
describe("createInternalQueueService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("should return Error if factory cannot get QueueService", () => {
    spiedCreateNativeEventHubService.mockImplementationOnce(() =>
      E.left(Error("Cannot reach EventHub")),
    );
    pipe(
      createInternalQueueService({
        queueType: QueueType.EventHub,
        useManagedIdentity: false,
        connectionString: aConnectionString,
      }),
      E.mapLeft((e) => {
        expect(e).toBeDefined();
        expect(e.message).toEqual("Cannot reach EventHub");
      }),
      E.map(() =>
        failTest(
          "Cannot instantiate queue service with wrong connection string",
        ),
      ),
    );
  });
  it("should create native EventHub QueueService with connection string", () => {
    spiedCreateNativeEventHubService.mockImplementationOnce(() =>
      E.right({} as any),
    );
    pipe(
      createInternalQueueService({
        queueType: QueueType.EventHub,
        useManagedIdentity: false,
        connectionString: aConnectionString,
      }),
      E.mapLeft(() => failTest("Should not fail")),
      E.map((service) => {
        expect(service).toBeDefined();
        expect(spiedCreateNativeEventHubService).toHaveBeenCalled();
        expect(spiedCreateNativeEventHubService).toHaveBeenCalledWith({
          queueType: QueueType.EventHub,
          useManagedIdentity: false,
          connectionString: aConnectionString,
        });
      }),
    );
  });
  it("should create Kafka QueueService if QueueType is defined as Kafka", () => {
    spiedCreateNativeEventHubService.mockImplementationOnce(() =>
      E.right({} as any),
    );
    spiedCreateKafkaService.mockImplementationOnce(() => E.right({} as any));
    pipe(
      createInternalQueueService({
        queueType: QueueType.Kafka,
        connectionString: aConnectionString,
      }),
      E.mapLeft(() => failTest("Should not fail")),
      E.map((service) => {
        expect(service).toBeDefined();
        expect(spiedCreateNativeEventHubService).not.toHaveBeenCalled();
        expect(spiedCreateKafkaService).toHaveBeenCalled();
        expect(spiedCreateKafkaService).toHaveBeenCalledWith(
          aConnectionString
        );
      }),
    );
  });
});
