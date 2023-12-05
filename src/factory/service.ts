import { CosmosClient } from "@azure/cosmos";
import { Either } from "fp-ts/lib/Either";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { MongoClient } from "mongodb";

export type DatabaseConfig = {
  connection: string;
};

export type DatabaseClient = {
  client: CosmosClient | MongoClient;
};

export interface DatabaseService {
  connect<T>(config: DatabaseConfig): Either<Error, T>;
  getDatabase<T, K>(client: T, name: string): Either<Error, K>;
  getResource<T, K>(database: T, resourceName: string): Either<Error, K>;
}

export interface CDCService {
  processChangeFeed<T>(
    client: T,
    database: string,
    resource: string,
    leaseResource?: string,
    prefix?: string
  ): TaskEither<Error, void>;
}
