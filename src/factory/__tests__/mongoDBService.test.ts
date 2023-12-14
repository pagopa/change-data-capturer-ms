import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { left, right } from "fp-ts/lib/Either";
import { Collection, Db, MongoClient } from "mongodb";
import { ContinuationTokenItem } from "../../capturer/cosmos/utils";
import * as MongoUtils from "../../capturer/mongo/utils";
import { mongoDBService } from "../mongoDBService";

const mockMongoClient: MongoClient = {} as MongoClient;
const mockDatabase: Db = {} as Db;
const mockCollection: Collection = {} as Collection;
const mockItem: ContinuationTokenItem = { id: "test" } as ContinuationTokenItem;

jest.mock("../../capturer/mongo/utils");

const mongoConnectSpy = jest.spyOn(MongoUtils, "mongoConnect");
const getMongoDbSpy = jest.spyOn(MongoUtils, "getMongoDb");
const getMongoCollectionSpy = jest.spyOn(MongoUtils, "getMongoCollection");
const findDocumentByIDSpy = jest.spyOn(MongoUtils, "findDocumentByID");

describe("mongoDBService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should connect to Mongo successfully", async () => {
    mongoConnectSpy.mockImplementationOnce(() => TE.right(mockMongoClient));
    const result = await mongoDBService.connect({
      connection: "valid-connection",
    })();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockMongoClient));
  });

  it("should handle connection error", async () => {
    mongoConnectSpy.mockImplementationOnce(() =>
      TE.left(new Error("Connection error")),
    );
    const result = await mongoDBService.connect({
      connection: "invalid-connection",
    })();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Connection error")));
  });

  it("should get database successfully", () => {
    getMongoDbSpy.mockImplementationOnce(() => right(mockDatabase));
    const result = mongoDBService.getDatabase(mockMongoClient, "test-database");
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockDatabase));
  });

  it("should handle error when getting database", () => {
    getMongoDbSpy.mockImplementationOnce(() =>
      left(new Error("Database error")),
    );
    const result = mongoDBService.getDatabase(
      mockMongoClient,
      "invalid-database",
    );
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Database error")));
  });

  it("should get resource successfully", async () => {
    getMongoCollectionSpy.mockImplementationOnce(() =>
      TE.right(mockCollection),
    );
    const result = await mongoDBService.getResource(
      mockDatabase,
      "test-collection",
    )();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockCollection));
  });

  it("should handle error when getting resource", async () => {
    getMongoCollectionSpy.mockImplementationOnce(() =>
      TE.left(new Error("Container error")),
    );
    const result = await mongoDBService.getResource(
      mockDatabase,
      "invalid-collection",
    )();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Container error")));
  });

  it("should get item by id succesfully", async () => {
    findDocumentByIDSpy.mockImplementationOnce(() =>
      TE.right(O.fromNullable(mockItem)),
    );
    const result = await mongoDBService.getItemByID(mockCollection, "testID")();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(O.fromNullable(mockItem)));
  });

  it("should handle error when getting item by id", async () => {
    findDocumentByIDSpy.mockImplementationOnce(() =>
      TE.left(new Error("Item error")),
    );
    const result = await mongoDBService.getItemByID(mockCollection, "testID")();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Item error")));
  });
});
