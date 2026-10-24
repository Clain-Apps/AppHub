/**
 * A process counts as belonging to an app when its working directory is that app folder
 * or a child of it, or when its command line contains that folder as a path.
 * `apps/pool` does not match `apps/poolcomp`.
 */
export function applicationIsActive({
  applicationFolderPath,
  processPaths,
}: {
  applicationFolderPath: string;
  processPaths: readonly string[];
}): boolean {
  const normalisedFolder = normalisePath(applicationFolderPath);
  return processPaths.some((processPath) => processPathRefersToApplication({ processPath, applicationFolderPath: normalisedFolder }));
}

function processPathRefersToApplication({
  processPath,
  applicationFolderPath,
}: {
  processPath: string;
  applicationFolderPath: string;
}): boolean {
  const normalisedProcessPath = normalisePath(processPath);
  if (normalisedProcessPath === applicationFolderPath) return true;
  if (normalisedProcessPath.startsWith(`${applicationFolderPath}/`)) return true;

  const folderIndex = normalisedProcessPath.indexOf(applicationFolderPath);
  if (folderIndex === -1) return false;

  const characterAfterFolder = normalisedProcessPath[folderIndex + applicationFolderPath.length];
  return characterAfterFolder === undefined || characterAfterFolder === "/" || characterAfterFolder === " " || characterAfterFolder === '"';
}

function normalisePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}
