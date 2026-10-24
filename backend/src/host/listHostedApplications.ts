import type { HostedApplication } from "apphub-shared";
import type { CatalogStore } from "../catalog/catalogStore";
import type { Configuration } from "../configuration";
import { listApplicationFolderNames } from "./listApplicationFolderNames";
import { mergeHostedApplications } from "./mergeHostedApplications";

export function createHostedApplicationLister({
  configuration,
  catalogStore,
  listProcessPaths,
}: {
  configuration: Configuration;
  catalogStore: CatalogStore;
  listProcessPaths(): Promise<string[]>;
}) {
  return {
    async listApplications(): Promise<HostedApplication[]> {
      const [folderNames, processPaths, catalogDocument] = await Promise.all([
        listApplicationFolderNames({ appsDirectory: configuration.appsDirectory }),
        listProcessPaths(),
        catalogStore.readCatalogDocument(),
      ]);
      return mergeHostedApplications({
        folderNames,
        processPaths,
        applicationsDirectory: configuration.appsDirectory,
        catalogDocument,
        publicApplicationHost: configuration.publicApplicationHost,
        publicPathPrefix: configuration.publicPathPrefix,
      });
    },
  };
}
