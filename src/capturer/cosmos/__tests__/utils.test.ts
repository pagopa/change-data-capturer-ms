/* eslint-disable no-var */
/* eslint-disable no-underscore-dangle */
import "@azure/cosmos";
import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import {
  cosmosConnect,
  getContainer,
  getDatabase,
  getItemByID,
  upsertItem,
} from "../utils";

const error = new Error("Connection error");

const mockCosmosClient: CosmosClient = {
  database: jest.fn(),
} as unknown as CosmosClient;

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest.fn(),
}));

describe("cosmosConnect", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should connect to Cosmos successfully", async () => {
    const connString = "your-conn-string";

    (CosmosClient as jest.Mock).mockImplementationOnce(() => mockCosmosClient);

    const result = cosmosConnect(connString);

    expect(CosmosClient).toHaveBeenCalledWith(connString);
    expect(result).toEqual(E.right(mockCosmosClient));
  });

  it("should handle connection error", async () => {
    const connString = "invalid-endpoint";

    (CosmosClient as jest.Mock).mockImplementationOnce(() => {
      {
        throw error;
      }
    });
    const result = cosmosConnect(connString);

    expect(CosmosClient).toHaveBeenCalledWith(connString);
    expect(result).toEqual(
      E.left(new Error(`Impossible to connect to Cosmos`)),
    );
  });
});

const testID = "test-id";
const testLease = "test-lease";

const itemReadMock = jest.fn();

const mockContainer: Container = {
  items: {
    upsert: jest.fn(),
  },
  id: testLease,
  item: jest.fn().mockReturnValue({
    read: itemReadMock,
  }),
} as unknown as Container;

describe("getDatabase", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const databaseName = "dbId";
  const readMock = jest
    .fn()
    .mockResolvedValue({ database: { id: databaseName } });
  const databaseMock = jest.fn().mockReturnValue({
    read: readMock,
  });
  const mockCosmosClient = {
    database: databaseMock,
  } as unknown as CosmosClient;

  it("should get database instance by providing db name", async () => {
    const errorOrDatabase = await getDatabase(mockCosmosClient, databaseName)();
    expect(E.isRight(errorOrDatabase)).toBeTruthy();
    if (E.isRight(errorOrDatabase)) {
      expect(errorOrDatabase.right).toEqual({
        id: databaseName,
      });
    }
  });

  it("should get an error if something fails while getting database", async () => {
    databaseMock.mockImplementationOnce(() => {
      throw Error("Error while getting database");
    });
    const errorOrDatabase = await getDatabase(mockCosmosClient, databaseName)();
    expect(E.isLeft(errorOrDatabase)).toBeTruthy();
    if (E.isLeft(errorOrDatabase)) {
      expect(errorOrDatabase.left).toEqual(
        new Error(`Impossible to get database ${databaseName}`),
      );
    }
  });
});

describe("getContainer", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const containerName = "containerName";
  const readMock = jest
    .fn()
    .mockResolvedValue({ container: { id: containerName } });
  const containerMock = jest.fn().mockReturnValue({
    read: readMock,
  });
  const mockDatabase = {
    container: containerMock,
  } as unknown as Database;
  it("should get a container instance by providing container name", async () => {
    const errorOrContainer = await getContainer(mockDatabase, containerName)();
    expect(E.isRight(errorOrContainer)).toBeTruthy();
    if (E.isRight(errorOrContainer)) {
      expect(errorOrContainer.right).toEqual({ id: containerName });
    }
  });

  it("should get an error if something fails while getting container", async () => {
    containerMock.mockImplementationOnce(() => {
      throw Error("Error while getting container");
    });
    const errorOrContainer = await getContainer(mockDatabase, containerName)();
    expect(E.isLeft(errorOrContainer)).toBeTruthy();
    if (E.isLeft(errorOrContainer)) {
      expect(errorOrContainer.left).toEqual(
        new Error(`Impossible to get container ${containerName}`),
      );
    }
  });
});

describe("getItemById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("should get item by ID successfully", async () => {
    const id = "test-id";
    const expectedResult = { id: testID, lease: testLease };

    itemReadMock.mockResolvedValueOnce({ resource: expectedResult });

    const result = await getItemByID(mockContainer, id)();

    expect(mockContainer.item).toHaveBeenCalledWith(id);
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(
        O.some({
          id: "test-id",
          lease: "test-lease",
        }),
      );
    }
  });

  it("should handle error when getting item by ID", async () => {
    itemReadMock.mockRejectedValueOnce(new Error("Mock error"));
    const result = await getItemByID(mockContainer, testID)();

    expect(mockContainer.item).toHaveBeenCalledWith(testID);

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error(
          `Impossible to get item ${testID} from container ${testLease}`,
        ),
      );
    }
  });

  it("should handle empty result when getting item by ID", async () => {
    itemReadMock.mockResolvedValueOnce({ resource: null });

    const result = await getItemByID(mockContainer, testID)();

    expect(mockContainer.item).toHaveBeenCalledWith(testID);

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(O.isSome(result.right)).toBe(false);
    }
  });
});

describe("upsertItem", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const itemsUpsertMock = jest.fn();

  const mockUpsert: Container = {
    items: {
      upsert: itemsUpsertMock,
    },
    id: "upsert",
  } as unknown as Container;
  it("should upsert an item successfully", async () => {
    itemsUpsertMock.mockResolvedValueOnce(void 0);

    const result = await upsertItem(mockUpsert, {
      id: "testId",
      lease: "testLease",
    })();

    expect(mockUpsert.items.upsert).toHaveBeenCalledWith({
      id: "testId",
      lease: "testLease",
    });

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(undefined);
    }
  });

  it("should handle errors during upsert", async () => {
    itemsUpsertMock.mockRejectedValueOnce(() => {
      throw new Error("Mock upsert error");
    });

    const result = await upsertItem(mockUpsert, {
      id: "testId",
      lease: "testLease",
    })();

    expect(mockUpsert.items.upsert).toHaveBeenCalledWith({
      id: "testId",
      lease: "testLease",
    });

    expect(E.isLeft(result)).toBeTruthy();
  });
});
