/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable max-params */
import { Container, CosmosClient, Database } from "@azure/cosmos";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import {
  IOpts,
  getChangeFeedIteratorOptions,
  processChangeFeed,
} from "../capturer/cosmos/cosmos";
import { createContainer } from "../capturer/cosmos/utils";
import { cosmosDBService } from "./cosmosDBService";
import { ICDCService } from "./service";
import { ProcessResult } from "./types";

export const LEASE_CONTAINER_NAME = "cdc-data-lease";

export const cosmosCDCService: ICDCService = {
  processChangeFeed:
    (
      client: CosmosClient,
      databaseName: string,
      resourceName: string,
      processResults: ProcessResult,
      leaseResourceName?: string,
      opts?: IOpts,
    ) =>
    (cosmosDBServiceClient: typeof cosmosDBService): TaskEither<Error, void> =>
      pipe(
        TE.Do,
        // Connecting to the database
        TE.bind("database", () =>
          cosmosDBServiceClient.getDatabase(client, databaseName),
        ),
        // Checking that the container {resource} exists
        TE.bind("container", ({ database }) =>
          cosmosDBServiceClient.getResource(database, resourceName),
        ),
        // Checking that the lease container {leaseResource} exists
        // If not, a default lease container will be created in the next steps
        TE.bind("leaseContainer", ({ database }) =>
          pipe(
            O.fromNullable(leaseResourceName),
            O.fold(
              () => TE.right(O.none),
              (lease) =>
                pipe(
                  cosmosDBServiceClient.getResource(database, lease),
                  TE.map(O.some),
                ),
            ),
          ),
        ),
        // Checking from the lease container {leaseResource} that there is a continuationToken stored
        TE.bind("continuationToken", ({ leaseContainer }) =>
          pipe(
            leaseContainer,
            O.fold(
              () => TE.right(O.none),
              (container) =>
                pipe(
                  O.fromNullable(opts),
                  O.chainNullableK((options) => options.prefix),
                  O.fold(
                    () => TE.right(O.none),
                    (id) => cosmosDBServiceClient.getItemByID(container, id),
                  ),
                ),
            ),
          ),
        ),
        // Process the change feed
        // If the leaseContainer is undefined, it will be created with a standard name {LEASE_CONTAINER_NAME}
        // If the continuatoken is undefined, the feed starts from beginning to consume records else starts from the continuationToken
        TE.chain(({ continuationToken, container, leaseContainer, database }) =>
          pipe(
            continuationToken,
            O.map((token) => token.lease),
            O.toUndefined,
            getChangeFeedIteratorOptions,
            (changeFeedIteratorOptions) =>
              pipe(
                leaseContainer,
                O.fold(
                  () =>
                    createContainer(database as Database, LEASE_CONTAINER_NAME),
                  (lContainer) => TE.right(lContainer),
                ),
                TE.chain((lContainer) =>
                  processChangeFeed(
                    container as Container,
                    changeFeedIteratorOptions,
                    lContainer as Container,
                    processResults,
                    opts,
                  ),
                ),
              ),
          ),
        ),
        TE.map(constVoid),
      ),
} satisfies ICDCService;
