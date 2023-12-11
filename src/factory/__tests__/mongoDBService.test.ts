import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { left, right } from "fp-ts/lib/Either";
import { Collection, Db, MongoClient } from "mongodb";
import { ContinuationTokenItem } from "../../capturer/cosmos/utils";
import {
    findDocumentByID,
    getMongoCollection,
    getMongoDb,
    mongoConnect,
} from "../../capturer/mongo/utils";
import { mongoDBService } from "../mongoDBService";

const mockMongoClient: MongoClient = {} as MongoClient;
const mockDatabase: Db = {} as Db;
const mockCollection: Collection = {} as Collection;
const mockItem: ContinuationTokenItem = { id: "test" } as ContinuationTokenItem;

jest.mock("../../capturer/mongo/utils");

describe("mongoDBService", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should connect to Mongo successfully", async () => {
    (mongoConnect as jest.Mock).mockImplementationOnce(() =>
      TE.right(mockMongoClient)
    );
    const result = await mongoDBService.connect({
      connection: "valid-connection",
    })();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockMongoClient));
  });

  it("should handle connection error", async () => {
    (mongoConnect as jest.Mock).mockImplementationOnce(() =>
      TE.left(new Error("Connection error"))
    );
    const result = await mongoDBService.connect({
      connection: "invalid-connection",
    })();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Connection error")));
  });

  it("should get database successfully", () => {
    (getMongoDb as jest.Mock).mockImplementationOnce(() => right(mockDatabase));
    const result = mongoDBService.getDatabase(mockMongoClient, "test-database");
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockDatabase));
  });

  it("should handle error when getting database", () => {
    (getMongoDb as jest.Mock).mockImplementationOnce(() =>
      left(new Error("Database error"))
    );
    const result = mongoDBService.getDatabase(
      mockMongoClient,
      "invalid-database"
    );
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Database error")));
  });

  it("should get resource successfully", async () => {
    (getMongoCollection as jest.Mock).mockImplementationOnce(() =>
      TE.rightTask(() => Promise.resolve(mockCollection))
    );
    const result = await mongoDBService.getResource(
      mockDatabase,
      "test-collection"
    )();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockCollection));
  });

  it("should handle error when getting resource", async () => {
    (getMongoCollection as jest.Mock).mockImplementationOnce(() =>
      TE.leftTask(() => Promise.resolve(new Error("Container error")))
    );
    const result = await mongoDBService.getResource(
      mockDatabase,
      "invalid-collection"
    )();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Container error")));
  });

  it("should get item by id succesfully", async () => {
    (findDocumentByID as jest.Mock).mockImplementationOnce(() =>
      TE.rightTask(() => Promise.resolve(mockItem))
    );
    const result = await mongoDBService.getItemByID(mockCollection, "testID")();
    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(right(mockItem));
  });

  it("should handle error when getting item by id", async () => {
    (findDocumentByID as jest.Mock).mockImplementationOnce(() =>
      TE.leftTask(() => Promise.resolve(new Error("Item error")))
    );
    const result = await mongoDBService.getItemByID(mockCollection, "testID")();
    expect(E.isLeft(result)).toBeTruthy();
    expect(result).toEqual(left(new Error("Item error")));
  });
});
