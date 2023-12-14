import * as TE from "fp-ts/TaskEither";
import {
  findDocumentByID,
  getMongoCollection,
  getMongoDb,
  mongoConnect,
} from "../capturer/mongo/utils";
import { DBClient, IDatabaseConfig, IDatabaseService } from "./service";

export const mongoDBService = {
  connect: (config: IDatabaseConfig): TE.TaskEither<Error, DBClient> =>
    mongoConnect(config.connection),
  getDatabase: getMongoDb,
  getItemByID: findDocumentByID,
  getResource: getMongoCollection,
} satisfies IDatabaseService;
