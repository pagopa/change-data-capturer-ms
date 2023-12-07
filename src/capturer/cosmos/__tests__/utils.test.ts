/* eslint-disable no-var */
/* eslint-disable no-underscore-dangle */
import "@azure/cosmos";
import { Container, CosmosClient } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { cosmosConnect, getItemById, upsertItem } from "../utils";

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
      {
        throw error;
      }
    });
    const result = cosmosConnect(endpoint, key);

    expect(CosmosClient).toHaveBeenCalledWith({ endpoint, key });
    expect(result).toEqual(
      E.left(new Error(`Impossible to connect to Cosmos: " ${String(error)}`))
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

describe("getItemById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("should get item by ID successfully", async () => {
    const id = "test-id";
    const expectedResult = { id: testID, lease: testLease };

    itemReadMock.mockReturnValueOnce(
      Promise.resolve({ resource: expectedResult })
    );

    const result = await getItemById(mockContainer, id)();

    expect(mockContainer.item).toHaveBeenCalledWith(id, id);
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
    itemReadMock.mockRejectedValueOnce(new Error("Mock error"));
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
    itemReadMock.mockResolvedValueOnce({ resource: null });

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