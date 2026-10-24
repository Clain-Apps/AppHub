import { z } from "zod";
import type { BackendService } from "../../backendService";
import { parseMessageData } from "../parseMessageData";

const refreshCatalogDataSchema = z.object({}).strict();

export async function refreshCatalog(backendService: BackendService, data: z.infer<typeof refreshCatalogDataSchema>) {
  parseMessageData(refreshCatalogDataSchema, data);
  const applications = await backendService.startCatalogRefresh();
  return { applications };
}
