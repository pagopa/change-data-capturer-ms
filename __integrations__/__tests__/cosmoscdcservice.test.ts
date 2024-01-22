import { Container, CosmosClient } from "@azure/cosmos";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { upsertItem } from "../../src/capturer/cosmos/utils";
import { LEASE_CONTAINER_NAME } from "../../src/factory/cosmosCDCService";
import { cosmosDBService } from "../../src/factory/cosmosDBService";
import { ServiceType, createDatabaseService } from "../../src/factory/factory";
import { Item } from "../../src/factory/service";
import { COSMOSDB_CONNECTION_STRING, COSMOSDB_NAME } from "../env";
import {
  COSMOS_COLLECTION_NAME,
  createCosmosDbAndCollections,
  deleteDatabase,
} from "../utils/cosmos";
const service = createDatabaseService(ServiceType.Cosmos);
const cosmosClient = new CosmosClient(COSMOSDB_CONNECTION_STRING);

beforeAll(async () => {
  await pipe(
    createCosmosDbAndCollections(cosmosClient, COSMOSDB_NAME),
    TE.getOrElse((e) => {
      throw Error(
        `Cannot initialize integration tests - ${JSON.stringify(e.message)}`,
      );
    }),
  )();
}, 60000);

afterAll(async () => {
  await pipe(
    deleteDatabase(cosmosClient, COSMOSDB_NAME),
    TE.getOrElse((e) => {
      throw Error(`Cannot delete db ${e.message}`);
    }),
  )();
});

const processResults = (
  _: ReadonlyArray<unknown>,
): TE.TaskEither<Error, void> => {
  return TE.right(void 0);
};

