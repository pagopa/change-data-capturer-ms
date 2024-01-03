import {
  Container,
  CosmosClient,
  CosmosClientOptions,
  Database,
} from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { left, right } from "fp-ts/lib/Either";
import * as CosmosUtils from "../../capturer/cosmos/utils";
import { cosmosDBService } from "../cosmosDBService";

const mockCosmosClient: CosmosClient = {
  databases: jest.fn(),
} as unknown as CosmosClient;
const mockCosmosConfig: CosmosClientOptions = {
  endpoint: "your-endpoint",
  key: "your.key",
} as unknown as CosmosClientOptions;
const mockDatabase: Database = {} as Database;
const mockContainer: Container = {} as Container;
const mockItem: CosmosUtils.ContinuationTokenItem = {
  id: "test",
} as CosmosUtils.ContinuationTokenItem;

jest.mock("../../capturer/cosmos/utils");

const getCosmosConfigSpy = jest.spyOn(CosmosUtils, "getCosmosConfig");
const cosmosConnectSpy = jest.spyOn(CosmosUtils, "cosmosConnect");
const getDatabaseSpy = jest.spyOn(CosmosUtils, "getDatabase");
const getContainerSpy = jest.spyOn(CosmosUtils, "getContainer");
const getItemByIDSpy = jest.spyOn(CosmosUtils, "getItemByID");

describe("cosmosDBService", () => {
  it("should connect to Cosmos successfully", async () => {
    cosmosConnectSpy.mockImplementationOnce(() => right(mockCosmosClient));
    getCosmosConfigSpy.mockImplementationOnce(() => right(mockCosmosConfig));
    const result = await cosmosDBService.connect({
      connection: "valid-string-connection",
    })();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockCosmosClient));
  });

  it("should handle connection error", async () => {
    getCosmosConfigSpy.mockImplementationOnce(() => right(mockCosmosConfig));

    cosmosConnectSpy.mockImplementationOnce(() =>
      left(new Error("Connection error")),
    );
    const result = await cosmosDBService.connect({
      connection: "invalid-connection",
    })();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Connection error")));
  });

  it("should get database successfully", () => {
    getDatabaseSpy.mockImplementationOnce(() => right(mockDatabase));
    const result = cosmosDBService.getDatabase(
      mockCosmosClient,
      "test-database",
    );
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockDatabase));
  });

  it("should handle error when getting database", () => {
    getDatabaseSpy.mockImplementationOnce(() =>
      left(new Error("Database error")),
    );
    const result = cosmosDBService.getDatabase(
      mockCosmosClient,
      "invalid-database",
    );
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Database error")));
  });

  it("should get resource successfully", async () => {
    getContainerSpy.mockImplementationOnce(() => TE.right(mockContainer));
    const result = await cosmosDBService.getResource(
      mockDatabase,
      "test-container",
    )();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockContainer));
  });

  it("should handle error when getting resource", async () => {
    getContainerSpy.mockImplementationOnce(() =>
      TE.left(new Error("Container error")),
    );
    const result = await cosmosDBService.getResource(
      mockDatabase,
      "invalid-container",
    )();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Container error")));
  });

  it("should get item by id succesfully", async () => {
    getItemByIDSpy.mockImplementationOnce(() =>
      TE.right(O.fromNullable(mockItem)),
    );
    const result = await cosmosDBService.getItemByID(mockContainer, "testID")();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(O.fromNullable(mockItem)));
  });

  it("should handle error when getting item by id", async () => {
    getItemByIDSpy.mockImplementationOnce(() =>
      TE.left(new Error("Item error")),
    );
    const result = await cosmosDBService.getItemByID(mockContainer, "testID")();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Item error")));
  });
});
