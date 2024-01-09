import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { right } from "fp-ts/lib/Either";
import {
  ChangeStream,
  ChangeStreamDocument,
  Collection,
  Db,
  MongoClient,
} from "mongodb";
import * as MongoCapturer from "../../capturer/mongo/mongo";
import { watchMongoCollection } from "../../capturer/mongo/mongo";
import { mongoCDCService } from "../mongoCDCService";
import { IDatabaseService } from "../service";

const mockMongoClient: MongoClient = {} as MongoClient;
const mockDatabase: Db = {} as Db;
const mockCollection: Collection = {} as Collection;
const mockOnChangeFunction = jest.fn();

const mockChangeStream: ChangeStream<
  Document,
  ChangeStreamDocument<Document>
> = {
  on: mockOnChangeFunction,
} as unknown as ChangeStream<Document, ChangeStreamDocument<Document>>;

jest
  .spyOn(MongoCapturer, "watchMongoCollection")
  .mockImplementation(() => E.right(mockChangeStream));

const mockDBServiceClient = {
  getDatabase: jest.fn(),
  getResource: jest.fn(),
  connect: jest.fn(),
  getItemByID: jest.fn(),
} satisfies IDatabaseService;

describe("mongoCDCService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should process change feed successfully with resumeToken", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(TE.right(mockDatabase));
    mockDBServiceClient.getResource.mockReturnValue(TE.right(mockCollection));
    mockDBServiceClient.getItemByID.mockReturnValueOnce(
      TE.right(O.some({ id: "value", lease: "test" })),
    );
    const result = await mongoCDCService.processChangeFeed(
      mockMongoClient,
      "test-database",
      "test-container",
      "test-lease-container",
      "test-prefix",
    )(mockDBServiceClient)();

    expect(result).toEqual(right(undefined));
    expect(watchMongoCollection).toHaveBeenCalledWith(mockCollection, "test");
  });

  it("should process change feed successfully without lease", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(TE.right(mockDatabase));
    mockDBServiceClient.getResource.mockReturnValue(TE.right(mockCollection));
    mockDBServiceClient.getItemByID.mockReturnValueOnce(TE.right(O.none));
    const result = await mongoCDCService.processChangeFeed(
      mockMongoClient,
      "test-database",
      "test-container",
      "test-lease-container",
      "test-prefix",
    )(mockDBServiceClient)();

    expect(result).toEqual(right(undefined));
    expect(watchMongoCollection).toHaveBeenCalledWith(
      mockCollection,
      undefined,
    );
  });

  it("should handle error during change feed processing", async () => {
    mockDBServiceClient.getDatabase.mockReturnValueOnce(TE.right(mockDatabase));
    mockDBServiceClient.getResource.mockReturnValueOnce(
      TE.left(new Error("Impossible to get the container")),
    );

    const result = await mongoCDCService.processChangeFeed(
      mockMongoClient,
      "invalid-database",
      "invalid-container",
    )(mockDBServiceClient)();

    expect(result).toEqual(
      E.left(new Error("Impossible to get the container")),
    );
  });
});
