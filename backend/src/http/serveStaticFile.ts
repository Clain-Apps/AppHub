import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const mediaTypeByExtension: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

export async function serveStaticFile({
  rootDirectory,
  requestPath,
  response,
  fallbackFileName,
}: {
  rootDirectory: string;
  requestPath: string;
  response: ServerResponse;
  fallbackFileName?: string;
}): Promise<boolean> {
  const relativePath = requestPath === "/" ? (fallbackFileName ?? "index.html") : requestPath.replace(/^\//, "");
  const candidatePath = resolve(join(rootDirectory, relativePath));
  if (!isInsideDirectory({ filePath: candidatePath, rootDirectory })) return false;

  const fileStatistics = await stat(candidatePath).catch(() => null);
  if (fileStatistics?.isFile()) {
    sendFile({ filePath: candidatePath, response });
    return true;
  }

  if (!fallbackFileName) return false;
  const fallbackPath = resolve(join(rootDirectory, fallbackFileName));
  if (!isInsideDirectory({ filePath: fallbackPath, rootDirectory })) return false;
  const fallbackStatistics = await stat(fallbackPath).catch(() => null);
  if (!fallbackStatistics?.isFile()) return false;
  sendFile({ filePath: fallbackPath, response });
  return true;
}

export function sendFile({ filePath, response }: { filePath: string; response: ServerResponse }): void {
  const mediaType = mediaTypeByExtension[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  response.statusCode = 200;
  response.setHeader("Content-Type", mediaType);
  response.setHeader("X-Content-Type-Options", "nosniff");
  createReadStream(filePath).pipe(response);
}

function isInsideDirectory({ filePath, rootDirectory }: { filePath: string; rootDirectory: string }): boolean {
  const resolvedRoot = resolve(rootDirectory);
  return filePath === resolvedRoot || filePath.startsWith(resolvedRoot + sep);
}
