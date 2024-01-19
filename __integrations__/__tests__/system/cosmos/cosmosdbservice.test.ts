import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { ServiceType, createDatabaseService } from "../../../../src/factory/factory";
import { COSMOSDB_CONNECTION_STRING, COSMOSDB_NAME } from "../../../env";
import {
  COSMOS_COLLECTION_NAME,
  ID,
  createCosmosDbAndCollections,
  deleteDatabase,
} from "../../../utils/cosmos";


const service = createDatabaseService(ServiceType.Cosmos);
const client = new CosmosClient(COSMOSDB_CONNECTION_STRING);

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

describe("connect", () => {
  it("should return error when trying to connect to a not valid cosmos endpoint", async () => {
    const result = await service.connect({ connection: "fake_connection" })();
    expect(result).toEqual(
      E.left(new Error(`Impossible to connect to Cosmos`)),
    );
  });

  it("should succesfully connect to Cosmos", async () => {
    const result = await service.connect({
      connection: COSMOSDB_CONNECTION_STRING,
    })();
    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("getDatabase", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.setTimeout(60000);
  });

  it("should return error when trying to get a not existing database", async () => {
    const result = await service.getDatabase(client, "fake_database")();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error(`Impossible to get database fake_database`),
      );
    }
  });

  it("should return an existing database", async () => {
    const result = await service.getDatabase(client, COSMOSDB_NAME)();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const database = result.right;
      expect((database as Database).id).toEqual(COSMOSDB_NAME);
    }
  });
});

describe("getResource", () => {
  it("should return error when trying to get a not existing resource", async () => {
    const result = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, "fake_container")),
      ),
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error(`Impossible to get container fake_container`),
      );
    }
  });

  it("should return an existing resource", async () => {
    const result = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, COSMOS_COLLECTION_NAME)),
      ),
    )();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const container = result.right;
      expect((container as Container).id).toEqual(COSMOS_COLLECTION_NAME);
    }
  });
});

describe("getItemById", () => {
  it("should return error when trying to get a not existing item", async () => {
    const result = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, COSMOS_COLLECTION_NAME)),
      ),
      TE.chain((resource) => pipe(service.getItemByID(resource, "fake_id"))),
    )();

    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error(
          `Impossible to get item fake_id from container ${COSMOS_COLLECTION_NAME}`,
        ),
      );
    }
  });

  it("should return an existing item", async () => {
    const result = await pipe(
      service.getDatabase(client, COSMOSDB_NAME),
      TE.chain((database) =>
        pipe(service.getResource(database, COSMOS_COLLECTION_NAME)),
      ),
      TE.chain((resource) => service.getItemByID(resource, ID)),
    )();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const resource = result.right;
      if (O.isSome(resource)) {
        expect(resource.value).toEqual({ id: ID });
      }
    }
  });
});
