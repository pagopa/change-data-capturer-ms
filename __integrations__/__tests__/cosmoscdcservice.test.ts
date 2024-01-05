import * as TE from "fp-ts/lib/TaskEither";

import { Container, CosmosClient } from "@azure/cosmos";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { ServiceType, createDatabaseService } from "../../index";
import { setShouldExitExternal } from "../../src/capturer/cosmos/cosmos";
import {
  ContinuationTokenItem,
  getCosmosConfig,
  upsertItem,
} from "../../src/capturer/cosmos/utils";
import { LEASE_CONTAINER_NAME } from "../../src/factory/cosmosCDCService";
import { cosmosDBService } from "../../src/factory/cosmosDBService";
import { COSMOSDB_CONNECTION_STRING, COSMOSDB_NAME } from "../env";
import {
  COSMOS_COLLECTION_NAME,
  COSMOS_LEASE_COLLECTION_NAME,
  createCosmosDbAndCollections,
} from "../utils/cosmos";

const service = createDatabaseService(ServiceType.Cosmos);
const PREFIX = "prefix";
beforeAll(async () => {
  await pipe(
    getCosmosConfig(COSMOSDB_CONNECTION_STRING),
    TE.fromEither,
    TE.chain((config) =>
      createCosmosDbAndCollections(
        new CosmosClient({ endpoint: config.endpoint, key: config.key }),
        COSMOSDB_NAME,
      ),
    ),
    TE.getOrElse((e) => {
      throw Error(`Cannot create db ${e.message}`);
    }),
  )();
}, 60000);

describe("cosmosCDCService", () => {
  it("should handle incorrect ConnectionString - Error", async () => {
    const result = await service.processChangeFeed(
      `AccountEndpoint=https://localhost:8081;AccountKey=myAccountKey123;`,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
    )(cosmosDBService)();
    expect(E.isLeft(result)).toBeTruthy();
  });

  it("should handle incorrect database name - Error", async () => {
    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      "not-existing-database",
      COSMOS_COLLECTION_NAME,
    )(cosmosDBService)();
    expect(result).toEqual(
      E.left(new Error(`Impossible to get database not-existing-database`)),
    );
  });

  it("should handle incorrect container name - Error", async () => {
    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      COSMOSDB_NAME,
      "not-existing-collection",
    )(cosmosDBService)();
    expect(result).toEqual(
      E.left(new Error(`Impossible to get container not-existing-collection`)),
    );
  });

  it("should handle incorrect lease container name - Error", async () => {
    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      "not-existing-lease-container",
    )(cosmosDBService)();
    expect(result).toEqual(
      E.left(
        new Error(`Impossible to get container not-existing-lease-container`),
      ),
    );
  });

  it("should use default lease container when not passed in parameters - No continuation token", async () => {
    setTimeout(() => {
      setShouldExitExternal(true);
    }, 8000);

    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();
  }, 10000);

  it("should use default lease container when not passed in parameters - With continuation token", async () => {
    setTimeout(() => {
      setShouldExitExternal(true);
    }, 8000);

    await pipe(
      TE.Do,
      TE.bind("database", () =>
        service.getDatabase(
          new CosmosClient(COSMOSDB_CONNECTION_STRING),
          COSMOSDB_NAME,
        ),
      ),
      TE.bind("leaseContainer", ({ database }) =>
        service.getResource(database, LEASE_CONTAINER_NAME),
      ),
      TE.chainFirst(({ leaseContainer }) =>
        upsertItem<ContinuationTokenItem>(
          leaseContainer as Container,
          {
            id: "integration-tests",
            lease:
              '{"rid":"CqFyAMKO4yw=","Continuation":[{"minInclusive":"","maxExclusive":"FF","continuationToken":"\\"0\\""}]}',
          } as ContinuationTokenItem,
        ),
      ),
    )();

    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();
  }, 10000);

  it("should use provided lease container when passed in parameters with no prefix - No continuation token", async () => {
    setTimeout(() => {
      setShouldExitExternal(true);
    }, 8000);

    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      COSMOS_LEASE_COLLECTION_NAME,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();
  }, 10000);

  it("should use provided lease container when passed in parameters with no prefix - With continuation token", async () => {
    setTimeout(() => {
      setShouldExitExternal(true);
    }, 8000);

    await pipe(
      TE.Do,
      TE.bind("database", () =>
        service.getDatabase(
          new CosmosClient(COSMOSDB_CONNECTION_STRING),
          COSMOSDB_NAME,
        ),
      ),
      TE.bind("leaseContainer", ({ database }) =>
        service.getResource(database, COSMOS_LEASE_COLLECTION_NAME),
      ),
      TE.chainFirst(({ leaseContainer }) =>
        upsertItem<ContinuationTokenItem>(
          leaseContainer as Container,
          {
            id: "integration-tests",
            lease:
              '{"rid":"CqFyAMKO4yw=","Continuation":[{"minInclusive":"","maxExclusive":"FF","continuationToken":"\\"0\\""}]}',
          } as ContinuationTokenItem,
        ),
      ),
    )();

    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      COSMOS_LEASE_COLLECTION_NAME,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();
  }, 10000);

  it("should use provided lease container when passed in parameters with prefix - No continuation token", async () => {
    setTimeout(() => {
      setShouldExitExternal(true);
    }, 8000);

    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      COSMOS_LEASE_COLLECTION_NAME,
      PREFIX,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();
  }, 10000);

  it("should use provided lease container when passed in parameters with no prefix - With continuation token", async () => {
    setTimeout(() => {
      setShouldExitExternal(true);
    }, 8000);

    await pipe(
      TE.Do,
      TE.bind("database", () =>
        service.getDatabase(
          new CosmosClient(COSMOSDB_CONNECTION_STRING),
          COSMOSDB_NAME,
        ),
      ),
      TE.bind("leaseContainer", ({ database }) =>
        service.getResource(database, COSMOS_LEASE_COLLECTION_NAME),
      ),
      TE.chainFirst(({ leaseContainer }) =>
        upsertItem<ContinuationTokenItem>(
          leaseContainer as Container,
          {
            id: "integration-tests",
            lease:
              '{"rid":"CqFyAMKO4yw=","Continuation":[{"minInclusive":"","maxExclusive":"FF","continuationToken":"\\"0\\""}]}',
          } as ContinuationTokenItem,
        ),
      ),
    )();

    const result = await service.processChangeFeed(
      COSMOSDB_CONNECTION_STRING,
      COSMOSDB_NAME,
      COSMOS_COLLECTION_NAME,
      COSMOS_LEASE_COLLECTION_NAME,
      PREFIX,
    )(cosmosDBService)();
    expect(E.isRight(result)).toBeTruthy();
  }, 10000);
});
