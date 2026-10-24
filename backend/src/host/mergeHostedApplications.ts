import { posix, win32 } from "node:path";
import type { HostedApplication } from "apphub-shared";
import type { CatalogDocument } from "../catalog/catalogDocument";
import { applicationIsActive } from "./applicationIsActive";

export function mergeHostedApplications({
  folderNames,
  processPaths,
  applicationsDirectory,
  catalogDocument,
  publicApplicationHost,
  publicPathPrefix,
}: {
  folderNames: readonly string[];
  processPaths: readonly string[];
  applicationsDirectory: string;
  catalogDocument: CatalogDocument;
  publicApplicationHost: string;
  publicPathPrefix: string;
}): HostedApplication[] {
  return [...folderNames]
    .sort((left, right) => left.localeCompare(right))
    .map((folderName) => {
      const overlay = catalogDocument.applications[folderName];
      const trimmedDisplayName = overlay?.displayName?.trim();
      return {
        folderName,
        displayName: trimmedDisplayName ? trimmedDisplayName : folderName,
        imageAddress: overlay?.imageFileName ? `${publicPathPrefix}/catalog-images/${overlay.imageFileName}` : null,
        webAddress: `https://${folderName}.${publicApplicationHost}`,
        isActive: applicationIsActive({
          applicationFolderPath: joinApplicationFolderPath({ applicationsDirectory, folderName }),
          processPaths,
        }),
      };
    });
}

function joinApplicationFolderPath({
  applicationsDirectory,
  folderName,
}: {
  applicationsDirectory: string;
  folderName: string;
}): string {
  const usesWindowsPath = applicationsDirectory.includes("\\") || /^[A-Za-z]:/.test(applicationsDirectory);
  return usesWindowsPath ? win32.join(applicationsDirectory, folderName) : posix.join(applicationsDirectory, folderName);
}
