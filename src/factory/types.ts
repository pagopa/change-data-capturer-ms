import * as TE from "fp-ts/TaskEither";
import * as T from "io-ts";
export type ProcessResult = (
  results: ReadonlyArray<unknown>,
) => TE.TaskEither<Error, void>;

export const ContinuationTokenItem = T.type({
  id: T.string,
  lease: T.string,
});

export type ContinuationTokenItem = T.TypeOf<typeof ContinuationTokenItem>;
