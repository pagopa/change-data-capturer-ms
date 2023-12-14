import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import {
  cosmosConnect,
  getContainer,
  getDatabase,
  getItemByID,
} from "../capturer/cosmos/utils";
import { DBClient, IDatabaseConfig, IDatabaseService } from "./service";

export const cosmosDBService = {
  connect: (config: IDatabaseConfig): TE.TaskEither<Error, DBClient> =>
    pipe(cosmosConnect(config.connection, config.connection), TE.fromEither),
  getDatabase,
  getItemByID,
  getResource: getContainer,
} satisfies IDatabaseService;
