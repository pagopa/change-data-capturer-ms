import { Container, CosmosClient, Database } from "@azure/cosmos";
import { Either } from "fp-ts/lib/Either";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { Collection, Db, MongoClient } from "mongodb";

export type DatabaseConfig = {
  connection: string;
};

export type DB = Database | Db;
export type DBClient = CosmosClient | MongoClient;
export type Resource = Container | Collection;

export interface DatabaseService {
  connect(config: DatabaseConfig): Either<Error, DBClient>;
  getDatabase(client: DBClient, name: string): Either<Error, DB>;
  getResource(database: DB, resourceName: string): Either<Error, Resource>;
}

export interface CDCService {
  processChangeFeed(
    client: DBClient,
    database: string,
    resource: string,
    leaseResource?: string,
    prefix?: string
  ): TaskEither<Error, void>;
}
