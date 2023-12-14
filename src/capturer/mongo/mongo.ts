import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import {
  Binary,
  ChangeStream,
  ChangeStreamDocument,
  Collection,
  Document,
} from "mongodb";

export const watchMongoCollection = <T = Document>(
  collection: Collection<T>,
  resumeToken: string,
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
            watchParams,
          ),
        (reason) =>
          new Error(
            `Impossible to watch the ${collection.collectionName} collection: " ${reason}`,
          ),
      ),
  );

export const setMongoListenerOnEventChange = <T extends Document>(
  changeStream: ChangeStream<T, ChangeStreamDocument<T>>,
  listener: (change: ChangeStreamDocument<T>) => void,
): E.Either<Error, void> =>
  E.tryCatch(
    () => void changeStream.on("change", listener),
    (reason) => new Error(`Impossible to set the listener: " ${reason}`),
  );
