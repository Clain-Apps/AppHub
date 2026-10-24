import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { createApplicationError } from "apphub-shared";
import { z } from "zod";
import { emptyCatalogDocument, type CatalogDocument } from "./catalogDocument";

const catalogDocumentSchema = z
  .object({
    applications: z.record(
      z.string(),
      z
        .object({
          displayName: z.string().max(80).optional(),
          imageFileName: z.string().max(120).optional(),
        })
        .strict(),
    ),
  })
  .strict();

const allowedImageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"] as const;

export function isAllowedImageExtension(extension: string): boolean {
  return (allowedImageExtensions as readonly string[]).includes(extension.toLowerCase());
}

export function createCatalogStore({ catalogDirectory }: { catalogDirectory: string }) {
  const catalogFilePath = join(catalogDirectory, "catalog.json");
  const imagesDirectory = join(catalogDirectory, "images");

  return {
    readCatalogDocument,
    saveApplicationDisplay,
    saveApplicationImage,
    resolveImageFilePath,
  };

  async function readCatalogDocument(): Promise<CatalogDocument> {
    const text = await readFile(catalogFilePath, "utf8").catch((error: unknown) => {
      if (isMissingFileError(error)) return null;
      throw error;
    });
    if (text === null) return emptyCatalogDocument();
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw createApplicationError("invalidCatalogDocument", "The catalog file is not valid JSON");
    }
    const parsed = catalogDocumentSchema.safeParse(parsedJson);
    if (!parsed.success) throw createApplicationError("invalidCatalogDocument", "The catalog file does not match the expected shape");
    return parsed.data;
  }

  async function saveApplicationDisplay({ folderName, displayName }: { folderName: string; displayName: string }): Promise<void> {
    const catalogDocument = await readCatalogDocument();
    const existing = catalogDocument.applications[folderName] ?? {};
    catalogDocument.applications[folderName] = { ...existing, displayName };
    await writeCatalogDocument(catalogDocument);
  }

  async function saveApplicationImage({
    folderName,
    originalFileName,
    bytes,
  }: {
    folderName: string;
    originalFileName: string;
    bytes: Buffer;
  }): Promise<string> {
    const extension = extname(originalFileName).toLowerCase();
    if (!isAllowedImageExtension(extension)) {
      throw createApplicationError("unsupportedImageType", "Use a PNG, JPEG, WebP or GIF image");
    }
    await mkdir(imagesDirectory, { recursive: true });
    const imageFileName = `${folderName}${extension}`;
    await removePreviousImages({ folderName, keepFileName: imageFileName });
    await writeFile(join(imagesDirectory, imageFileName), bytes);

    const catalogDocument = await readCatalogDocument();
    const existing = catalogDocument.applications[folderName] ?? {};
    catalogDocument.applications[folderName] = { ...existing, imageFileName };
    await writeCatalogDocument(catalogDocument);
    return imageFileName;
  }

  function resolveImageFilePath({ fileName }: { fileName: string }): string {
    if (!/^[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif)$/i.test(fileName) || fileName.includes("..")) {
      throw createApplicationError("invalidImageFileName", "That image name is not allowed");
    }
    return join(imagesDirectory, fileName);
  }

  async function writeCatalogDocument(catalogDocument: CatalogDocument): Promise<void> {
    await mkdir(catalogDirectory, { recursive: true });
    const temporaryFilePath = `${catalogFilePath}.tmp`;
    await writeFile(temporaryFilePath, `${JSON.stringify(catalogDocument, null, 2)}\n`, "utf8");
    await rename(temporaryFilePath, catalogFilePath);
  }

  async function removePreviousImages({ folderName, keepFileName }: { folderName: string; keepFileName: string }): Promise<void> {
    for (const extension of allowedImageExtensions) {
      const candidateFileName = `${folderName}${extension}`;
      if (candidateFileName === keepFileName) continue;
      await unlink(join(imagesDirectory, candidateFileName)).catch(() => undefined);
    }
  }
}

export type CatalogStore = ReturnType<typeof createCatalogStore>;

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
