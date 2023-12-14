import { cosmosCDCService } from "./cosmosCDCService";
import { cosmosDBService } from "./cosmosDBService";
import { mongoCDCService } from "./mongoCDCService";
import { mongoDBService } from "./mongoDBService";
import { ICDCService, IDatabaseService } from "./service";

export type Service = IDatabaseService & ICDCService;

export enum ServiceType {
  Cosmos,
  MongoDB,
  PostgreSQL,
}

export const createCosmosDBService = (
  databaseService: IDatabaseService,
  cdcService: ICDCService,
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
