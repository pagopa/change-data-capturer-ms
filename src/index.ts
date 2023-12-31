/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { defaultLog, useWinston, withConsole } from "@pagopa/winston-ts";

useWinston(withConsole());

const main = () => defaultLog.taskEither.info("Initializing App");

void main();
