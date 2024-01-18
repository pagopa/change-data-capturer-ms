import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { disconnectMongo } from "../../../src/capturer/mongo/utils";
import {
  ServiceType,
  createDatabaseService,
} from "../../../src/factory/factory";
import { MONGODB_CONNECTION_STRING, MONGODB_NAME } from "../../env";
import {
  createMongoClient,
  createMongoDBAndCollections,
} from "../../utils/mongo";
const service = createDatabaseService(ServiceType.MongoDB);

beforeAll(async () => {
  await pipe(
    createMongoClient(MONGODB_CONNECTION_STRING),
    TE.chainFirst((client) =>
      pipe(
        createMongoDBAndCollections(client, MONGODB_NAME),
        TE.chain(() => disconnectMongo(client)),
      ),
    ),

    TE.getOrElse((e) => {
      throw Error(
        `Cannot initialize integration tests - ${JSON.stringify(e.message)}`,
      );
    }),
  )();
}, 10000);
