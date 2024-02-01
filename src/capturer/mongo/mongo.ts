import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as B from "fp-ts/boolean";
import { pipe } from "fp-ts/lib/function";
import {
  Binary,
  ChangeStream,
  ChangeStreamDocument,
  ChangeStreamOptions,
  Collection,
  Document,
} from "mongodb";
import { IOpts } from "../cosmos/cosmos";
export const watchStream = <T = Document>(
  collection: Collection<T>,
  params: ChangeStreamOptions,
): E.Either<Error, ChangeStream<T, ChangeStreamDocument<T>>> =>
  E.tryCatch(
    () =>
      collection.watch(
        [
          {
            $match: {
              operationType: { $in: ["insert", "update", "replace"] },
            },
          },
          {
            $project: {
              _id: 1,
              documentKey: 1,
              fullDocument: 1,
              ns: 1,
            },
          },
        ],
        params,
      ),
    () =>
      new Error(
        `Impossible to watch the ${collection.collectionName} collection`,
      ),
  );

export const closeStream = <T = Document>(
  stream: ChangeStream<T, ChangeStreamDocument<T>>,
  opts: IOpts,
): E.Either<Error, void> =>
  pipe(
    opts?.timeout !== null,
    B.fold(
      () => E.right(void 0),
      () =>
        E.tryCatch(
          () => setTimeout(() => stream.close(), opts?.timeout),
          () => new Error(`Impossible to close the stream`),
        ),
    ),
  );

export const watchMongoCollection = <T = Document>(
  collection: Collection<T>,
  resumeToken: string,
  opts?: IOpts,
  params = {
    fullDocument: "updateLookup",
  },
): E.Either<Error, ChangeStream<T, ChangeStreamDocument<T>>> =>
  pipe(
    resumeToken,
    O.fromNullable,
    O.map((token) => ({
      ...params,
      resumeAfter: {
        _data: new Binary(Buffer.from(token, "base64")),
      },
    })),
    O.getOrElseW(() => params),
    (watchParams) =>
      pipe(
        watchStream(collection, watchParams),
        E.chainFirst((stream) => closeStream(stream, opts)),
      ),
  );

export const setMongoListenerOnEventChange = <T = Document>(
  changeStream: ChangeStream<T, ChangeStreamDocument<T>>,
  listener: (change: ChangeStreamDocument<T>) => void,
): E.Either<Error, ChangeStream<T, ChangeStreamDocument<T>>> =>
  E.tryCatch(
    () => changeStream.on("change", listener),
    (reason) => new Error(`Impossible to set the listener: " ${reason}`),
  );
