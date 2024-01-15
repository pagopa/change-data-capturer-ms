import * as E from "fp-ts/Either";
import {
  Binary,
  ChangeStream,
  ChangeStreamDocument,
  Collection,
} from "mongodb";
import { setMongoListenerOnEventChange, watchMongoCollection } from "../mongo";

const mockWatchFunction = jest.fn();
const mockOnChangeFunction = jest.fn();

const mockCollection: Collection = {
  watch: mockWatchFunction,
  collectionName: "mockCollection",
} as unknown as Collection;

const mockChangeStream: ChangeStream<
  Document,
  ChangeStreamDocument<Document>
> = {
  on: mockOnChangeFunction,
} as unknown as ChangeStream<Document, ChangeStreamDocument<Document>>;

describe("watchMongoCollection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return Either with ChangeStream on successful watch", () => {
    const resumeToken = "someResumeToken";
    const result = watchMongoCollection(mockCollection, resumeToken);

    expect(E.isRight(result)).toBe(true);
    expect(mockWatchFunction).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            operationType: { $in: ["insert", "update", "replace"] },
          },
        },
        {
          $project: {
            _id: 1,
            fullDocument: 1,
            ns: 1,
            documentKey: 1,
          },
        },
      ]),
      expect.objectContaining({
        resumeAfter: {
          _data: expect.any(Binary),
        },
      }),
    );
  });

  it("should return Either with Error on watch failure", () => {
    const resumeToken = "someResumeToken";
    mockWatchFunction.mockImplementation(() => {
      throw new Error("Watch failed");
    });

    const result = watchMongoCollection(mockCollection, resumeToken);

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error("Impossible to watch the mockCollection collection"),
      );
    }
  });
});

describe("setMongoListenerOnEventChange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return Either with void on successful listener setup", () => {
    const result = setMongoListenerOnEventChange(mockChangeStream, jest.fn());

    expect(E.isRight(result)).toBe(true);
    expect(mockOnChangeFunction).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("should return Either with Error on listener setup failure", () => {
    mockOnChangeFunction.mockImplementation(() => {
      throw new Error("Listener setup failed");
    });

    const result = setMongoListenerOnEventChange(mockChangeStream, jest.fn());

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error(
          'Impossible to set the listener: " Error: Listener setup failed',
        ),
      );
    }
  });
});
