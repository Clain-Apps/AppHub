import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listApplicationFolderNames } from "./listApplicationFolderNames";

describe("listApplicationFolderNames", () => {
  it("lists visible child directories and skips hidden names and files", async () => {
    const appsDirectory = await mkdtemp(join(tmpdir(), "apphub-apps-"));
    await mkdir(join(appsDirectory, "poolcomp"));
    await mkdir(join(appsDirectory, "journal"));
    await mkdir(join(appsDirectory, ".hidden"));
    await writeFile(join(appsDirectory, "readme.txt"), "not a folder");

    await expect(listApplicationFolderNames({ appsDirectory })).resolves.toEqual(["journal", "poolcomp"]);
  });

  it("returns an empty list when the apps directory is missing", async () => {
    await expect(listApplicationFolderNames({ appsDirectory: join(tmpdir(), "apphub-missing-apps") })).resolves.toEqual([]);
  });
});
