import * as O from "fp-ts/Option";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { Collection, MongoClient } from "mongodb";
import {
  disconnectMongo,
  insertDocument,
} from "../../../../src/capturer/mongo/utils";
import {
  ServiceType,
  createDatabaseService,
} from "../../../../src/factory/factory";
import { MONGO_LEASE_COLLECTION_NAME } from "../../../../src/factory/mongoCDCService";
import { mongoDBService } from "../../../../src/factory/mongoDBService";
import { Item } from "../../../../src/factory/service";
import { MONGODB_CONNECTION_STRING, MONGODB_NAME } from "../../../env";
import {
  MONGO_COLLECTION_NAME,
  createMongoClient,
  createMongoDBAndCollections,
  deleteDatabase,
} from "../../../utils/mongo";
const service = createDatabaseService(ServiceType.MongoDB);
var clients: MongoClient[] = [];

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
  setTimeout(async () => {
    for (var client of clients) {
      if (client) {
        await client.close();
      }
    }
  }, 10000);
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
}, 20000);

const processResults = (
  _: ReadonlyArray<unknown>,
): TE.TaskEither<Error, void> => {
  return TE.right(void 0);
};

describe("error handling", () => {
  it("should handle incorrect ConnectionString - Error", async () => {
    const client = new MongoClient("mongodb://test:error@localhost:9999");
    const result = await service.processChangeFeed(
      client,
      MONGODB_NAME,
      MONGO_COLLECTION_NAME,
      processResults,
    )(mongoDBService)();
    await client.close();
    expect(result).toEqual(
      E.left(new Error(`Impossible to get collection integration-collection`)),
    );
  }, 60000);

  it("should handle incorrect database name - Error", async () => {
    const client = new MongoClient(MONGODB_CONNECTION_STRING);
    const result = await service.processChangeFeed(
      client,
      "not-existing-database",
      MONGO_COLLECTION_NAME,
      processResults,
    )(mongoDBService)();
    await client.close();
    expect(result).toEqual(
      E.left(new Error(`Collection integration-collection does not exists`)),
    );
  });

  it("should handle incorrect container name - Error", async () => {
    const client = new MongoClient(MONGODB_CONNECTION_STRING);
    const result = await service.processChangeFeed(
      client,
      MONGODB_NAME,
      "not-existing-collection",
      processResults,
    )(mongoDBService)();
    await client.close();
    expect(result).toEqual(
      E.left(new Error(`Collection not-existing-collection does not exists`)),
    );
  });

  it("should handle incorrect lease container name - Error", async () => {
    const client = new MongoClient(MONGODB_CONNECTION_STRING);
    const result = await service.processChangeFeed(
      client,
      MONGODB_NAME,
      MONGO_COLLECTION_NAME,
      processResults,
      "not-existing-collection",
    )(mongoDBService)();
    await client.close();
    expect(result).toEqual(
      E.left(new Error(`Collection not-existing-collection does not exists`)),
    );
  });
});

const simulateAsyncPause = () =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 3000);
  });

