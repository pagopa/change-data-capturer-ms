import {
  ChangeFeedStartFrom,
  Container,
  CosmosClient,
  Database,
} from "@azure/cosmos";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { left, right } from "fp-ts/lib/Either";
import * as CosmosCapturer from "../../capturer/cosmos/cosmos";
import {
  getChangeFeedIteratorOptions,
  processChangeFeed,
} from "../../capturer/cosmos/cosmos";
import { cosmosCDCService } from "../cosmosCDCService";
import { ServiceType, createDatabaseService } from "../factory";
import { IDatabaseService } from "../service";

const mockCosmosClient: CosmosClient = {} as CosmosClient;
const mockDatabase: Database = {} as Database;
const mockContainer: Container = {} as Container;

const getChangeFeedIteratorOptionsMock = jest.fn().mockReturnValue({});
jest
  .spyOn(CosmosCapturer, "getChangeFeedIteratorOptions")
  .mockImplementation(getChangeFeedIteratorOptionsMock);
jest
  .spyOn(CosmosCapturer, "processChangeFeed")
  .mockImplementation(() => TE.rightTask(() => null));

const mockDBServiceClient = {
  getDatabase: jest.fn(),
  getResource: jest.fn(),
  connect: jest.fn(),
  getItemByID: jest.fn(),
} satisfies IDatabaseService;

describe("cosmosCDCService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  it("should process change feed successfully with lease", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(TE.right(mockDatabase));
    mockDBServiceClient.getResource.mockReturnValue(TE.right(mockContainer));
    mockDBServiceClient.connect.mockReturnValueOnce(TE.right(mockCosmosClient));
    mockDBServiceClient.getItemByID.mockReturnValueOnce(
      TE.right(O.some({ id: "value", lease: "test" })),
    );
    getChangeFeedIteratorOptionsMock.mockReturnValueOnce({
      maxItemCount: 1,
      changeFeedStartFrom: ChangeFeedStartFrom.Continuation("test"),
    });
    const service = createDatabaseService(ServiceType.Cosmos);
    const result = await service.processChangeFeed(
      mockCosmosClient,
      "test-database",
      "test-container",
      "test-lease-container",
      "test-prefix",
    )(mockDBServiceClient)();

    expect(result).toEqual(right(undefined));
    expect(getChangeFeedIteratorOptions).toHaveBeenCalledWith("test");
    expect(processChangeFeed).toHaveBeenCalledWith(
      mockContainer,
      {
        maxItemCount: 1,
        changeFeedStartFrom: ChangeFeedStartFrom.Continuation("test"),
      },
      mockContainer,
    );
  });

  it("should process change feed successfully without lease", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(TE.right(mockDatabase));
    mockDBServiceClient.getResource.mockReturnValue(TE.right(mockContainer));
    mockDBServiceClient.connect.mockReturnValueOnce(TE.right(mockCosmosClient));
    mockDBServiceClient.getItemByID.mockReturnValueOnce(TE.right(O.none));
    getChangeFeedIteratorOptionsMock.mockReturnValueOnce({
      maxItemCount: 1,
      changeFeedStartFrom: ChangeFeedStartFrom.Beginning(),
    });

    const result = await cosmosCDCService.processChangeFeed(
      mockCosmosClient,
      "test-database",
      "test-container",
      "test-lease-container",
      "test-prefix",
    )(mockDBServiceClient)();

    expect(result).toEqual(right(undefined));
    expect(getChangeFeedIteratorOptions).toHaveBeenCalledWith(undefined);
    expect(processChangeFeed).toHaveBeenCalledWith(
      mockContainer,
      {
        maxItemCount: 1,
        changeFeedStartFrom: ChangeFeedStartFrom.Beginning(),
      },
      mockContainer,
    );
  });

  it("should handle error during change feed processing", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(TE.right(mockDatabase));
    mockDBServiceClient.getResource.mockReturnValueOnce(
      TE.left(new Error("Impossible to get the container")),
    );

    const result = await cosmosCDCService.processChangeFeed(
      mockCosmosClient,
      "invalid-database",
      "invalid-container",
    )(mockDBServiceClient)();

    expect(result).toEqual(left(new Error("Impossible to get the container")));
  });
});
