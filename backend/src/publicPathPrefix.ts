import { createApplicationError } from "apphub-shared";

/**
 * A public path prefix such as `/allapps`, or an empty string when the app is served at the host root.
 * Incoming requests may include the prefix. Caddy may also strip it before proxying.
 */
export function normalisePublicPathPrefix(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  const segments = withoutTrailingSlash.split("/").filter(Boolean);
  const segmentIsSafe = segments.every((segment) => /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(segment));
  if (!segmentIsSafe) {
    throw createApplicationError(
      "invalidConfiguration",
      "PUBLIC_PATH_PREFIX must be a URL path of letters, numbers, hyphens and underscores",
    );
  }
  return `/${segments.join("/")}`;
}

export function pathWithoutPublicPrefix({
  path,
  publicPathPrefix,
}: {
  path: string;
  publicPathPrefix: string;
}): string {
  if (!publicPathPrefix) return path;
  if (path === publicPathPrefix) return "/";
  if (path.startsWith(`${publicPathPrefix}/`)) return path.slice(publicPathPrefix.length) || "/";
  return path;
}
