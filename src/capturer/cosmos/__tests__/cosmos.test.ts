/* eslint-disable no-var */
/* eslint-disable no-underscore-dangle */
import {
  ChangeFeedIteratorOptions,
  ChangeFeedStartFrom,
  Container,
  StatusCodes,
} from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { ContinuationTokenItem } from "../../../factory/types";
import { getChangeFeedIteratorOptions, processChangeFeed } from "../cosmos";

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
      maxItemCount,
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

  const processResult = (_: ReadonlyArray<unknown>) => {
    return TE.of(void 0);
  };

  it("should process change feed successfully with lease updated", async () => {
    getChangeFeedIteratorMock.mockImplementationOnce(() => [
      {
        statusCode: StatusCodes.Created,
        continuationToken: "test-continuation-token",
        result: [{ id: "test-id", lease: "test-continuation-token" }],
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
      mockLeaseContainer,
      processResult,
    )();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(undefined);
    }

    expect(
      mockProcessContainer.items.getChangeFeedIterator,
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
      mockLeaseContainer,
      () => void 0,
    )();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      expect(result.right).toEqual(undefined);
    }

    expect(
      mockProcessContainer.items.getChangeFeedIterator,
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
      mockLeaseContainer,
      () => void 0,
    )();

    expect(E.isLeft(result)).toBeTruthy();
  });
});
