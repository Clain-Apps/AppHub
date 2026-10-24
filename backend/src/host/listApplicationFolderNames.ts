import { readdir } from "node:fs/promises";

/** Immediate child directories of the apps folder, skipping hidden names. */
export async function listApplicationFolderNames({ appsDirectory }: { appsDirectory: string }): Promise<string[]> {
  const entries = await readdir(appsDirectory, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissingDirectoryError(error)) return [];
    throw error;
  });

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function isMissingDirectoryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
