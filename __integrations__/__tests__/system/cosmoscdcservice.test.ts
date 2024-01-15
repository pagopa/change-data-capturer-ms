import { CosmosClient } from "@azure/cosmos";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
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
      throw Error(`Cannot delete db ${JSON.stringify(e)}`);
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
});
