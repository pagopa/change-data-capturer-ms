import * as TE from "fp-ts/TaskEither";
import {
    findDocumentByID,
    getMongoCollection,
    getMongoDb,
    mongoConnect,
} from "../capturer/mongo/utils";
import { DBClient, DatabaseConfig, DatabaseService } from "./service";

export const mongoDBService = {
  connect: (config: DatabaseConfig): TE.TaskEither<Error, DBClient> =>
    mongoConnect(config.connection),
  getDatabase: getMongoDb,
  getResource: getMongoCollection,
  getItemByID: findDocumentByID,
} satisfies DatabaseService;
