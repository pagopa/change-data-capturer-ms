/* eslint-disable no-underscore-dangle */
import "@azure/cosmos";
import { Container, CosmosClient } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { cosmosConnect, getItemById, upsertItem } from "../utils";

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest.fn(),
  Container: jest.fn(),
  ChangeFeedStartFrom: {
    Continuation: jest.fn(),
    Beginning: jest.fn(),
  },
  StatusCodes: {
    NotModified: 304,
  },
}));

const mockCosmosClient: CosmosClient = {
  database: jest.fn(),
} as unknown as CosmosClient;

const testID = "test-id";
const testLease = "test-lease";

const readItemMock = jest.fn();
const upsertMock = jest.fn();

const mockContainer: Container = {
  items: {
    upsert: upsertMock,
  },
  id: testLease,
  item: jest.fn().mockReturnValue({ read: readItemMock }),
} as unknown as Container;

const mockUpsert: Container = {
  items: {
    upsert: upsertMock,
  },
  id: "upsert",
} as unknown as Container;

describe("cosmosConnect", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should connect to Cosmos successfully", async () => {
    const endpoint = "your-endpoint";
    const key = "your-key";

    (CosmosClient as jest.Mock).mockImplementationOnce(() => mockCosmosClient);
    const result = cosmosConnect(endpoint, key);
    expect(CosmosClient).toHaveBeenCalledWith({ endpoint, key });
    expect(result).toEqual(E.right(mockCosmosClient));
  });

  it("should handle connection error", async () => {
    const endpoint = "invalid-endpoint";
    const key = "invalid-key";
    (CosmosClient as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Connection error");
    });
    const result = cosmosConnect(endpoint, key);
    expect(CosmosClient).toHaveBeenCalledWith({ endpoint, key });
    expect(result).toEqual(
      E.left(
        new Error(
          `Impossible to connect to Cosmos: " ${String(
            new Error("Connection error")
          )}`
        )
      )
    );
  });
});

describe("getItemById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("should get item by ID successfully", async () => {
    const expectedResult = { id: testID, lease: testLease };

    readItemMock.mockReturnValueOnce(
      Promise.resolve({ resource: expectedResult })
    );

    const result = await getItemById(mockContainer, testID)();

    expect(mockContainer.item).toHaveBeenCalledWith(testID, testID);
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(
        O.some({
          id: "test-id",
          lease: "test-lease",
        })
      );
    }
  });

  it("should handle error when getting item by ID", async () => {
    readItemMock.mockRejectedValueOnce(new Error("Mock error"));
    const result = await getItemById(mockContainer, testID)();

    expect(mockContainer.item).toHaveBeenCalledWith(testID, testID);

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error(
          `Impossible to get item ${testID} from container ${testLease}: Error: Mock error`
        )
      );
    }
  });

  it("should handle empty result when getting item by ID", async () => {
    readItemMock.mockResolvedValueOnce({ resource: null });

    const result = await getItemById(mockContainer, testID)();

    expect(mockContainer.item).toHaveBeenCalledWith(testID, testID);

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

  it("should upsert an item successfully", async () => {
    upsertMock.mockReturnValueOnce(Promise.resolve(void 0));

    const result = await upsertItem(mockUpsert, {
      id: testID,
      lease: testLease,
    })();

    expect(mockUpsert.items.upsert).toHaveBeenCalledWith({
      id: testID,
      lease: testLease,
    });

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(undefined);
    }
  });

  it("should handle errors during upsert", async () => {
    upsertMock.mockRejectedValueOnce(() => {
      throw new Error("Mock upsert error");
    });

    const result = await upsertItem(mockUpsert, {
      id: testID,
      lease: testLease,
    })();

    expect(mockUpsert.items.upsert).toHaveBeenCalledWith({
      id: testID,
      lease: testLease,
    });

    expect(E.isLeft(result)).toBeTruthy();
  });
});
