/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
import "@azure/cosmos";
import {
  ChangeFeedIteratorOptions,
  ChangeFeedStartFrom,
  Container,
  CosmosClient,
  StatusCodes,
} from "@azure/cosmos";
import * as E from "fp-ts/Either";
import { getChangeFeedIteratorOptions, processChangeFeed } from "../cosmos";
import {
  ContinuationTokenItem,
  cosmosConnect,
  getItemById,
  upsertItem,
} from "../utils";

const error = new Error("Connection error");

const mockCosmosClient: CosmosClient = {
  database: jest.fn(),
} as unknown as CosmosClient;

const mockContinuationToken = { _tag: "Continuation", value: "token" };
const mockBeginningIterator = { _tag: "Beginning" };

jest.mock("@azure/cosmos", () => ({
  CosmosClient: jest
    .fn()
    .mockImplementationOnce(() => mockCosmosClient)
    .mockImplementationOnce(() => {
      throw error;
    }),
  Container: jest.fn().mockImplementationOnce(() => mockContainer),
  ChangeFeedStartFrom: {
    Continuation: jest
      .fn()
      .mockImplementationOnce((_) => mockContinuationToken),
    Beginning: jest.fn().mockImplementationOnce(() => mockBeginningIterator),
  },
  StatusCodes: {
    NotModified: 304,
  },
}));

describe("cosmosConnect", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should connect to Cosmos successfully", async () => {
    const endpoint = "your-endpoint";
    const key = "your-key";

    const result = await cosmosConnect(endpoint, key)();
    expect(CosmosClient).toHaveBeenCalledWith({ endpoint, key });
    expect(result).toEqual(E.right(mockCosmosClient));
  });

  it("should handle connection error", async () => {
    const endpoint = "invalid-endpoint";
    const key = "invalid-key";

    const result = await cosmosConnect(endpoint, key)();
    expect(CosmosClient).toHaveBeenCalledWith({ endpoint, key });
    expect(result).toEqual(
      E.left(new Error(`Impossible to connect to Cosmos: " ${String(error)}`))
    );
  });
});

const testID = "test-id";
const testLease = "test-lease";

const mockContainer: Container = {
  items: {
    query: jest.fn(),
    upsert: jest.fn(),
  },
  id: testLease,
} as unknown as Container;

describe("getItemById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("should get item by ID successfully", async () => {
    const id = "test-id";
    const expectedResult = { id: testID, lease: testLease };

    (mockContainer.items.query as jest.Mock).mockReturnValueOnce({
      fetchAll: async () => ({
        resources: [expectedResult],
      }),
    });

    const result = await getItemById(mockContainer, id)();

    expect(mockContainer.items.query).toHaveBeenCalledWith({
      query: `SELECT * from c WHERE c.id = @id`,
      parameters: [{ name: "@id", value: id.replace(" ", "-") }],
    });

    const expectedTaskEitherResult = {
      _tag: "Right",
      right: { _tag: "Some", value: { id: "test-id", lease: "test-lease" } },
    };
    expect(result).toEqual(expectedTaskEitherResult);
  });

  it("should handle error when getting item by ID", async () => {
    (mockContainer.items.query as jest.Mock).mockReturnValueOnce({
      fetchAll: jest.fn().mockRejectedValueOnce(new Error("Mock error")),
    });
    const result = await getItemById(mockContainer, testID)();

    expect(mockContainer.items.query).toHaveBeenCalledWith({
      query: `SELECT * from c WHERE c.id = @id`,
      parameters: [{ name: "@id", value: testID.replace(" ", "-") }],
    });

    const expectedTaskEitherResult = {
      _tag: "Left",
      left: new Error(
        `Impossible to get item ${testID} from container ${testLease}: Error: Mock error`
      ),
    };

    expect(result).toEqual(expectedTaskEitherResult);
  });

  it("should handle empty result when getting item by ID", async () => {
    (mockContainer.items.query as jest.Mock).mockReturnValueOnce({
      fetchAll: jest.fn().mockResolvedValueOnce({ resources: [] }),
    });

    const result = await getItemById(mockContainer, testID)();

    expect(mockContainer.items.query).toHaveBeenCalledWith({
      query: `SELECT * from c WHERE c.id = @id`,
      parameters: [{ name: "@id", value: testID.replace(" ", "-") }],
    });

    const expectedTaskEitherResult = {
      _tag: "Right",
      right: { _tag: "None" },
    };
    expect(result).toEqual(expectedTaskEitherResult);
  });
});

