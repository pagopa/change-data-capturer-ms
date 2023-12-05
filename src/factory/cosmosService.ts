import { CosmosClient } from "@azure/cosmos";
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
  connect: (config: DatabaseConfig): Either<Error, CosmosClient> =>
    pipe(cosmosConnect(config.connection, config.connection)),
  getDatabase,
  getResource: getContainer,
};

export const cosmosCDCService: CDCService = {
  processChangeFeed: (
    client: CosmosClient,
    database: string,
    resource: string,
    leaseResource?: string,
    prefix?: string
  ): TaskEither<Error, void> =>
    pipe(
      E.Do,
      E.bind("database", () => cosmosDBService.getDatabase(client, database)),
      E.bind("container", ({ database }) =>
        cosmosDBService.getResource(database, resource)
      ),
      E.bind("leaseContainer", ({ database }) =>
        cosmosDBService.getResource(database, leaseResource)
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
      TE.map(() => void 0)
    ),
};
