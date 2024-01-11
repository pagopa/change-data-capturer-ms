import * as E from "fp-ts/Either";
import { MongoClient } from "mongodb";
import { mongoConnect } from "../utils";

jest.mock("mongodb");
const connectSpy = jest.spyOn(MongoClient, "connect");

describe("mongoConnect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should connect to MongoDB", async () => {
    connectSpy.mockImplementation(() => Promise.resolve({} as MongoClient));
    const uri = "mongodb://localhost:27017/test";
    const result = await mongoConnect(uri)();

    expect(result).toEqual(E.right({}));
    expect(connectSpy).toHaveBeenCalledWith(uri);
  });

  const error = new Error("Connection error");

  it("should handle connection error", async () => {
    connectSpy.mockImplementation(() => {
      throw error;
    });
    const uri = "mongodb://localhost:27017/test";
    const result = await mongoConnect(uri)();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left).toEqual(
        new Error("Impossible to connect to MongoDB"),
      );
    }
    expect(connectSpy).toHaveBeenCalledWith(uri);
  });
});