describe("getChangeFeedIteratorOptions", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  it("should return ChangeFeedIteratorOptions with Continuation when continuationToken is provided", () => {
    const continuationToken = "testToken";
    const maxItemCount = 10;

    const result = getChangeFeedIteratorOptions(
      continuationToken,
      maxItemCount
    );

    const expectedOptions = {
      _tag: "Right",
      right: {
        changeFeedStartFrom: {
          _tag: "Continuation",
          value: "token",
        },
        maxItemCount: 10,
      },
    };

    expect(result).toEqual(expectedOptions);
  });

  it("should return ChangeFeedIteratorOptions with Beginning when continuationToken is not provided", () => {
    const result = getChangeFeedIteratorOptions();

    const expectedOptions = {
      _tag: "Right",
      right: {
        changeFeedStartFrom: {
          _tag: "Beginning",
        },
        maxItemCount: 1,
      },
    };

    expect(result).toEqual(expectedOptions);
  });
});

const mockProcessContainer: Container = {
  items: {
    getChangeFeedIterator: jest.fn(),
    upsert: jest.fn(),
  },
  id: "process",
} as unknown as Container;

const mockLeaseContainer: Container = {
  items: {
    upsert: jest.fn(),
  },
  id: "lease",
} as unknown as Container;
describe("getAndProcessChangeFeed", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  it("should process change feed successfully with lease updated", async () => {
    const mockResult = {
      statusCode: StatusCodes.Created,
      continuationToken: "test-continuation-token",
    };

    const mockChangeFeedIterator = {
      getAsyncIterator: jest.fn().mockImplementationOnce(() => [mockResult]),
    };

    (
      mockProcessContainer.items.getChangeFeedIterator as jest.Mock
    ).mockReturnValueOnce(mockChangeFeedIterator);

    (mockLeaseContainer.items.upsert as jest.Mock).mockReturnValueOnce(
      () => Promise<void>
    );

    const changeFeedIteratorOptions: ChangeFeedIteratorOptions = {
      maxItemCount: 1,
      changeFeedStartFrom: ChangeFeedStartFrom.Beginning(),
    };

    const result = await processChangeFeed(
      mockProcessContainer,
      changeFeedIteratorOptions,
      mockLeaseContainer
    )();

    expect(result).toEqual({ _tag: "Right", right: undefined });

    expect(
      mockProcessContainer.items.getChangeFeedIterator
    ).toHaveBeenCalledWith(changeFeedIteratorOptions);
    expect(mockLeaseContainer.items.upsert).toHaveBeenCalledWith({
      id: mockProcessContainer.id.replace(" ", "-"),
      lease: "test-continuation-token",
    } as ContinuationTokenItem);
  });

  it("should process change feed successfully without updating lease", async () => {
    const mockResult = {
      statusCode: StatusCodes.NotModified,
    };

    const mockChangeFeedIterator = {
      getAsyncIterator: jest.fn().mockImplementationOnce(() => [mockResult]),
    };

    (
      mockProcessContainer.items.getChangeFeedIterator as jest.Mock
    ).mockReturnValueOnce(mockChangeFeedIterator);

    (mockLeaseContainer.items.upsert as jest.Mock).mockReturnValueOnce(
      () => Promise<void>
    );

    const changeFeedIteratorOptions: ChangeFeedIteratorOptions = {
      maxItemCount: 1,
      changeFeedStartFrom: ChangeFeedStartFrom.Beginning(),
    };

    const result = await processChangeFeed(
      mockProcessContainer,
      changeFeedIteratorOptions,
      mockLeaseContainer
    )();

    expect(result).toEqual({ _tag: "Right", right: undefined });

    expect(
      mockProcessContainer.items.getChangeFeedIterator
    ).toHaveBeenCalledWith(changeFeedIteratorOptions);
    expect(mockLeaseContainer.items.upsert).toHaveBeenCalledTimes(0);
  });
});

describe("upsertItem", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const mockUpsert: Container = {
    items: {
      upsert: jest.fn(),
    },
    id: "upsert",
  } as unknown as Container;
  it("should upsert an item successfully", async () => {
    (mockUpsert.items.upsert as jest.Mock).mockReturnValueOnce(
      () => Promise<void>
    );

    // Chiama la funzione upsertItem con il mockContainer e un oggetto fittizio
    const result = await upsertItem(mockUpsert, {
      id: "testId",
      lease: "testLease",
    })();

    expect(mockUpsert.items.upsert).toHaveBeenCalledWith({
      id: "testId",
      lease: "testLease",
    });

    expect(E.isRight(result)).toBe(true);
  });

  it("should handle errors during upsert", async () => {
    (mockUpsert.items.upsert as jest.Mock).mockRejectedValueOnce(() => {
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

    expect(E.isLeft(result)).toBe(true);
  });
});
