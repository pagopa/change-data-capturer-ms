import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { left, right } from "fp-ts/lib/Either";
import { rightTask } from "fp-ts/lib/TaskEither";
import { ContinuationTokenItem } from "../../capturer/cosmos/utils";
import { cosmosCDCService, cosmosDBService } from "../cosmosService";

const mockCosmosClient: CosmosClient = {} as CosmosClient;
const mockDatabase: Database = {} as Database;
const mockContainer: Container = {} as Container;
const mockItemByIdResult: E.Either<
  Error,
  O.Option<ContinuationTokenItem>
> = right(O.some({ id: "test-id", lease: "test-lease" }));

jest.mock("../../capturer/cosmos/utils", () => ({
  cosmosConnect: jest
    .fn()
    .mockImplementationOnce(() => right(mockCosmosClient))
    .mockImplementationOnce(() => left(new Error("Connection error")))
    .mockImplementation(() => right(mockCosmosClient)),
  getDatabase: jest
    .fn()
    .mockImplementationOnce(() => right(mockDatabase))
    .mockImplementationOnce(() => left(new Error("Database error")))
    .mockImplementation(() => right(mockDatabase)),
  getContainer: jest
    .fn()
    .mockImplementationOnce(() => right(mockContainer))
    .mockImplementationOnce(() => left(new Error("Container error")))
    .mockImplementationOnce(() => right(mockContainer))
    .mockImplementationOnce(() => right(mockContainer))
    .mockImplementationOnce(() =>
      left(new Error("Impossible to get the container"))
    ),
  getItemById: jest
    .fn()
    .mockImplementationOnce(() => () => Promise.resolve(mockItemByIdResult))
    .mockImplementation(() => () => Promise.resolve(mockItemByIdResult)),
}));

jest.mock("../../capturer/cosmos/cosmos", () => ({
  ...jest.requireActual("../../capturer/cosmos/cosmos"),
  getChangeFeedIteratorOptions: jest.fn(() => right({})),
  processChangeFeed: jest.fn(() => rightTask(() => null)),
}));

describe("cosmosDBService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  it("should connect to Cosmos successfully", () => {
    const result = cosmosDBService.connect<CosmosClient>({
      connection: "valid-connection",
    });
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockCosmosClient));
  });

  it("should handle connection error", () => {
    const result = cosmosDBService.connect<CosmosClient>({
      connection: "invalid-connection",
    });
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Connection error")));
  });

  it("should get database successfully", () => {
    const result = cosmosDBService.getDatabase<CosmosClient, Database>(
      mockCosmosClient,
      "test-database"
    );
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockDatabase));
  });

  it("should handle error when getting database", () => {
    const result = cosmosDBService.getDatabase<CosmosClient, Database>(
      mockCosmosClient,
      "invalid-database"
    );
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Database error")));
  });

  it("should get resource successfully", () => {
    const result = cosmosDBService.getResource<Database, Container>(
      mockDatabase,
      "test-container"
    );
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockContainer));
  });

  it("should handle error when getting resource", () => {
    const result = cosmosDBService.getResource<Database, Container>(
      mockDatabase,
      "invalid-container"
    );
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Container error")));
  });
});

describe("cosmosCDCService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  it("should process change feed successfully", async () => {
    const result = await cosmosCDCService.processChangeFeed<CosmosClient>(
      mockCosmosClient,
      "test-database",
      "test-container",
      "test-lease-container",
      "test-prefix"
    )();

    expect(result).toEqual(right(undefined));
  });

  it("should handle error during change feed processing", async () => {
    const result = await cosmosCDCService.processChangeFeed<CosmosClient>(
      mockCosmosClient,
      "invalid-database",
      "invalid-container"
    )();

    expect(result).toEqual(left(new Error("Impossible to get the container")));
  });
});
