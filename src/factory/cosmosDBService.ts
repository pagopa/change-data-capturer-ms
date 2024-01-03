import * as E from "fp-ts/Either";
import * as TE from "fp-ts/lib/TaskEither";

import { pipe } from "fp-ts/lib/function";
import {
  cosmosConnect,
  getContainer,
  getCosmosConfig,
  getDatabase,
  getItemByID,
} from "../capturer/cosmos/utils";
import { DBClient, IDatabaseConfig, IDatabaseService } from "./service";

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
  getDatabase,
  getItemByID,
  getResource: getContainer,
} satisfies IDatabaseService;
