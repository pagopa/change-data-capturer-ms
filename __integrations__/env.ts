import * as dotenv from "dotenv";

dotenv.config({ path: "./environments/.env" });

export const COSMOSDB_URI = process.env.COSMOSDB_URI;
export const COSMOSDB_KEY = process.env.COSMOSDB_KEY;
export const COSMOSDB_CONNECTION_STRING =
  process.env.COSMOSDB_CONNECTION_STRING ?? "COSMOSDB_CONNECTION_STRING";
export const COSMOSDB_NAME = process.env.COSMOSDB_NAME ?? "db";

export const MONGODB_CONNECTION_STRING =
  process.env.MONGODB_CONNECTION_STRING ?? "mongodb://user:pass@mongodb";
export const MONGODB_NAME = process.env.MONGODB_NAME ?? "db";

export const MESSAGEQUEUE_CONNECTION_STRING =
  process.env.MESSAGEQUEUE_CONNECTION_STRING ?? "localhost:9092";
export const MESSAGEQUEUE_TOPIC = process.env.MESSAGEQUEUE_TOPIC ?? "topic";
export const MESSAGEQUEUE_GROUPID =
  process.env.MESSAGEQUEUE_GROUPID ?? "groupId";
export const MESSAGEQUEUE_CLIENTID =
  process.env.MESSAGEQUEUE_CLIENTID ?? "clientId";
