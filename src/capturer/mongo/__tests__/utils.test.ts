import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import {
  Collection,
  CollectionInfo,
  Db,
  InsertOneResult,
  ListCollectionsCursor,
  MongoClient,
} from "mongodb";
import {
  disconnectMongo,
  findDocumentByID,
  getMongoCollection,
  getMongoDb,
  getOrCreateMongoCollection,
  insertDocument,
} from "../utils";

jest.mock("mongodb", () => ({
  MongoClient: jest.fn(),
}));

const mockClient: MongoClient = {
  connect: jest.fn(),
  close: jest.fn(),
  db: jest.fn(),
} as unknown as MongoClient;

const mockDb: Db = {
  collection: jest.fn(),
  listCollections: jest.fn(),
  createCollection: jest.fn(),
} as unknown as Db;

const dbSpy = jest.spyOn(mockClient, "db");

describe("getMongoDb", () => {
  it("should get MongoDB database", async () => {
    dbSpy.mockReturnValueOnce(mockDb);

    const result = getMongoDb(mockClient, "mock-db");

    expect(result).toEqual(E.right(mockDb));
    expect(dbSpy).toHaveBeenCalledWith("mock-db");
  });

  const getDBError = new Error("Error while getting database");
  it("should handle error when getting database", async () => {
    dbSpy.mockImplementation(() => {
      throw getDBError;
    });

    const result = getMongoDb(mockClient, "mock-db");

    expect(result).toEqual(
      E.left(
        new Error(
          "Impossible to Get the mock-db db: Error: Error while getting database",
        ),
      ),
    );
    expect(dbSpy).toHaveBeenCalledWith("mock-db");
  });
});

const mockCollection: Collection = {
  find: jest.fn(),
  sort: jest.fn(),
  limit: jest.fn(),
  tryNext: jest.fn(),
  findOne: jest.fn(),
  insertOne: jest.fn(),
} as unknown as Collection;

const collectionName = "testCollection";
const mockToArray: CollectionInfo[] = [{ name: collectionName }];
const mockListCollectionsCursor: ListCollectionsCursor = {
  toArray: jest.fn,
} as unknown as ListCollectionsCursor;

const listCollectionsSpy = jest.spyOn(mockDb, "listCollections");
const toArraySpy = jest.spyOn(mockListCollectionsCursor, "toArray");
const collectionSpy = jest.spyOn(mockDb, "collection");

describe("getMongoCollection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should get MongoDB collection", async () => {
    listCollectionsSpy.mockReturnValueOnce(mockListCollectionsCursor);
    toArraySpy.mockResolvedValueOnce(mockToArray);
    collectionSpy.mockReturnValueOnce(mockCollection);

    const result = await getMongoCollection(mockDb, collectionName)();

    expect(mockDb.listCollections).toHaveBeenCalledWith({
      name: collectionName,
    });
    expect(collectionSpy).toHaveBeenCalledWith(collectionName);
    expect(result).toEqual(E.right(mockCollection));
  });

  it("should get empty MongoDB collection list ", async () => {
    listCollectionsSpy.mockReturnValueOnce(mockListCollectionsCursor);
    toArraySpy.mockResolvedValueOnce([]);
    collectionSpy.mockReturnValueOnce(mockCollection);

    const result = await getMongoCollection(mockDb, collectionName)();

    expect(mockDb.listCollections).toHaveBeenCalledWith({
      name: collectionName,
    });
    expect(collectionSpy).toHaveBeenCalledTimes(0);
    expect(result).toEqual(
      E.left(new Error(`Collection ${collectionName} does not exists`)),
    );
  });

  it("should handle error when getting collection", async () => {
    const error = new Error("Error while getting the collection");
    listCollectionsSpy.mockImplementationOnce(() => {
      throw error;
    });

    const result = await getMongoCollection(mockDb, collectionName)();

    expect(mockDb.listCollections).toHaveBeenCalledWith({
      name: collectionName,
    });
    expect(result).toEqual(
      E.left(
        new Error(
          "Impossible to Get the testCollection collection: Error: Error while getting the collection",
        ),
      ),
    );
  });
});
const createCollectionSpy = jest.spyOn(mockDb, "createCollection");

