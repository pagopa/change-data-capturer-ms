/* eslint-disable no-var */
/* eslint-disable no-underscore-dangle */

import {
  ChangeFeedIteratorOptions,
  ChangeFeedStartFrom,
  Container,
  StatusCodes,
} from "@azure/cosmos";
import * as E from "fp-ts/Either";
import { getChangeFeedIteratorOptions, processChangeFeed } from "../cosmos";
import { ContinuationTokenItem } from "../utils";

// const mockContinuationToken = { _tag: "Continuation", value: "token" };
// const mockBeginningIterator = { _tag: "Beginning" };

describe("getChangeFeedIteratorOptions", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  it("should return ChangeFeedIteratorOptions with Continuation when continuationToken is provided", () => {
    const continuationToken = "testToken";
    const maxItemCount = 10;

    // continuationMock.mockImplementationOnce((_) => mockContinuationToken);

    const result = getChangeFeedIteratorOptions(
      continuationToken,
      maxItemCount
    );

    expect(result).toEqual({
      changeFeedStartFrom: ChangeFeedStartFrom.Continuation(continuationToken),
      maxItemCount: 10,
    });
  });

  it("should return ChangeFeedIteratorOptions with Beginning when continuationToken is not provided", () => {
    const result = getChangeFeedIteratorOptions();

    expect(result).toEqual({
      changeFeedStartFrom: ChangeFeedStartFrom.Beginning(),
      maxItemCount: 1,
    });
  });
});

var getChangeFeedIteratorMock = jest.fn();
var upsertMock = jest.fn();
const mockProcessContainer: Container = {
  items: {
    getChangeFeedIterator: jest
      .fn()
      .mockReturnValue({ getAsyncIterator: getChangeFeedIteratorMock }),
    upsert: upsertMock,
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
    getChangeFeedIteratorMock.mockImplementationOnce(() => [
      {
        statusCode: StatusCodes.Created,
        continuationToken: "test-continuation-token",
      },
    ]);
    upsertMock.mockReturnValueOnce(() => Promise<void>);

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
    getChangeFeedIteratorMock.mockImplementationOnce(() => [
      {
        statusCode: StatusCodes.NotModified,
      },
    ]);
    upsertMock.mockReturnValueOnce(() => Promise<void>);

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

  it("should process change feed with errors", async () => {
    getChangeFeedIteratorMock.mockImplementationOnce(() => {
      throw new Error("");
    });
    upsertMock.mockReturnValueOnce(() => Promise<void>);

    const changeFeedIteratorOptions: ChangeFeedIteratorOptions = {
      maxItemCount: 1,
      changeFeedStartFrom: ChangeFeedStartFrom.Beginning(),
    };

    const result = await processChangeFeed(
      mockProcessContainer,
      changeFeedIteratorOptions,
      mockLeaseContainer
    )();

    expect(E.isLeft(result)).toBeTruthy();
  });
});
