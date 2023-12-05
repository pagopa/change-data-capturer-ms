import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { Either } from "fp-ts/lib/Either";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import {
  getChangeFeedIteratorOptions,
  processChangeFeed,
} from "../capturer/cosmos/cosmos";
import {
  cosmosConnect,
  getContainer,
  getDatabase,
  getItemById,
} from "../capturer/cosmos/utils";
import { CDCService, DatabaseConfig, DatabaseService } from "./service";

export const cosmosDBService: DatabaseService = {
  connect: <T>(config: DatabaseConfig): Either<Error, T> =>
    pipe(
      cosmosConnect(config.connection, config.connection),
      E.map((client) => client as T),
      E.mapLeft((error) => error as Error)
    ),

  getDatabase: <T, K>(client: T, name: string): Either<Error, K> =>
    pipe(
      getDatabase(client as CosmosClient, name),
      E.map((database) => database as K),
      E.mapLeft((error) => error as Error)
    ),

  getResource: <T, K>(database: T, resourceName: string): Either<Error, K> =>
    pipe(
      getContainer(database as Database, resourceName),
      E.map((container) => container as K),
      E.mapLeft((error) => error as Error)
    ),
};

export const cosmosCDCService: CDCService = {
  processChangeFeed: <T>(
    client: T,
    database: string,
    resource: string,
    leaseResource?: string,
    prefix?: string
  ): TaskEither<Error, void> =>
    pipe(
      E.Do,
      E.bind("database", () =>
        cosmosDBService.getDatabase<CosmosClient, Database>(
          client as CosmosClient,
          database
        )
      ),
      E.bind("container", ({ database }) =>
        cosmosDBService.getResource<Database, Container>(database, resource)
      ),
      E.bind("leaseContainer", ({ database }) =>
        cosmosDBService.getResource<Database, Container>(
          database,
          leaseResource
        )
      ),
      TE.fromEither,
      TE.bind("continuationToken", ({ leaseContainer }) =>
        getItemById(leaseContainer, prefix)
      ),
      TE.chain(({ continuationToken, container, leaseContainer }) =>
        pipe(
          getChangeFeedIteratorOptions(
            O.getOrElse(() => null)(continuationToken)
          ),
          TE.fromEither,
          TE.chain((changeFeedIteratorOptions) =>
            processChangeFeed(
              container,
              changeFeedIteratorOptions,
              leaseContainer
            )
          )
        )
      ),
      TE.map(() => void 0),
      TE.mapLeft((error) => error as Error)
    ),
};
