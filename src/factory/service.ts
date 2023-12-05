import {
  Container,
  CosmosClient,
  Database as CosmosDatabase,
} from "@azure/cosmos";
import { Either } from "fp-ts/lib/Either";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { MongoClient } from "mongodb";

export type DatabaseConfig = {
  connection: string;
};

export type Database = CosmosDatabase;

export type Resource = Container;

export type DatabaseClient = {
  client: CosmosClient | MongoClient;
};

export interface DatabaseService {
  connect(config: DatabaseConfig): Either<Error, DatabaseClient["client"]>;
  getDatabase(
    client: DatabaseClient["client"],
    name: string
  ): Either<Error, Database>;
  getResource(
    database: DatabaseClient,
    resourceName: string
  ): Either<Error, Resource>;
}

export interface CDCService {
  processChangeFeed(
    client: DatabaseClient["client"],
    database: string,
    resource: string,
    leaseResource?: string,
    prefix?: string
  ): TaskEither<Error, void>;
}