describe("getOrCreateMongoCollection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should get or create MongoDB collection", async () => {
    listCollectionsSpy.mockReturnValueOnce(mockListCollectionsCursor);
    toArraySpy.mockResolvedValueOnce(mockToArray);
    collectionSpy.mockReturnValueOnce(mockCollection);

    const result = await getOrCreateMongoCollection(mockDb, collectionName)();

    expect(mockDb.listCollections).toHaveBeenCalledWith({
      name: collectionName,
    });
    expect(collectionSpy).toHaveBeenCalledWith(collectionName);
    expect(result).toEqual(E.right(mockCollection));
  });

  it("should handle error when getting or creating collection", async () => {
    const error = new Error("Error while getting collection");
    listCollectionsSpy.mockImplementationOnce(() => {
      throw error;
    });

    const result = await getOrCreateMongoCollection(mockDb, collectionName)();

    expect(mockDb.listCollections).toHaveBeenCalledWith({
      name: collectionName,
    });
    expect(result).toEqual(
      E.left(
        new Error(
          "Impossible to Get the testCollection collection: Error: Error while getting collection",
        ),
      ),
    );
  });

  it("should create a MongoDB collection", async () => {
    listCollectionsSpy.mockReturnValueOnce(mockListCollectionsCursor);
    toArraySpy.mockResolvedValueOnce([]);
    collectionSpy.mockReturnValueOnce(mockCollection);
    createCollectionSpy.mockResolvedValueOnce(mockCollection);

    const result = await getOrCreateMongoCollection(mockDb, collectionName)();

    expect(mockDb.listCollections).toHaveBeenCalledWith({
      name: collectionName,
    });
    expect(collectionSpy).toHaveBeenCalledTimes(0);
    expect(createCollectionSpy).toHaveBeenCalledWith(collectionName);
    expect(mockDb.createCollection).toHaveBeenCalledWith(collectionName);
    expect(result).toEqual(E.right(mockCollection));
  });
});

const closeSpy = jest.spyOn(mockClient, "close");

describe("disconnectMongo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
  it("should get MongoDB client disconnected", async () => {
    closeSpy.mockResolvedValueOnce(void 0);

    const result = await disconnectMongo(mockClient)();

    expect(closeSpy).toHaveBeenCalledWith();
    expect(result).toEqual(E.right(void 0));
  });

  it("should handle error during client disconnection", async () => {
    closeSpy.mockImplementationOnce(() => {
      throw new Error("Error while disconnecting client");
    });

    const result = await disconnectMongo(mockClient)();

    expect(closeSpy).toHaveBeenCalledWith();
    expect(result).toEqual(
      E.left(
        new Error(
          `Impossible to disconnect the mongo client: Error: Error while disconnecting client`,
        ),
      ),
    );
  });
});

const testID = "testID";
const mockWithIDDocument = {
  _id: testID,
  test: "test",
};
const mockParameter = {
  id: testID,
};
describe("findDocumentByID", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const findOneSpy = jest.spyOn(mockCollection, "findOne");
  it("should get the document by ID", async () => {
    findOneSpy.mockResolvedValueOnce(mockWithIDDocument);
    const result = await findDocumentByID(mockCollection, testID)();

    expect(findOneSpy).toHaveBeenCalledWith(mockParameter);
    expect(result).toEqual(E.right(O.some(mockWithIDDocument)));
  });

  it("should handle error when getting the document by ID", async () => {
    const error = new Error("Error while getting document by ID");
    findOneSpy.mockImplementationOnce(() => {
      throw error;
    });

    const result = await findDocumentByID(mockCollection, testID)();

    expect(result).toEqual(
      E.left(
        new Error(
          `Unable to get the the document with ID ${testID} from collection: Error: Error while getting document by ID`,
        ),
      ),
    );
  });
});

const mockInsertOneResult = {} as unknown as InsertOneResult;
const document = { id: testID } as unknown as Document;
const insertOneSpy = jest.spyOn(mockCollection, "insertOne");
describe("insertDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should insert the document", async () => {
    insertOneSpy.mockResolvedValueOnce(mockInsertOneResult);
    const result = await insertDocument(mockCollection, document)();

    expect(insertOneSpy).toHaveBeenCalledWith(document);
    expect(result).toEqual(E.right(mockInsertOneResult));
  });

  it("should handle error when getting the document by ID", async () => {
    insertOneSpy.mockImplementationOnce(() => {
      throw new Error("Error while inserting the document");
    });

    const result = await insertDocument(mockCollection, document)();

    expect(result).toEqual(
      E.left(
        new Error(
          `Unable to insert the document: Error: Error while inserting the document`,
        ),
      ),
    );
  });
});
