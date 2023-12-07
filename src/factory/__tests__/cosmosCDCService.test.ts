import {
  ChangeFeedStartFrom,
  Container,
  CosmosClient,
  Database,
} from "@azure/cosmos";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { left, right } from "fp-ts/lib/Either";
import {
  getChangeFeedIteratorOptions,
  processChangeFeed,
} from "../../capturer/cosmos/cosmos";
import { cosmosCDCService } from "../cosmosCDCService";
import { DatabaseService } from "../service";

const mockCosmosClient: CosmosClient = {} as CosmosClient;
const mockDatabase: Database = {} as Database;
const mockContainer: Container = {} as Container;

jest.mock("../../capturer/cosmos/cosmos", () => ({
  ...jest.requireActual("../../capturer/cosmos/cosmos"),
  getChangeFeedIteratorOptions: jest.fn(() => right({})),
  processChangeFeed: jest.fn(() => TE.rightTask(() => null)),
}));

const mockDBServiceClient = {
  getDatabase: jest.fn(),
  getResource: jest.fn(),
  connect: jest.fn(),
  getItemByID: jest.fn(),
} satisfies DatabaseService;

describe("cosmosCDCService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  it("should process change feed successfully with lease", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(
      right(mockCosmosClient)
    );
    mockDBServiceClient.getResource.mockReturnValue(right(mockDatabase));
    mockDBServiceClient.connect.mockReturnValueOnce(right(mockContainer));
    mockDBServiceClient.getItemByID.mockReturnValueOnce(
      TE.right(O.some({ id: "value", lease: "test" }))
    );
    (getChangeFeedIteratorOptions as jest.Mock).mockReturnValueOnce(
      right({
        maxItemCount: 1,
        changeFeedStartFrom: ChangeFeedStartFrom.Continuation("test"),
      })
    );
    const result = await cosmosCDCService.processChangeFeed(
      mockCosmosClient,
      "test-database",
      "test-container",
      "test-lease-container",
      "test-prefix"
    )(mockDBServiceClient)();

    expect(result).toEqual(right(undefined));
    expect(getChangeFeedIteratorOptions).toHaveBeenCalledWith("test");
    expect(processChangeFeed).toHaveBeenCalledWith(
      mockContainer,
      {
        maxItemCount: 1,
        changeFeedStartFrom: ChangeFeedStartFrom.Continuation("test"),
      },
      mockContainer
    );
  });

  it("should process change feed successfully without lease", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(
      right(mockCosmosClient)
    );
    mockDBServiceClient.getResource.mockReturnValue(right(mockDatabase));
    mockDBServiceClient.connect.mockReturnValueOnce(right(mockContainer));
    mockDBServiceClient.getItemByID.mockReturnValueOnce(TE.right(O.none));
    (getChangeFeedIteratorOptions as jest.Mock).mockReturnValueOnce(
      right({
        maxItemCount: 1,
        changeFeedStartFrom: ChangeFeedStartFrom.Beginning(),
      })
    );

    const result = await cosmosCDCService.processChangeFeed(
      mockCosmosClient,
      "test-database",
      "test-container",
      "test-lease-container",
      "test-prefix"
    )(mockDBServiceClient)();

    expect(result).toEqual(right(undefined));
    expect(getChangeFeedIteratorOptions).toHaveBeenCalledWith(undefined);
    expect(processChangeFeed).toHaveBeenCalledWith(
      mockContainer,
      {
        maxItemCount: 1,
        changeFeedStartFrom: ChangeFeedStartFrom.Beginning(),
      },
      mockContainer
    );
  });

  it("should handle error during change feed processing", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(
      right(mockCosmosClient)
    );
    mockDBServiceClient.getResource.mockReturnValueOnce(
      left(new Error("Impossible to get the container"))
    );

    const result = await cosmosCDCService.processChangeFeed(
      mockCosmosClient,
      "invalid-database",
      "invalid-container"
    )(mockDBServiceClient)();

    expect(result).toEqual(left(new Error("Impossible to get the container")));
  });
});