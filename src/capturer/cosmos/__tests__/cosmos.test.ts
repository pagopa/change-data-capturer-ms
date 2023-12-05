/* eslint-disable no-underscore-dangle */
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
import { ContinuationTokenItem } from "../utils";

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

const testLease = "test-lease";

const mockContainer: Container = {
  items: {
    query: jest.fn(),
    upsert: jest.fn(),
  },
  id: testLease,
} as unknown as Container;

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

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        changeFeedStartFrom: {
          _tag: "Continuation",
          value: "token",
        },
        maxItemCount: 10,
      });
    }
  });

  it("should return ChangeFeedIteratorOptions with Beginning when continuationToken is not provided", () => {
    const result = getChangeFeedIteratorOptions();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual({
        changeFeedStartFrom: {
          _tag: "Beginning",
        },
        maxItemCount: 1,
      });
    }
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

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(undefined);
    }

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

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(undefined);
    }

    expect(
      mockProcessContainer.items.getChangeFeedIterator
    ).toHaveBeenCalledWith(changeFeedIteratorOptions);
    expect(mockLeaseContainer.items.upsert).toHaveBeenCalledTimes(0);
  });
});
