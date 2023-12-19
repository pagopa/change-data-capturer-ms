import * as t from "io-ts";
import { NonEmptyString } from "io-ts-types";

export const CosmosDBDataSourceType = t.literal("CosmosDB");
export type CosmosDBDataSourceType = t.TypeOf<typeof CosmosDBDataSourceType>;
export const MongoDBDataSourceType = t.literal("MongoDB");
export type MongoDBDataSourceType = t.TypeOf<typeof MongoDBDataSourceType>;
export const PostgreSQLDataSourceType = t.literal("PostgreSQL");
export type PostgreSQLDataSourceType = t.TypeOf<
  typeof PostgreSQLDataSourceType
>;
export const UriConnectionCommon = t.type({
  uri: NonEmptyString,
});
export type UriConnectionCommon = t.TypeOf<typeof UriConnectionCommon>;

export const DBConnectionCommon = t.type({
  dbName: NonEmptyString,
  resourceName: NonEmptyString,
});
export type DBConnectionCommon = t.TypeOf<typeof DBConnectionCommon>;

export const CosmosDBConnectionCommon = t.intersection([
  UriConnectionCommon,
  DBConnectionCommon,
]);
export type CosmosDBConnectionCommon = t.TypeOf<
  typeof CosmosDBConnectionCommon
>;

export const ChangeFeedCommon = t.type({
  createLeaseContainerIfNotExists: t.boolean,
  leaseContainerName: NonEmptyString,
  leaseContainerPrefix: NonEmptyString,
});
export type ChangeFeedCommon = t.TypeOf<typeof ChangeFeedCommon>;

export const MongoDBConnectionCommon = t.intersection([
  UriConnectionCommon,
  DBConnectionCommon,
]);
export type MongoDBConnectionCommon = t.TypeOf<typeof MongoDBConnectionCommon>;

export const CosmosDBConnectionChangeFeed = t.exact(
  t.intersection([CosmosDBConnectionCommon, ChangeFeedCommon]),
);
export type CosmosDBConnectionChangeFeed = t.TypeOf<
  typeof CosmosDBConnectionChangeFeed
>;

export const MongoDBConnectionChangeFeed = t.exact(
  t.intersection([MongoDBConnectionCommon, ChangeFeedCommon]),
);
export type MongoDBConnectionChangeFeed = t.TypeOf<
  typeof MongoDBConnectionChangeFeed
>;

export const CosmosDBDataSource = t.type({
  connection: CosmosDBConnectionChangeFeed,
  type: CosmosDBDataSourceType,
});
export type CosmosDBDataSource = t.TypeOf<typeof CosmosDBDataSource>;

export const MongoDBDataSource = t.type({
  connection: MongoDBConnectionChangeFeed,
  type: MongoDBDataSourceType,
});
export type MongoDBDataSource = t.TypeOf<typeof MongoDBDataSource>;

export const DBDataSource = t.union([
  CosmosDBDataSource,
  MongoDBConnectionChangeFeed,
]);
export type DBDataSource = t.TypeOf<typeof DBDataSource>;
