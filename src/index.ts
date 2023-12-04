/* eslint-disable no-console */
import { defaultLog, useWinston, withConsole } from "@pagopa/winston-ts";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import {
  cosmosConnect,
  getChangeFeedIteratorOptions,
  getItemById,
  processChangeFeed,
} from "./capturer/cosmos/cosmos";

useWinston(withConsole());

const main = () =>
  pipe(
    TE.Do,
    defaultLog.taskEither.info("Creating cosmos client..."),
    TE.bind("client", () =>
      cosmosConnect(
        "https://localhost:8081",
        "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
      )
    ),
    defaultLog.taskEither.info("Client created"),
    defaultLog.taskEither.info("Getting continuation token if exists..."),
    TE.bind("continuationToken", ({ client }) =>
      pipe(
        getItemById(client.database("database").container("leases"), "test"),
        TE.map(O.chainNullableK((tokenItem) => tokenItem.lease))
      )
    ),
    defaultLog.taskEither.info("Continuation Token evaluated"),
    TE.chain(({ client, continuationToken }) =>
      pipe(
        getChangeFeedIteratorOptions(O.toNullable(continuationToken)),
        TE.fromEither,
        defaultLog.taskEither.info(`Change feed options retrieved`),
        TE.chain((options) =>
          pipe(
            processChangeFeed(
              client.database("database").container("test"),
              client.database("database").container("leases"),
              options
            ),
            defaultLog.taskEither.info(
              `Container test ${
                client.database("database").container("test").id
              }`
            ),
            defaultLog.taskEither.info(`Change feed iterator ended`)
          )
        )
      )
    )
  )();

main()
  .then(console.log)
  .catch((error) => {
    console.error(error);
  });
