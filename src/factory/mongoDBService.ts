import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { Collection, Db, MongoClient } from "mongodb";
import {
  findDocumentByID,
  getMongoCollection,
  getMongoDb,
  mongoConnect,
} from "../capturer/mongo/utils";
import {
  DB,
  DBClient,
  IDatabaseConfig,
  IDatabaseService,
  Item,
  Resource,
} from "./service";

export const mongoDBService = {
  connect: (config: IDatabaseConfig): TE.TaskEither<Error, DBClient> =>
    mongoConnect(config.connection),
  getDatabase: (client: DBClient, name: string): TE.TaskEither<Error, DB> =>
    getMongoDb(client as MongoClient, name),
  getItemByID: (
    resource: Resource,
    id: string,
  ): TE.TaskEither<Error, O.Option<Item>> =>
    findDocumentByID(resource as Collection, id),
  getResource: (
    database: DB,
    resourceName: string,
  ): TE.TaskEither<Error, Resource> =>
    getMongoCollection(database as Db, resourceName),
} satisfies IDatabaseService;
