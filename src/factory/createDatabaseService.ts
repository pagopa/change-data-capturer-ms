import { cosmosCDCService } from "./cosmosCDCService";
import { cosmosDBService } from "./cosmosDBService";
import { Service, ServiceType, notSupportedError } from "./factory";
import { mongoCDCService } from "./mongoCDCService";
import { mongoDBService } from "./mongoDBService";

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
