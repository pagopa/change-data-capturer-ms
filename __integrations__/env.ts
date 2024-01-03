import * as dotenv from "dotenv";

dotenv.config({ path: "./environments/env.cosmosdb" });

export const COSMOSDB_URI = process.env.COSMOSDB_URI;
export const COSMOSDB_KEY = process.env.COSMOSDB_KEY;
export const COSMOSDB_CONNECTION_STRING =
  process.env.COSMOSDB_CONNECTION_STRING || "COSMOSDB_CONNECTION_STRING";
export const COSMOSDB_NAME = process.env.COSMOSDB_NAME ?? "db";
