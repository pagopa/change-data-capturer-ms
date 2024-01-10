import {
  Resource as AzureResource,
  Container,
  CosmosClient,
  Database,
} from "@azure/cosmos";
import { KafkaProducerCompact } from "@pagopa/fp-ts-kafkajs/dist/lib/KafkaProducerCompact";
import * as O from "fp-ts/Option";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { Collection, Db, Document, MongoClient } from "mongodb";
import { ContinuationTokenItem } from "../capturer/cosmos/utils";

export interface IDatabaseConfig {
  readonly connection: string;
}

export type DB = Database | Db;
export type DBClient = CosmosClient | MongoClient;
export type Resource = Container | Collection;
export type Item = ContinuationTokenItem | Document;

export interface IDatabaseService {
  readonly connect: (config: IDatabaseConfig) => TaskEither<Error, DBClient>;
  readonly getDatabase: (
    client: DBClient,
    name: string,
  ) => TaskEither<Error, DB>;
  readonly getResource: (
    database: DB,
    resourceName: string,
  ) => TaskEither<Error, Resource>;
  readonly getItemByID: (
    resource: Resource,
    id: string,
  ) => TaskEither<Error, O.Option<Item>>;
}

export interface ICDCService {
  readonly processChangeFeed: (
    client: DBClient,
    database: string,
    resource: string,
    mqueueClient: KafkaProducerCompact<AzureResource>,
    leaseResource?: string,
    prefix?: string,
  ) => (DBServiceClient: IDatabaseService) => TaskEither<Error, void>;
}
