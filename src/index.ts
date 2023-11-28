/* eslint-disable no-console */
import { defaultLog, useWinston, withConsole } from "@pagopa/winston-ts";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";

useWinston(withConsole());

const main = () =>
  pipe(TE.Do, defaultLog.taskEither.info("Initializing project"))();

main()
  .then(console.log)
  .catch((error) => {
    console.error(error);
  });
