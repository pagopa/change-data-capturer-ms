import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { left, right } from "fp-ts/lib/Either";
import {
  ContinuationTokenItem,
  cosmosConnect,
  getContainer,
  getDatabase,
  getItemByID,
} from "../../capturer/cosmos/utils";
import { cosmosDBService } from "../cosmosDBService";

const mockCosmosClient: CosmosClient = {} as CosmosClient;
const mockDatabase: Database = {} as Database;
const mockContainer: Container = {} as Container;
const mockItem: ContinuationTokenItem = { id: "test" } as ContinuationTokenItem;
jest.mock("../../capturer/cosmos/utils");

describe("cosmosDBService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should connect to Cosmos successfully", async () => {
    (cosmosConnect as jest.Mock).mockImplementationOnce(() =>
      right(mockCosmosClient)
    );
    const result = await cosmosDBService.connect({
      connection: "valid-connection",
    })();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockCosmosClient));
  });

  it("should handle connection error", async () => {
    (cosmosConnect as jest.Mock).mockImplementationOnce(() =>
      left(new Error("Connection error"))
    );
    const result = await cosmosDBService.connect({
      connection: "invalid-connection",
    })();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Connection error")));
  });

  it("should get database successfully", () => {
    (getDatabase as jest.Mock).mockImplementationOnce(() =>
      right(mockDatabase)
    );
    const result = cosmosDBService.getDatabase(
      mockCosmosClient,
      "test-database"
    );
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockDatabase));
  });

  it("should handle error when getting database", () => {
    (getDatabase as jest.Mock).mockImplementationOnce(() =>
      left(new Error("Database error"))
    );
    const result = cosmosDBService.getDatabase(
      mockCosmosClient,
      "invalid-database"
    );
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Database error")));
  });

  it("should get resource successfully", async () => {
    (getContainer as jest.Mock).mockImplementationOnce(() =>
      TE.rightTask(() => Promise.resolve(mockContainer))
    );
    const result = await cosmosDBService.getResource(
      mockDatabase,
      "test-container"
    )();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockContainer));
  });

  it("should handle error when getting resource", async () => {
    (getContainer as jest.Mock).mockImplementationOnce(() =>
      TE.leftTask(() => Promise.resolve(new Error("Container error")))
    );
    const result = await cosmosDBService.getResource(
      mockDatabase,
      "invalid-container"
    )();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Container error")));
  });

  it("should get item by id succesfully", async () => {
    (getItemByID as jest.Mock).mockImplementationOnce(() =>
      TE.rightTask(() => Promise.resolve(mockItem))
    );
    const result = await cosmosDBService.getItemByID(mockContainer, "testID")();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockItem));
  });

  it("should handle error when getting item by id", async () => {
    (getItemByID as jest.Mock).mockImplementationOnce(() =>
      TE.leftTask(() => Promise.resolve(new Error("Item error")))
    );
    const result = await cosmosDBService.getItemByID(mockContainer, "testID")();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Item error")));
  });
});
