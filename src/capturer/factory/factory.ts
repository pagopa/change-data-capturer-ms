import { cosmosCDCService, cosmosDBService } from "./cosmosService";
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

export const createDatabaseService = (type: ServiceType): Service => {
  switch (type) {
    case ServiceType.Cosmos:
      return { ...cosmosDBService, ...cosmosCDCService };
    case ServiceType.MongoDB:
      throw new Error("Service still not supported");
    case ServiceType.PostgreSQL:
      throw new Error("Service still not supported");
    default:
      throw new Error("Tipo di servizio non supportato");
  }
};
