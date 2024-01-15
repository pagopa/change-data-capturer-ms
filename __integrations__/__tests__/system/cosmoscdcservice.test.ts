import { Container, CosmosClient } from "@azure/cosmos";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { upsertItem } from "../../../src/capturer/cosmos/utils";
import { LEASE_CONTAINER_NAME } from "../../../src/factory/cosmosCDCService";
import { cosmosDBService } from "../../../src/factory/cosmosDBService";
import {
  ServiceType,
  createDatabaseService,
} from "../../../src/factory/factory";
import { COSMOSDB_CONNECTION_STRING, COSMOSDB_NAME } from "../../env";
import {
  COSMOS_COLLECTION_NAME,
  createCosmosDbAndCollections,
  deleteDatabase,
} from "../../utils/cosmos";

const service = createDatabaseService(ServiceType.Cosmos);
const client = new CosmosClient(COSMOSDB_CONNECTION_STRING);
const PREFIX = "prefix";

beforeAll(async () => {
  await pipe(
    createCosmosDbAndCollections(client, COSMOSDB_NAME),
    TE.getOrElse((e) => {
      throw Error(
        `Cannot initialize integration tests - ${JSON.stringify(e.message)}`,
      );
    }),
  )();
}, 60000);

afterAll(async () => {
  await pipe(
    deleteDatabase(client, COSMOSDB_NAME),
    TE.getOrElse((e) => {
      throw Error(`Cannot delete db ${e.message}`);
    }),
  )();
});

const processResults = (
  _: ReadonlyArray<unknown>,
): TE.TaskEither<Error, void> => {
  console.log("ciao");
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
    const result = await service.processChangeFeed(
      client,
      "not-existing-database",
      COSMOS_COLLECTION_NAME,
      processResults,
    )(cosmosDBService)();
    expect(result).toEqual(
      E.left(new Error(`Impossible to get database not-existing-database`)),
    );
  });

  it("should handle incorrect container name - Error", async () => {
    const result = await service.processChangeFeed(
      client,
      COSMOSDB_NAME,
      "not-existing-collection",
      processResults,
    )(cosmosDBService)();
    expect(result).toEqual(
      E.left(new Error(`Impossible to get container not-existing-collection`)),
    );
  });

  it("should handle incorrect lease container name - Error", async () => {
    const result = await service.processChangeFeed(
      client,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      processResults,
      "not-existing-lease-container",
    )(cosmosDBService)();
    expect(result).toEqual(
      E.left(
        new Error(`Impossible to get container not-existing-lease-container`),
      ),
    );
  });

  it("should process table content starting from beginning - no continuation token, default lease container", async () => {
    // Checking that no lease container exists
    const container = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
    )();

    expect(container).toEqual(
      E.left(new Error(`Impossible to get container ${LEASE_CONTAINER_NAME}`)),
    );

    const result = await service.processChangeFeed(
      client,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      processResults,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();

    //Checking that the lease container has been created and the continuation token has been stored
    const item = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) => service.getItemByID(container, COSMOSDB_NAME)),
    )();
    expect(E.isRight(item)).toBeTruthy();
  }, 60000);

  it("should process table content starting from continuation token", async () => {
    // Checking that no lease container exists
    const item = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) => service.getItemByID(container, COSMOSDB_NAME)),
    )();
    expect(E.isRight(item)).toBeTruthy();

    const result = await service.processChangeFeed(
      client,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      processResults,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();

    const continuationToken = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) => service.getItemByID(container, COSMOSDB_NAME)),
    )();

    expect(E.isRight(continuationToken)).toBeTruthy();
    expect(item).toEqual(continuationToken);
  }, 60000);

  it("should process table content starting from continuation token - insert new item and check the continuation token", async () => {
    const item = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) => service.getItemByID(container, COSMOSDB_NAME)),
    )();
    expect(E.isRight(item)).toBeTruthy();

    const insert = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) =>
        upsertItem(container as Container, { id: "test" }),
      ),
    )();
    expect(E.isRight(insert)).toBeTruthy();

    const result = await service.processChangeFeed(
      client,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      processResults,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();

    const continuationToken = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, LEASE_CONTAINER_NAME)),
      ),
      TE.chain((container) => service.getItemByID(container, COSMOSDB_NAME)),
    )();

    expect(E.isRight(continuationToken)).toBeTruthy();
    expect(item).not.toEqual(continuationToken);
  }, 60000);
});
