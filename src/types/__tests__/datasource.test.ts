import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  CDCConnectionSourceType,
  CDCDataSource,
  CosmosDBType,
  DataSource,
  MongoDBType,
  PostgreSQLDBType,
  SelectAllConnectionSourceType,
  SelectAllDataSource,
} from "../datasource";
import * as E from "fp-ts/Either";
import * as B from "fp-ts/boolean";
import { pipe } from "fp-ts/lib/function";

describe("DataSource", () => {
  const aProperDatasourceConfig = {
    connectionString: "foo",
    type: "DB",
    dbType: "CosmosDB",
    sourceType: "CDC",
    props: {
      collectionName: "collName",
      dbName: "dbName",
      leaseContainerName: "lease",
    },
  };
  it("should decode a correct datasource config properly", () => {
    pipe(
      aProperDatasourceConfig,
      DataSource.decode,
      E.map((decoded) => expect(decoded).toEqual(aProperDatasourceConfig)),
      E.mapLeft(() => fail("Cannot decode a correct Datasource")),
    );
  });

  it("should fail while decoding an empty datasource config", () => {
    pipe(
      {},
      DataSource.decode,
      E.map(() => fail("An empty datasource config should not be decoded")),
      E.mapLeft((errs) => expect(errs).toBeDefined()),
    );
  });

  it("should fail while decoding an incorrect datasource config", () => {
    pipe(
      { ...aProperDatasourceConfig, type: "OTHER" },
      DataSource.decode,
      E.map(() => fail("An incorrect datasource config should not be decoded")),
      E.mapLeft((errs) => expect(errs).toBeDefined()),
    );
  });
});

describe("CDCDatasource", () => {
  const aCosmosCdcDatasourceConfig = {
    dbType: "CosmosDB" as CosmosDBType,
    sourceType: "CDC" as CDCConnectionSourceType,
    props: {
      collectionName: "collName" as NonEmptyString,
      dbName: "dbName" as NonEmptyString,
      leaseContainerName: "lease" as NonEmptyString,
    },
  };

  const aMongoCdcDataSourceConfig = {
    ...aCosmosCdcDatasourceConfig,
    dbType: "MongoDB" as MongoDBType,
  };

  const aSelectAllDatasourceConfig = {
    ...aCosmosCdcDatasourceConfig,
    sourceType: "SELECT_ALL" as SelectAllConnectionSourceType,
  };

  it.each`
    description                                                              | input                                                     | success
    ${"should decode a correct Cosmos CDCDatasource config properly"}        | ${aCosmosCdcDatasourceConfig}                             | ${true}
    ${"should decode a correct Mongo CDCDatasource config properly"}         | ${aMongoCdcDataSourceConfig}                              | ${true}
    ${"should fail giving a DocumentDB Datasource config with Postgre type"} | ${{ ...aMongoCdcDataSourceConfig, dbType: "PostgreSQL" }} | ${false}
    ${"should fail with SelectAll Datasource config"}                        | ${aSelectAllDatasourceConfig}                             | ${false}
    ${"should fail with an empty Datasource config"}                         | ${{}}                                                     | ${false}
  `("$description", ({ input, success }) => {
    pipe(input, CDCDataSource.decode, (eitherDecoded) =>
      pipe(
        success,
        B.foldW(
          () =>
            pipe(
              eitherDecoded,
              E.map(() =>
                fail("An incorrect CDCDatasource config should not be decoded"),
              ),
              E.mapLeft((errs) => expect(errs).toBeDefined()),
            ),
          () =>
            pipe(
              eitherDecoded,
              E.map((decoded) => expect(decoded).toEqual(input)),
              E.mapLeft(() => fail("Cannot decode a correct CDCDatasource")),
            ),
        ),
      ),
    );
  });
});

describe("SelectAllDatasource", () => {
  const aCosmosSelectAllDatasourceConfig = {
    dbType: "CosmosDB" as CosmosDBType,
    sourceType: "SELECT_ALL" as SelectAllConnectionSourceType,
    props: {
      dbName: "dbName" as NonEmptyString,
      pageSize: 100,
      resourceName: "resourceName",
    },
  };

  const aMongoSelectAllDataSourceConfig = {
    ...aCosmosSelectAllDatasourceConfig,
    dbType: "MongoDB" as MongoDBType,
    props: {
      ...aCosmosSelectAllDatasourceConfig.props,
      limit: 1,
    },
  };

  const aPostgreSelectAllDatasourceConfig = {
    ...aMongoSelectAllDataSourceConfig,
    dbType: "PostgreSQL" as PostgreSQLDBType,
  };

  it.each`
    description                                                               | input                                | success
    ${"should decode a correct Cosmos SelectAllDatasource config properly"}   | ${aCosmosSelectAllDatasourceConfig}  | ${true}
    ${"should decode a correct Mongo SelectAllDatasource config properly"}    | ${aMongoSelectAllDataSourceConfig}   | ${true}
    ${"should decode a correct Postgres SelectAllDatasource config properly"} | ${aPostgreSelectAllDatasourceConfig} | ${true}
    ${"should fail with an empty Datasource config"}                          | ${{}}                                | ${false}
  `("$description", ({ input, success }) => {
    pipe(input, SelectAllDataSource.decode, (eitherDecoded) =>
      pipe(
        success,
        B.foldW(
          () =>
            pipe(
              eitherDecoded,
              E.map(() =>
                fail(
                  "An incorrect SelectAllDatasource config should not be decoded",
                ),
              ),
              E.mapLeft((errs) => expect(errs).toBeDefined()),
            ),
          () =>
            pipe(
              eitherDecoded,
              E.map((decoded) => expect(decoded).toEqual(input)),
              E.mapLeft(() =>
                fail("Cannot decode a correct SelectAllDatasource"),
              ),
            ),
        ),
      ),
    );
  });
});
