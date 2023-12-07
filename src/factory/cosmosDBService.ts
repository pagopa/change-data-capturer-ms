import { Either } from "fp-ts/lib/Either";
import {
  cosmosConnect,
  getContainer,
  getDatabase,
  getItemByID,
} from "../capturer/cosmos/utils";
import { DBClient, DatabaseConfig, DatabaseService } from "./service";

export const cosmosDBService = {
  connect: (config: DatabaseConfig): Either<Error, DBClient> =>
    cosmosConnect(config.connection, config.connection),
  getDatabase,
  getResource: getContainer,
  getItemByID,
} satisfies DatabaseService;
