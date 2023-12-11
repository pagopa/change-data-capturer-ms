import { cosmosCDCService } from "./cosmosCDCService";
import { cosmosDBService } from "./cosmosDBService";
import { mongoCDCService } from "./mongoCDCService";
import { mongoDBService } from "./mongoDBService";
import { CDCService, DatabaseService } from "./service";

export type Service = DatabaseService & CDCService;

export enum ServiceType {
  Cosmos,
  MongoDB,
  PostgreSQL,
}
export const createCosmosDBService = (
  databaseService: DatabaseService,
  cdcService: CDCService
): Service => ({ ...databaseService, ...cdcService });

export const notSupportedError = "Service still not supported";

export const createDatabaseService = (type: ServiceType): Service => {
  switch (type) {
    case ServiceType.Cosmos:
      return { ...cosmosDBService, ...cosmosCDCService };
    case ServiceType.MongoDB:
      return { ...mongoDBService, ...mongoCDCService };
    case ServiceType.PostgreSQL:
      throw new Error(notSupportedError);
    default:
      throw new Error(notSupportedError);
  }
};