describe("cdc service", () => {
  it("should process table content starting from beginning - no continuation token, default lease container", async () => {
    const client = new MongoClient(MONGODB_CONNECTION_STRING);
    clients.push(client);
    // Checking that no lease container exists
    const container = await pipe(
      client,
      (client) => service.getDatabase(client, MONGODB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, MONGO_LEASE_COLLECTION_NAME)),
      ),
    )();

    expect(container).toEqual(
      E.left(
        new Error(`Collection ${MONGO_LEASE_COLLECTION_NAME} does not exists`),
      ),
    );

    //Processing feed
    const result = await service.processChangeFeed(
      client,
      MONGODB_NAME,
      MONGO_COLLECTION_NAME,
      processResults,
      undefined,
      { timeout: 10000 },
    )(mongoDBService)();

    expect(E.isRight(result)).toBeTruthy();

    await simulateAsyncPause();

    await pipe(
      client,
      (client) => service.getDatabase(client, MONGODB_NAME),
      // Checking that the lease container have been created
      TE.chain((database) =>
        pipe(
          service.getResource(database, MONGO_COLLECTION_NAME),
          TE.chain((resource) =>
            pipe(
              insertDocument(resource as Collection, {
                id: "some_id",
                field: "some_field",
              }),
            ),
          ),
          TE.chain(() =>
            pipe(service.getResource(database, MONGO_LEASE_COLLECTION_NAME)),
          ),
          TE.chain((container) =>
            service.getItemByID(container, MONGO_COLLECTION_NAME),
          ),
        ),
      ),
    )();

    await simulateAsyncPause();

    const item = await pipe(
      client,
      (client) => service.getDatabase(client, MONGODB_NAME),
      // Checking that the lease container have been created
      TE.chain((database) =>
        pipe(
          service.getResource(database, MONGO_COLLECTION_NAME),
          TE.chain(() =>
            pipe(service.getResource(database, MONGO_LEASE_COLLECTION_NAME)),
          ),
          TE.chain((container) =>
            service.getItemByID(container, MONGO_COLLECTION_NAME),
          ),
        ),
      ),
    )();

    //Checking that the continuation token has been created
    if (E.isRight(item)) {
      expect(O.isSome(item.right)).toBeTruthy();
      const value = O.getOrElse<Item>(() => fail(""))(item.right);
      expect(value).toHaveProperty("lease");
      expect(value).toHaveProperty("id");
      expect(value.lease).toHaveProperty("_data");
    }
  }, 15000);

  // it("should process table content starting from continuation token", async () => {
  //   // Checking that the lease container already exists
  //   const client = new MongoClient(MONGODB_CONNECTION_STRING);
  //   clients.push(client);

  //   const item = await pipe(
  //     service.getDatabase(client, MONGODB_NAME),
  //     TE.chain((database) =>
  //       pipe(service.getResource(database, MONGO_LEASE_COLLECTION_NAME)),
  //     ),
  //     TE.chain((container) =>
  //       service.getItemByID(container, MONGO_COLLECTION_NAME),
  //     ),
  //   )();

  //   if (E.isRight(item)) {
  //     expect(O.isSome(item.right)).toBeTruthy();
  //   }

  //   await simulateAsyncPause();
  //   //Processing feed
  //   await service.processChangeFeed(
  //     client,
  //     MONGODB_NAME,
  //     MONGO_COLLECTION_NAME,
  //     processResults,
  //     undefined,
  //     { timeout: 10000 },
  //   )(mongoDBService)();

  //   await simulateAsyncPause();

  //   //Getting continuation token
  //   const continuationToken = await pipe(
  //     service.getDatabase(client, MONGODB_NAME),
  //     TE.chain((database) =>
  //       pipe(service.getResource(database, MONGO_LEASE_COLLECTION_NAME)),
  //     ),
  //     TE.chain((container) =>
  //       service.getItemByID(container, MONGO_COLLECTION_NAME),
  //     ),
  //   )();

  //   if (E.isRight(continuationToken)) {
  //     expect(O.isSome(continuationToken.right)).toBeTruthy();
  //     const continuationTokenItem = O.getOrElse<Item>(() => fail(""))(
  //       continuationToken.right,
  //     );
  //     if (E.isRight(item)) {
  //       const itemValue = O.getOrElse<Item>(() => fail(""))(item.right);
  //       //Checking that the continuation token has not been incremented and no records have been processed
  //       expect(itemValue.lease._data).toEqual(
  //         continuationTokenItem.lease._data,
  //       );
  //     }
  //   }
  // }, 15000);

  // it("should process table content starting from continuation token - insert new item and check the continuation token", async () => {
  //   const client = new MongoClient(MONGODB_CONNECTION_STRING);
  //   clients.push(client);

  //   // Checking that the lease container already exists and getting the continuation token
  //   const item = await pipe(
  //     service.getDatabase(client, MONGODB_NAME),
  //     TE.chain((database) =>
  //       pipe(service.getResource(database, MONGO_LEASE_COLLECTION_NAME)),
  //     ),
  //     TE.chain((container) =>
  //       service.getItemByID(container, MONGO_COLLECTION_NAME),
  //     ),
  //   )();
  //   if (E.isRight(item)) {
  //     expect(O.isSome(item.right)).toBeTruthy();
  //   }

  //   await simulateAsyncPause();
  //   //Processing feed
  //   await service.processChangeFeed(
  //     client,
  //     MONGODB_NAME,
  //     MONGO_COLLECTION_NAME,
  //     processResults,
  //     undefined,
  //     { timeout: 10000 },
  //   )(mongoDBService)();

  //   await simulateAsyncPause();

  //   //Inserting new item
  //   const insert = await pipe(
  //     service.getDatabase(client, MONGODB_NAME),
  //     TE.chain((database) =>
  //       pipe(service.getResource(database, MONGO_LEASE_COLLECTION_NAME)),
  //     ),
  //     TE.chain((collection) =>
  //       insertDocument(collection as Collection, { id: "newItem" }),
  //     ),
  //   )();
  //   expect(E.isRight(insert)).toBeTruthy();

  //   await simulateAsyncPause();

  //   //Getting continuation token
  //   const continuationToken = await pipe(
  //     service.getDatabase(client, MONGODB_NAME),
  //     TE.chain((database) =>
  //       pipe(service.getResource(database, MONGO_LEASE_COLLECTION_NAME)),
  //     ),
  //     TE.chain((container) =>
  //       service.getItemByID(container, MONGO_COLLECTION_NAME),
  //     ),
  //   )();

  //   if (E.isRight(continuationToken)) {
  //     expect(O.isSome(continuationToken.right)).toBeTruthy();
  //     const continuationTokenItem = O.getOrElse<Item>(() => fail(""))(
  //       continuationToken.right,
  //     );
  //     if (E.isRight(item)) {
  //       const itemValue = O.getOrElse<Item>(() => fail(""))(item.right);
  //       //Checking that the continuation token has been incremented and new records have been processed
  //       expect(itemValue.lease._data).toEqual(
  //         continuationTokenItem.lease._data,
  //       );
  //     }
  //   }
  // }, 15000);
});
