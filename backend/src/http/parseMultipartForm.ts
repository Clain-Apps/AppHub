import { createApplicationError } from "apphub-shared";

export type MultipartFile = {
  fieldName: string;
  fileName: string;
  mediaType: string;
  bytes: Buffer;
};

export type MultipartForm = {
  fields: Record<string, string>;
  files: MultipartFile[];
};

const maximumFormBytes = 2 * 1024 * 1024 + 16 * 1024;

export function parseMultipartForm({ body, contentType }: { body: Buffer; contentType: string }): MultipartForm {
  const boundary = readBoundary(contentType);
  const boundaryMarker = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(body, boundaryMarker);
  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  for (const part of parts) {
    const parsedPart = parsePart(part);
    if (!parsedPart) continue;
    if (parsedPart.fileName !== undefined) {
      files.push({
        fieldName: parsedPart.fieldName,
        fileName: parsedPart.fileName,
        mediaType: parsedPart.mediaType ?? "application/octet-stream",
        bytes: parsedPart.bytes,
      });
      continue;
    }
    fields[parsedPart.fieldName] = parsedPart.bytes.toString("utf8");
  }

  return { fields, files };
}

export async function readRequestBody({
  request,
  maximumBytes,
}: {
  request: AsyncIterable<Buffer | string>;
  maximumBytes: number;
}): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maximumBytes) throw createApplicationError("bodyTooLarge", "The request body is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export { maximumFormBytes };

function readBoundary(contentType: string): string {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) throw createApplicationError("invalidMultipart", "The form is missing a boundary");
  return boundary.trim();
}

function parsePart(part: Buffer): { fieldName: string; fileName?: string; mediaType?: string; bytes: Buffer } | null {
  const trimmed = stripBoundaryPadding(part);
  if (trimmed.length === 0 || trimmed.equals(Buffer.from("--")) || trimmed.equals(Buffer.from("--\r\n"))) return null;

  const headerSeparator = Buffer.from("\r\n\r\n");
  const separatorIndex = indexOfBuffer(trimmed, headerSeparator);
  if (separatorIndex === -1) return null;

  const headerText = trimmed.subarray(0, separatorIndex).toString("utf8");
  let bytes = trimmed.subarray(separatorIndex + headerSeparator.length);
  if (bytes.subarray(-2).equals(Buffer.from("\r\n"))) bytes = bytes.subarray(0, -2);

  const disposition = /content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(headerText);
  if (!disposition?.[1]) return null;
  const mediaTypeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText);
  return {
    fieldName: disposition[1],
    fileName: disposition[2] || undefined,
    mediaType: mediaTypeMatch?.[1]?.trim(),
    bytes,
  };
}

function stripBoundaryPadding(part: Buffer): Buffer {
  let start = 0;
  if (part.subarray(0, 2).equals(Buffer.from("\r\n"))) start = 2;
  return part.subarray(start);
}

function splitBuffer(source: Buffer, separator: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  while (start <= source.length) {
    const foundAt = indexOfBuffer(source, separator, start);
    if (foundAt === -1) {
      parts.push(source.subarray(start));
      break;
    }
    parts.push(source.subarray(start, foundAt));
    start = foundAt + separator.length;
  }
  return parts;
}

function indexOfBuffer(source: Buffer, search: Buffer, fromIndex = 0): number {
  return source.indexOf(search, fromIndex);
}
