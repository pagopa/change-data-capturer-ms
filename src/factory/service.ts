import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as O from "fp-ts/Option";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { Collection, Db, Document, MongoClient } from "mongodb";
import { IOpts } from "../capturer/cosmos/cosmos";
import { ContinuationTokenItem, ProcessResult } from "./types";
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
    processResults: ProcessResult,
    leaseResource?: string,
    opts?: IOpts,
  ) => (DBServiceClient: IDatabaseService) => TaskEither<Error, void>;
}
