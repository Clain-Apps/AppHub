import { createApplicationError, isApplicationError } from "apphub-shared";
import type { IncomingMessage, ServerResponse } from "node:http";
import { stat } from "node:fs/promises";
import type { CatalogStore } from "./catalog/catalogStore";
import type { Configuration } from "./configuration";
import { sendFile, serveStaticFile } from "./http/serveStaticFile";
import { maximumFormBytes, parseMultipartForm, readRequestBody } from "./http/parseMultipartForm";
import { listApplicationFolderNames } from "./host/listApplicationFolderNames";
import type { Logger } from "./logger";
import { folderNameSchema } from "./messages-from-frontend/folderName";
import { isAllowedOrigin } from "./origin";
import { pathWithoutPublicPrefix } from "./publicPathPrefix";

export interface HttpRouteDependencies {
  configuration: Configuration;
  catalogStore: CatalogStore;
  logger: Logger;
  startCatalogRefresh(): Promise<unknown>;
}

const allowedImageMediaTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function createHttpRequestHandler(dependencies: HttpRouteDependencies): (request: IncomingMessage, response: ServerResponse) => void {
  const { configuration, catalogStore, logger } = dependencies;

  return (request, response) => {
    handleRequest(request, response).catch((error: unknown) => {
      const isExpectedFailure = isApplicationError(error);
      if (!isExpectedFailure) logger.log({ level: "error", event: "httpRequestFailed", fields: { errorName: error instanceof Error ? error.name : "unknown" } });
      if (!response.headersSent) sendJson(response, isExpectedFailure ? 400 : 500, { error: describeError(error) });
      else response.end();
    });
  };

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = pathWithoutPublicPrefix({
      path: new URL(request.url ?? "/", "http://localhost").pathname,
      publicPathPrefix: configuration.publicPathPrefix,
    });
    const method = request.method ?? "GET";

    if (method === "GET" && path === "/api/health") return sendJson(response, 200, { status: "ok" });
    if (method === "GET" && path.startsWith("/catalog-images/")) return handleCatalogImage(path, response);
    if (method === "POST" && path === "/api/application-image") return handleApplicationImageUpload(request, response);
    if (method === "GET") {
      const served = await serveStaticFile({
        rootDirectory: configuration.frontendDirectory,
        requestPath: path,
        response,
        fallbackFileName: "index.html",
      });
      if (served) return;
    }
    sendJson(response, 404, { error: { code: "notFound", message: "Not found" } });
  }

  async function handleCatalogImage(path: string, response: ServerResponse): Promise<void> {
    const fileName = decodeURIComponent(path.slice("/catalog-images/".length));
    const filePath = catalogStore.resolveImageFilePath({ fileName });
    const fileStatistics = await stat(filePath).catch(() => null);
    if (!fileStatistics?.isFile()) {
      sendJson(response, 404, { error: { code: "notFound", message: "That image was not found" } });
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    sendFile({ filePath, response });
  }

  async function handleApplicationImageUpload(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!isAllowedOrigin(request.headers.origin, configuration.allowedOrigins)) {
      sendJson(response, 403, { error: { code: "originNotAllowed", message: "This origin is not allowed" } });
      return;
    }
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw createApplicationError("invalidMultipart", "Send the image as a multipart form");
    }
    const body = await readRequestBody({ request, maximumBytes: maximumFormBytes });
    const form = parseMultipartForm({ body, contentType });
    const folderNameResult = folderNameSchema.safeParse(form.fields.folderName);
    if (!folderNameResult.success) throw createApplicationError("invalidFolderName", "Choose an application folder");
    const folderName = folderNameResult.data;
    const folderNames = await listApplicationFolderNames({ appsDirectory: configuration.appsDirectory });
    if (!folderNames.includes(folderName)) {
      throw createApplicationError("applicationNotFound", "That application folder is not deployed", { folderName });
    }
    const imageFile = form.files.find((file) => file.fieldName === "image");
    if (!imageFile || imageFile.bytes.length === 0) throw createApplicationError("missingImage", "Choose an image file");
    if (imageFile.bytes.length > 2 * 1024 * 1024) throw createApplicationError("bodyTooLarge", "The image is too large");
    if (!allowedImageMediaTypes.has(imageFile.mediaType)) {
      throw createApplicationError("unsupportedImageType", "Use a PNG, JPEG, WebP or GIF image");
    }
    await catalogStore.saveApplicationImage({
      folderName,
      originalFileName: imageFile.fileName,
      bytes: imageFile.bytes,
    });
    await dependencies.startCatalogRefresh();
    sendJson(response, 200, { saved: true });
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

export function describeError(error: unknown): { code: string; message: string } {
  if (isApplicationError(error)) return { code: error.code, message: error.message };
  return { code: "internalError", message: "Something went wrong" };
}
