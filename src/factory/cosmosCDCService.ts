/* eslint-disable max-params */
import { Container, CosmosClient } from "@azure/cosmos";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { TaskEither } from "fp-ts/lib/TaskEither";
import { constVoid, pipe } from "fp-ts/lib/function";
import {
  getChangeFeedIteratorOptions,
  processChangeFeed,
} from "../capturer/cosmos/cosmos";
import { createContainer } from "../capturer/cosmos/utils";
import { cosmosDBService } from "./cosmosDBService";
import { ICDCService, Item } from "./service";

export const LEASE_CONTAINER_NAME = "cdc-data-lease";

export const cosmosCDCService = {
  processChangeFeed:
    (
      client: CosmosClient,
      databaseName: string,
      resourceName: string,
      processResults: (
        results: ReadonlyArray<unknown>,
      ) => TE.TaskEither<Error, void>,
      leaseResourceName?: string,
      prefix?: string,
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
              () => TE.right<Error, O.Option<Container>>(O.none),
              (lease) =>
                pipe(
                  cosmosDBServiceClient.getResource(database, lease),
                  TE.map((lcontainer) => O.some(lcontainer)),
                ),
            ),
          ),
        ),
        // Checking from the lease container {leaseResource} that there is a continuationToken stored
        TE.bind("continuationToken", ({ leaseContainer }) =>
          pipe(
            leaseContainer,
            O.fold(
              () => TE.right<Error, O.Option<Item>>(O.none),
              (container) =>
                pipe(
                  O.fromNullable(prefix),
                  O.fold(
                    () => TE.right<Error, O.Option<Item>>(O.none),
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
                  () => createContainer(database, LEASE_CONTAINER_NAME),
                  (lContainer) => TE.right(lContainer),
                ),
                TE.chain((lContainer) =>
                  processChangeFeed(
                    container,
                    changeFeedIteratorOptions,
                    lContainer,
                    processResults,
                    prefix,
                  ),
                ),
              ),
          ),
        ),
        TE.map(constVoid),
      ),
} satisfies ICDCService;
