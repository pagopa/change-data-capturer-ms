/* eslint-disable @typescript-eslint/no-shadow */
import { Container, Database } from "@azure/cosmos";
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
      connectionString: string,
      database: string,
      resource: string,
      leaseResource?: string,
      prefix?: string,
    ) =>
    (cosmosDBServiceClient: typeof cosmosDBService): TaskEither<Error, void> =>
      pipe(
        TE.Do,
        TE.bind("client", () =>
          cosmosDBServiceClient.connect({ connection: connectionString }),
        ),
        TE.bind("database", ({ client }) =>
          cosmosDBServiceClient.getDatabase(client, database),
        ),
        TE.bind("container", ({ database }) =>
          cosmosDBServiceClient.getResource(database, resource),
        ),
        TE.bind("leaseContainer", ({ database }) =>
          pipe(
            O.fromNullable(leaseResource),
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
                  ),
                ),
              ),
          ),
        ),
        TE.map(constVoid),
      ),
} satisfies ICDCService;
