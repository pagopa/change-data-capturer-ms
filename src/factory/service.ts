import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as O from "fp-ts/Option";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { Collection, Db, MongoClient } from "mongodb";
import { Either } from "fp-ts/lib/Either";
import { ContinuationTokenItem } from "../capturer/cosmos/utils";

export type DatabaseConfig = {
  connection: string;
};

export type DB = Database | Db;
export type DBClient = CosmosClient | MongoClient;
export type Resource = Container | Collection;
export type Item = ContinuationTokenItem;
export interface DatabaseService {
  connect(config: DatabaseConfig): TaskEither<Error, DBClient>;
  getDatabase(client: DBClient, name: string): Either<Error, DB>;
  getResource(database: DB, resourceName: string): TaskEither<Error, Resource>;
  getItemByID(
    resource: Resource,
    id: string
  ): TaskEither<Error, O.Option<Item>>;
}

export interface CDCService {
  processChangeFeed(
    client: DBClient,
    database: string,
    resource: string,
    leaseResource?: string,
    prefix?: string
  ): (DBServiceClient: DatabaseService) => TaskEither<Error, void>;
}
