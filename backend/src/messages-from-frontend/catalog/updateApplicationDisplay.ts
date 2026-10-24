import { z } from "zod";
import { createApplicationError } from "apphub-shared";
import type { BackendService } from "../../backendService";
import { listApplicationFolderNames } from "../../host/listApplicationFolderNames";
import { folderNameSchema } from "../folderName";
import { parseMessageData } from "../parseMessageData";

const updateApplicationDisplayDataSchema = z
  .object({
    folderName: folderNameSchema,
    displayName: z.string().min(1).max(80),
  })
  .strict();

export async function updateApplicationDisplay(
  backendService: BackendService,
  data: z.infer<typeof updateApplicationDisplayDataSchema>,
) {
  const { folderName, displayName } = parseMessageData(updateApplicationDisplayDataSchema, data);
  const folderNames = await listApplicationFolderNames({ appsDirectory: backendService.configuration.appsDirectory });
  if (!folderNames.includes(folderName)) {
    throw createApplicationError("applicationNotFound", "That application folder is not deployed", { folderName });
  }
  await backendService.saveApplicationDisplay({ folderName, displayName });
  const applications = await backendService.startCatalogRefresh();
  return { applications };
}
