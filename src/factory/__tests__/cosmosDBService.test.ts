import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import { left, right } from "fp-ts/lib/Either";
import {
  cosmosConnect,
  getContainer,
  getDatabase,
} from "../../capturer/cosmos/utils";
import { cosmosDBService } from "../cosmosDBService";

const mockCosmosClient: CosmosClient = {} as CosmosClient;
const mockDatabase: Database = {} as Database;
const mockContainer: Container = {} as Container;

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

  it("should get resource successfully", () => {
    (getContainer as jest.Mock).mockImplementationOnce(() =>
      right(mockContainer)
    );
    const result = cosmosDBService.getResource(mockDatabase, "test-container");
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockContainer));
  });

  it("should handle error when getting resource", () => {
    (getContainer as jest.Mock).mockImplementationOnce(() =>
      left(new Error("Container error"))
    );
    const result = cosmosDBService.getResource(
      mockDatabase,
      "invalid-container"
    );
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Container error")));
  });
});
