/* eslint-disable no-console */
import { CosmosClient } from "@azure/cosmos";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import {
  getChangeFeedIteratorOptions,
  processChangeFeed,
} from "../capturer/cosmos/cosmos";
import { cosmosDBService } from "./cosmosDBService";
import { CDCService } from "./service";

export const cosmosCDCService = {
  processChangeFeed:
    (
      client: CosmosClient,
      database: string,
      resource: string,
      leaseResource?: string,
      prefix?: string
    ) =>
    (cosmosDBServiceClient: typeof cosmosDBService): TaskEither<Error, void> =>
      pipe(
        E.Do,
        E.bind("database", () =>
          cosmosDBServiceClient.getDatabase(client, database)
        ),
        E.bind("container", ({ database }) =>
          cosmosDBServiceClient.getResource(database, resource)
        ),
        E.bind("leaseContainer", ({ database }) =>
          cosmosDBServiceClient.getResource(database, leaseResource)
        ),
        TE.fromEither,
        TE.bind("continuationToken", ({ leaseContainer }) =>
          cosmosDBServiceClient.getItemByID(leaseContainer, prefix)
        ),
        TE.chain(({ continuationToken, container, leaseContainer }) =>
          pipe(
            getChangeFeedIteratorOptions(
              pipe(
                continuationToken,
                O.map((token) => token.lease),
                O.toUndefined
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
