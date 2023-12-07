import { cosmosCDCService } from "./cosmosCDCService";
import { cosmosDBService } from "./cosmosDBService";
import { CDCService, DatabaseService } from "./service";

export type Service = DatabaseService & CDCService;

enum ServiceType {
  Cosmos,
  MongoDB,
  PostgreSQL,
}
export const createCosmosDBService = (
  databaseService: DatabaseService,
  cdcService: CDCService
): Service => ({ ...databaseService, ...cdcService });

const notSupportedError = "Service still not supported";

export const createDatabaseService = (type: ServiceType): Service => {
  switch (type) {
    case ServiceType.Cosmos:
      return { ...cosmosDBService, ...cosmosCDCService };
    case ServiceType.MongoDB:
      throw new Error(notSupportedError);
    case ServiceType.PostgreSQL:
      throw new Error(notSupportedError);
    default:
      throw new Error(notSupportedError);
  }
};
