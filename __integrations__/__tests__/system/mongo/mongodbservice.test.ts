import * as O from "fp-ts/Option";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { Collection, Db, MongoClient } from "mongodb";
import { disconnectMongo } from "../../../../src/capturer/mongo/utils";
import {
  ServiceType,
  createDatabaseService,
} from "../../../../src/factory/factory";
import { MONGODB_CONNECTION_STRING, MONGODB_NAME } from "../../../env";
import {
  ID,
  MONGO_COLLECTION_NAME,
  createMongoClient,
  createMongoDBAndCollections,
  deleteDatabase,
} from "../../../utils/mongo";
const service = createDatabaseService(ServiceType.MongoDB);

beforeAll(async () => {
  await pipe(
    createMongoClient(MONGODB_CONNECTION_STRING),
    TE.chainFirst((client) =>
      pipe(
        createMongoDBAndCollections(client, MONGODB_NAME),
        TE.chain(() => disconnectMongo(client)),
      ),
    ),

    TE.getOrElse((e) => {
      throw Error(
        `Cannot initialize integration tests - ${JSON.stringify(e.message)}`,
      );
    }),
  )();
}, 10000);

afterAll(async () => {
  await pipe(
    createMongoClient(MONGODB_CONNECTION_STRING),
    TE.chainFirst((client) =>
      pipe(
        deleteDatabase(client, MONGODB_NAME),
        TE.chain(() => disconnectMongo(client)),
      ),
    ),
    TE.getOrElse((e) => {
      throw Error(`Cannot delete db ${JSON.stringify(e)}`);
    }),
  )();
}, 10000);

describe("connect", () => {
  it("should return error when trying to connect to a not valid cosmos endpoint", async () => {
    const result = await service.connect({ connection: "fake_connection" })();
    expect(result).toEqual(
      E.left(new Error(`Impossible to connect to MongoDB`)),
    );
  });

  it("should succesfully connect to Cosmos", async () => {
    const result = await service.connect({
      connection: MONGODB_CONNECTION_STRING,
    })();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const client = result.right as MongoClient;
      await client.close();
    }
  });
});

describe("getDatabase", () => {
  it("should return an existing database", async () => {
    const client = await service.connect({
      connection: MONGODB_CONNECTION_STRING,
    })();
    if (E.isRight(client)) {
      const mongoClient = client.right as MongoClient;
      const result = await service.getDatabase(mongoClient, MONGODB_NAME)();
      expect(E.isRight(result)).toBeTruthy();
      if (E.isRight(result)) {
        const database = result.right as Db;
        expect(database.databaseName).toEqual(MONGODB_NAME);
      }
      await mongoClient.close();
    } else {
      fail("Impossible to get a valid mongodb client");
    }
  });
});

describe("getResource", () => {
  it("should return error when trying to get a not existing resource", async () => {
    const client = await service.connect({
      connection: MONGODB_CONNECTION_STRING,
    })();
    if (E.isRight(client)) {
      const mongoClient = client.right as MongoClient;
      const result = await pipe(
        service.getDatabase(mongoClient, MONGODB_NAME),
        TE.chain((database) =>
          pipe(service.getResource(database, "fake_container")),
        ),
      )();

      expect(E.isLeft(result)).toBeTruthy();
      if (E.isLeft(result)) {
        expect(result.left).toEqual(
          new Error(`Collection fake_container does not exists`),
        );
      }
      await mongoClient.close();
    } else {
      fail("Impossible to get a valid mongodb client");
    }
  });

  it("should return an existing resource", async () => {
    const client = await service.connect({
      connection: MONGODB_CONNECTION_STRING,
    })();
    if (E.isRight(client)) {
      const mongoClient = client.right as MongoClient;
      const result = await pipe(
        service.getDatabase(mongoClient, MONGODB_NAME),
        TE.chain((database) =>
          pipe(service.getResource(database, MONGO_COLLECTION_NAME)),
        ),
      )();
      expect(E.isRight(result)).toBeTruthy();
      if (E.isRight(result)) {
        const container = result.right;
        expect((container as Collection).collectionName).toEqual(
          MONGO_COLLECTION_NAME,
        );
      }
      await mongoClient.close();
    } else {
      fail("Impossible to get a valid mongodb client");
    }
  });
});

describe("getItemById", () => {
  it("should return error when trying to get a not existing item", async () => {
    const client = await service.connect({
      connection: MONGODB_CONNECTION_STRING,
    })();
    if (E.isRight(client)) {
      const mongoClient = client.right as MongoClient;
      const result = await pipe(
        service.getDatabase(mongoClient, MONGODB_NAME),
        TE.chain((database) =>
          pipe(service.getResource(database, MONGO_COLLECTION_NAME)),
        ),
        TE.chain((resource) => pipe(service.getItemByID(resource, "fake_id"))),
      )();

      if (E.isLeft(result)) {
        expect(result.left).toEqual(
          new Error(
            `Impossible to get item fake_id from container ${MONGO_COLLECTION_NAME}`,
          ),
        );
      }
      await mongoClient.close();
    } else {
      fail("Impossible to get a valid mongodb client");
    }
  });

  it("should return an existing item", async () => {
    const client = await service.connect({
      connection: MONGODB_CONNECTION_STRING,
    })();
    if (E.isRight(client)) {
      const mongoClient = client.right as MongoClient;
      const result = await pipe(
        service.getDatabase(mongoClient, MONGODB_NAME),
        TE.chain((database) =>
          pipe(service.getResource(database, MONGO_COLLECTION_NAME)),
        ),
        TE.chain((resource) => service.getItemByID(resource, ID)),
      )();
      expect(E.isRight(result)).toBeTruthy();
      if (E.isRight(result)) {
        const resource = result.right;
        if (O.isSome(resource)) {
          expect(resource.value.id).toEqual(ID);
        }
      }
      await mongoClient.close();
    } else {
      fail("Impossible to get a valid mongodb client");
    }
  });
});
