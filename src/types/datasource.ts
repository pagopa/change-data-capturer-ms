import {
  NonNegativeInteger,
  WithinRangeInteger,
} from "@pagopa/ts-commons/lib/numbers";
import * as t from "io-ts";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { IsoDateFromString } from "@pagopa/ts-commons/lib/dates";

export const CosmosDBType = t.literal("CosmosDB");
export type CosmosDBType = t.TypeOf<typeof CosmosDBType>;
export const MongoDBType = t.literal("MongoDB");
export type MongoDBType = t.TypeOf<typeof MongoDBType>;
export const PostgreSQLDBType = t.literal("PostgreSQL");
export type PostgreSQLDBType = t.TypeOf<typeof PostgreSQLDBType>;

export const CDCConnectionSourceType = t.literal("CDC");
export type CDCConnectionSourceType = t.TypeOf<typeof CDCConnectionSourceType>;
export const SelectAllConnectionSourceType = t.literal("SELECT_ALL");
export type SelectAllConnectionSourceType = t.TypeOf<
  typeof SelectAllConnectionSourceType
>;

export const DBDataSourceType = t.literal("DB");
export type DBDataSourceType = t.TypeOf<typeof DBDataSourceType>;

export const QueueDataSourceType = t.literal("QUEUE");
export type QueueDataSourceType = t.TypeOf<typeof QueueDataSourceType>;

export const DataSourceConnectionCommon = t.type({
  connectionString: NonEmptyString,
});
export type DataSourceConnectionCommon = t.TypeOf<
  typeof DataSourceConnectionCommon
>;

export const CommonDocumentDbCdcProps = t.intersection([
  t.type({
    collectionName: NonEmptyString,
    dbName: NonEmptyString,
    leaseContainerName: NonEmptyString,
  }),
  t.partial({
    leaseContainerPrefix: NonEmptyString,
  }),
]);
export type CommonDocumentDbCdcProps = t.TypeOf<
  typeof CommonDocumentDbCdcProps
>;

export const CosmosCdcProps = t.intersection([
  CommonDocumentDbCdcProps,
  t.partial({
    startingFrom: IsoDateFromString,
  }),
]);

export type CosmosCdcProps = t.TypeOf<typeof CosmosCdcProps>;

export const CommonRelationalDbCdcProps = t.type({
  dbName: NonEmptyString,
  replicaSlotName: NonEmptyString,
  subscriptionName: NonEmptyString,
  tableName: NonEmptyString,
});
export type CommonRelationalDbCdcProps = t.TypeOf<
  typeof CommonRelationalDbCdcProps
>;

export const CommonCDCDataSource = t.type({
  sourceType: CDCConnectionSourceType,
});
export type CommonCDCDataSource = t.TypeOf<typeof CommonCDCDataSource>;

export const CDCCosmosDataSource = t.exact(
  t.intersection([
    CommonCDCDataSource,
    t.type({
      dbType: CosmosDBType,
      props: CosmosCdcProps,
    }),
  ]),
);
export type CDCCosmosDataSource = t.TypeOf<typeof CDCCosmosDataSource>;

export const CDCMongoDataSource = t.exact(
  t.intersection([
    CommonCDCDataSource,
    t.type({
      dbType: MongoDBType,
      props: CommonDocumentDbCdcProps,
    }),
  ]),
);
export type CDCMongoDataSource = t.TypeOf<typeof CDCMongoDataSource>;

export const CDCPostgresDataSource = t.exact(
  t.intersection([
    CommonCDCDataSource,
    t.type({
      dbType: PostgreSQLDBType,
      props: CommonRelationalDbCdcProps,
    }),
  ]),
);
export type CDCPostgresDataSource = t.TypeOf<typeof CDCPostgresDataSource>;

export const CDCDataSource = t.union([
  CDCCosmosDataSource,
  CDCMongoDataSource,
  CDCPostgresDataSource,
]);
export type CDCDataSource = t.TypeOf<typeof CDCDataSource>;

export const CommonDbSelectAllProps = t.type({
  dbName: NonEmptyString,
  pageSize: WithinRangeInteger(1, 1000),
  resourceName: NonEmptyString,
});
export type CommonDbSelectAllProps = t.TypeOf<typeof CommonDbSelectAllProps>;

export const CommonDbSelectAllWithLimitProps = t.intersection([
  CommonDbSelectAllProps,
  t.type({
    limit: NonNegativeInteger,
  }),
]);
export type CommonDbSelectAllWithLimitProps = t.TypeOf<
  typeof CommonDbSelectAllWithLimitProps
>;

export const CommonSelectAllDataSource = t.type({
  sourceType: SelectAllConnectionSourceType,
});
export type CommonSelectAllDataSource = t.TypeOf<
  typeof CommonSelectAllDataSource
>;

export const SelectAllCosmosDataSource = t.exact(
  t.intersection([
    CommonSelectAllDataSource,
    t.type({
      dbType: CosmosDBType,
      props: CommonDbSelectAllProps,
    }),
  ]),
);
export type SelectAllCosmosDataSource = t.TypeOf<
  typeof SelectAllCosmosDataSource
>;

export const SelectAllMongoDataSource = t.exact(
  t.intersection([
    CommonSelectAllDataSource,
    t.type({
      dbType: MongoDBType,
      props: CommonDbSelectAllWithLimitProps,
    }),
  ]),
);
export type SelectAllMongoDataSource = t.TypeOf<
  typeof SelectAllMongoDataSource
>;

export const SelectAllPostgresDataSource = t.exact(
  t.intersection([
    CommonSelectAllDataSource,
    t.type({
      dbType: PostgreSQLDBType,
      props: CommonDbSelectAllWithLimitProps,
    }),
  ]),
);
export type SelectAllPostgresDataSource = t.TypeOf<
  typeof SelectAllPostgresDataSource
>;

export const SelectAllDataSource = t.union([
  SelectAllCosmosDataSource,
  SelectAllMongoDataSource,
  SelectAllPostgresDataSource,
]);
export type SelectAllDataSource = t.TypeOf<typeof SelectAllDataSource>;

export const DBDataSource = t.intersection([
  t.exact(
    t.type({
      type: DBDataSourceType,
    }),
  ),
  t.exact(
    t.partial({
      delay: NonNegativeInteger,
    }),
  ),
  t.union([CDCDataSource, SelectAllDataSource]),
]);
export type DBDataSource = t.TypeOf<typeof DBDataSource>;

export const DataSource = t.intersection([
  DataSourceConnectionCommon,
  DBDataSource,
]);
export type DataSource = t.TypeOf<typeof DataSource>;