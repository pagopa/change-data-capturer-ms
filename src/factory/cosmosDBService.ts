import * as E from "fp-ts/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/Option";

import { Container, CosmosClient, Database } from "@azure/cosmos";
import { pipe } from "fp-ts/lib/function";
import {
  cosmosConnect,
  getContainer,
  getCosmosConfig,
  getDatabase,
  getItemByID,
} from "../capturer/cosmos/utils";
import {
  DB,
  DBClient,
  IDatabaseConfig,
  IDatabaseService,
  Item,
  Resource,
} from "./service";

export const cosmosDBService = {
  connect: (config: IDatabaseConfig): TE.TaskEither<Error, DBClient> =>
    pipe(
      getCosmosConfig(config.connection),
      E.chain((connectionString) =>
        cosmosConnect(connectionString.endpoint, connectionString.key),
      ),
      TE.fromEither,
      TE.mapLeft((e) => new Error(e.message)),
    ),
  getDatabase: (
    client: DBClient,
    databaseName: string,
  ): TE.TaskEither<Error, DB> =>
    pipe(
      getDatabase(client as CosmosClient, databaseName),
      TE.map((database) => database as DB),
    ),
  getItemByID: (
    resource: Resource,
    id: string,
  ): TE.TaskEither<Error, O.Option<Item>> =>
    pipe(
      getItemByID(resource as Container, id),
      TE.map((item) => item as O.Option<Item>),
    ),
  getResource: (
    database: DB,
    resourceName: string,
  ): TE.TaskEither<Error, Resource> =>
    pipe(
      getContainer(database as Database, resourceName),
      TE.map((container) => container as Resource),
    ),
} satisfies IDatabaseService;