describe("cosmosCDCService", () => {
  it("should handle incorrect ConnectionString - Error", async () => {
    const result = await service.processChangeFeed(
      new CosmosClient(
        `AccountEndpoint=https://localhost:8081;AccountKey=myAccountKey123;`,
      ),
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      processResults,
    )(cosmosDBService)();
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should handle incorrect database name - Error", async () => {
    const result = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        service.processChangeFeed(
          client,
          "not-existing-database",
          COSMOS_COLLECTION_NAME,
          processResults,
        )(cosmosDBService),
      ),
    )();
    expect(result).toEqual(
      E.left(new Error(`Impossible to get database not-existing-database`)),
    );
  });

  it("should handle incorrect container name - Error", async () => {
    const result = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        service.processChangeFeed(
          client,
          COSMOSDB_NAME,
          "not-existing-collection",
          processResults,
        )(cosmosDBService),
      ),
    )();
    expect(result).toEqual(
      E.left(new Error(`Impossible to get container not-existing-collection`)),
    );
  });

  it("should handle incorrect lease container name - Error", async () => {
    const result = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        service.processChangeFeed(
          client,
          COSMOSDB_NAME,
          COSMOS_COLLECTION_NAME,
          processResults,
          "not-existing-lease-container",
        )(cosmosDBService),
      ),
    )();
    expect(result).toEqual(
      E.left(
        new Error(`Impossible to get container not-existing-lease-container`),
      ),
    );
  });

  it("should process table content starting from beginning - no continuation token, default lease container", async () => {
    // Checking that no lease container exists
    const container = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) => service.getDatabase(client, COSMOSDB_NAME)),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
    )();

    expect(container).toEqual(
      E.left(new Error(`Impossible to get container ${LEASE_CONTAINER_NAME}`)),
    );

    //Processing feed
    await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((cosmosClient) =>
        service.processChangeFeed(
          cosmosClient,
          COSMOSDB_NAME,
          COSMOS_COLLECTION_NAME,
          processResults,
          undefined,
          { timeout: 8000 },
        )(cosmosDBService),
      ),
    )();

    const item = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) => service.getDatabase(client, COSMOSDB_NAME)),
      // Checking that the lease container have been created
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) =>
        service.getItemByID(container, COSMOS_COLLECTION_NAME),
      ),
    )();
    //Checking that the continuation token has been created
    if (E.isRight(item)) {
      expect(O.isSome(item.right)).toBeTruthy();
      const value = O.getOrElse<Item>(() => fail(""))(item.right);
      expect(value).toHaveProperty("lease");
      expect(value).toHaveProperty("id");
      const lease = JSON.parse(value.lease);
      expect(lease).toHaveProperty("Continuation");
      expect(lease.Continuation).toHaveLength(1);
      expect(lease.Continuation[0]).toHaveProperty("continuationToken");
    }
  }, 60000);

  it("should process table content starting from continuation token", async () => {
    // Checking that the lease container already exists
    const item = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) => service.getDatabase(client, COSMOSDB_NAME)),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) =>
        service.getItemByID(container, COSMOS_COLLECTION_NAME),
      ),
    )();
    if (E.isRight(item)) {
      expect(O.isSome(item.right)).toBeTruthy();
    }

    //Processing feed
    await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((cosmosClient) =>
        service.processChangeFeed(
          cosmosClient,
          COSMOSDB_NAME,
          COSMOS_COLLECTION_NAME,
          processResults,
          undefined,
          { timeout: 8000 },
        )(cosmosDBService),
      ),
    )();

    //Getting continuation token
    const continuationToken = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) => service.getDatabase(client, COSMOSDB_NAME)),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) =>
        service.getItemByID(container, COSMOS_COLLECTION_NAME),
      ),
    )();

    if (E.isRight(continuationToken)) {
      expect(O.isSome(continuationToken.right)).toBeTruthy();
      const continuationTokenItem = O.getOrElse<Item>(() => fail(""))(
        continuationToken.right,
      );
      if (E.isRight(item)) {
        const itemValue = O.getOrElse<Item>(() => fail(""))(item.right);
        //Checking that the continuation token has not been incremented and no records have been processed
        expect(
          JSON.parse(itemValue.lease).Continuation[0].continuationToken,
        ).toEqual(
          JSON.parse(continuationTokenItem.lease).Continuation[0]
            .continuationToken,
        );
      }
    }
  }, 60000);

  it("should process table content starting from continuation token - insert new item and check the continuation token", async () => {
    // Checking that the lease container already exists and getting the continuation token
    const item = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) => service.getDatabase(client, COSMOSDB_NAME)),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) =>
        service.getItemByID(container, COSMOS_COLLECTION_NAME),
      ),
    )();
    if (E.isRight(item)) {
      expect(O.isSome(item.right)).toBeTruthy();
    }

    //Inserting new item
    const insert = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) => service.getDatabase(client, COSMOSDB_NAME)),
      TE.chain((database) =>
        pipe(service.getResource(database, COSMOS_COLLECTION_NAME)),
      ),
      TE.chain((container) =>
        upsertItem(container as Container, { id: "newItem" }),
      ),
    )();
    expect(E.isRight(insert)).toBeTruthy();

    //Processing feed
    await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((cosmosClient) =>
        service.processChangeFeed(
          cosmosClient,
          COSMOSDB_NAME,
          COSMOS_COLLECTION_NAME,
          processResults,
          undefined,
          { timeout: 8000 },
        )(cosmosDBService),
      ),
    )();

    //Getting continuation token
    const continuationToken = await pipe(
      cosmosDBService.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) => service.getDatabase(client, COSMOSDB_NAME)),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) =>
        service.getItemByID(container, COSMOS_COLLECTION_NAME),
      ),
    )();

    if (E.isRight(continuationToken)) {
      expect(O.isSome(continuationToken.right)).toBeTruthy();
      const continuationTokenItem = O.getOrElse<Item>(() => fail(""))(
        continuationToken.right,
      );
      if (E.isRight(item)) {
        const itemValue = O.getOrElse<Item>(() => fail(""))(item.right);
        //Checking that the continuation token has been incremented and new records have been processed
        expect(
          JSON.parse(itemValue.lease).Continuation[0].continuationToken,
        ).not.toEqual(
          JSON.parse(continuationTokenItem.lease).Continuation[0]
            .continuationToken,
        );
      }
    }
  }, 60000);
});
