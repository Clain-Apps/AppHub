import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCatalogStore } from "./catalogStore";

describe("catalogStore", () => {
  it("starts empty, then persists a display name and replaces an image", async () => {
    const catalogDirectory = await mkdtemp(join(tmpdir(), "apphub-catalog-"));
    const store = createCatalogStore({ catalogDirectory });

    await expect(store.readCatalogDocument()).resolves.toEqual({ applications: {} });
    await store.saveApplicationDisplay({ folderName: "poolcomp", displayName: "Pool Comp" });
    await store.saveApplicationImage({
      folderName: "poolcomp",
      originalFileName: "tile.png",
      bytes: Buffer.from("first-image"),
    });
    await store.saveApplicationImage({
      folderName: "poolcomp",
      originalFileName: "tile.webp",
      bytes: Buffer.from("second-image"),
    });

    const catalogDocument = await store.readCatalogDocument();
    expect(catalogDocument).toEqual({
      applications: {
        poolcomp: { displayName: "Pool Comp", imageFileName: "poolcomp.webp" },
      },
    });
    await expect(readFile(join(catalogDirectory, "images", "poolcomp.webp"), "utf8")).resolves.toBe("second-image");
  });
});
