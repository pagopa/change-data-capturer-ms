import { CosmosClient } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { Either } from "fp-ts/lib/Either";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
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
import {
  CDCService,
  DBClient,
  DatabaseConfig,
  DatabaseService,
} from "./service";

export const cosmosDBService = {
  getDatabase,
  getResource: getContainer,
  connect: (config: DatabaseConfig): Either<Error, DBClient> =>
    cosmosConnect(config.connection, config.connection),
} satisfies DatabaseService;

export const cosmosCDCService = {
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
        pipe(cosmosDBService.getResource(database, resource))
      ),
      E.bind("leaseContainer", ({ database }) =>
        pipe(cosmosDBService.getResource(database, leaseResource))
      ),
      TE.fromEither,
      TE.bind("continuationToken", ({ leaseContainer }) =>
        getItemById(leaseContainer, prefix)
      ),
      TE.chain(({ continuationToken, container, leaseContainer }) =>
        pipe(
          getChangeFeedIteratorOptions(
            pipe(
              continuationToken,
              O.map((token) => token.lease),
              O.getOrElse(() => undefined)
            )
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
      TE.map(constVoid)
    ),
} satisfies CDCService;
