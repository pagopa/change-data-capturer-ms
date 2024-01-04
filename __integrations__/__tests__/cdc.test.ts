import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/Option";

import { Container, CosmosClient, Database } from "@azure/cosmos";
import { pipe } from "fp-ts/lib/function";
import { createDatabaseService, ServiceType } from "../../index";
import { getCosmosConfig } from "../../src/capturer/cosmos/utils";
import { COSMOSDB_CONNECTION_STRING, COSMOSDB_NAME } from "../env";
import {
  COSMOS_COLLECTION_NAME,
  createCosmosDbAndCollections,
  ID,
} from "../utils/cosmos";

const service = createDatabaseService(ServiceType.Cosmos);

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
      throw Error(`Cannot create db ${JSON.stringify(e)}`);
    }),
  )();
});

describe("Cosmos connection", () => {
  it("should return error when trying to connect to a not valid cosmos endpoint", async () => {
    const result = await service.connect({ connection: "fake_connection" })();
    expect(result).toEqual(
      E.left(
        new Error(
          `cosmos connection string does not match the expected format`,
        ),
      ),
    );
  });

  it("should succesfully connect to Cosmos", async () => {
    const result = await service.connect({
      connection: COSMOSDB_CONNECTION_STRING,
    })();
    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("get Database", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.setTimeout(60000);
  });

  it("should return error when trying to get a not existing database", async () => {
    const result = await pipe(
      service.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        pipe(service.getDatabase(client, "fake_database"), TE.fromEither),
      ),
    )();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const database = result.right;
      expect((database as Database).read()).rejects.toThrow();
    }
  });

  it("should return an existing database", async () => {
    const result = await pipe(
      service.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        pipe(service.getDatabase(client, COSMOSDB_NAME), TE.fromEither),
      ),
    )();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const database = result.right;
      const resp = await (database as Database).read();
      expect(resp.database.id).toEqual(COSMOSDB_NAME);
    }
  });
});

describe("getResource", () => {
  it("should return error when trying to get a not existing resource", async () => {
    const result = await pipe(
      service.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        pipe(service.getDatabase(client, COSMOSDB_NAME), TE.fromEither),
      ),
      TE.chain((database) =>
        pipe(service.getResource(database, "fake_container")),
      ),
    )();

    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const container = result.right;
      expect((container as Container).read()).rejects.toThrow();
    }
  });

  it("should return an existing resource", async () => {
    const result = await pipe(
      service.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        pipe(service.getDatabase(client, COSMOSDB_NAME), TE.fromEither),
      ),
      TE.chain((database) =>
        pipe(service.getResource(database, COSMOS_COLLECTION_NAME)),
      ),
    )();
    expect(E.isRight(result)).toBeTruthy();
    if (E.isRight(result)) {
      const container = result.right;
      const resp = await (container as Container).read();
      expect(resp.container.id).toEqual(COSMOS_COLLECTION_NAME);
    }
  });
});

describe("getItemById", () => {
  it("should return error when trying to get a not existing item", async () => {
    const result = await pipe(
      service.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        pipe(service.getDatabase(client, COSMOSDB_NAME), TE.fromEither),
      ),
      TE.chain((database) =>
        pipe(service.getResource(database, "fake_container")),
      ),
      TE.chain((resource) => pipe(service.getItemByID(resource, "fake_id"))),
    )();

    expect(E.isRight(result)).toBeTruthy();
  });

  it("should return an existing item", async () => {
    const result = await pipe(
      service.connect({
        connection: COSMOSDB_CONNECTION_STRING,
      }),
      TE.chain((client) =>
        pipe(service.getDatabase(client, COSMOSDB_NAME), TE.fromEither),
      ),
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
