import * as TE from "fp-ts/TaskEither";
export type ProcessResult = (
  results: ReadonlyArray<unknown>,
) => TE.TaskEither<Error, void>;
