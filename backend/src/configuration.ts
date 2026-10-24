import { createApplicationError } from "apphub-shared";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { normalisePublicPathPrefix } from "./publicPathPrefix";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Loads the `.env` file at the repository root for local development when it exists.
 * Variables already set in the environment (production) are never overridden.
 */
export function loadEnvironmentFile(): void {
  const environmentFilePath = fileURLToPath(new URL("../../.env", import.meta.url));
  if (existsSync(environmentFilePath)) process.loadEnvFile(environmentFilePath);
}

const environmentSchema = z.object({
  APPS_DIRECTORY: z.string().min(1).default("./.data/apps"),
  CATALOG_DIRECTORY: z.string().min(1).default("./.data/catalog"),
  PUBLIC_APPLICATION_HOST: z.string().min(1).default("localhost"),
  BACKEND_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5180"),
  FRONTEND_DIRECTORY: z.string().optional(),
  LISTEN_HOST: z.string().min(1).default("127.0.0.1"),
  PUBLIC_PATH_PREFIX: z.string().optional(),
});

export interface Configuration {
  appsDirectory: string;
  catalogDirectory: string;
  publicApplicationHost: string;
  port: number;
  allowedOrigins: string[];
  frontendDirectory: string;
  listenHost: string;
  publicPathPrefix: string;
}

export function loadConfiguration(environment: Record<string, string | undefined> = process.env): Configuration {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw createApplicationError("invalidConfiguration", `Invalid configuration. ${messages.join("; ")}`);
  }
  const values = result.data;
  return {
    appsDirectory: resolveConfiguredPath(values.APPS_DIRECTORY),
    catalogDirectory: resolveConfiguredPath(values.CATALOG_DIRECTORY),
    publicApplicationHost: values.PUBLIC_APPLICATION_HOST.trim(),
    port: values.BACKEND_PORT,
    allowedOrigins: values.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    frontendDirectory: values.FRONTEND_DIRECTORY
      ? resolveConfiguredPath(values.FRONTEND_DIRECTORY)
      : resolve(repositoryRoot, "frontend/dist"),
    listenHost: values.LISTEN_HOST.trim(),
    publicPathPrefix: normalisePublicPathPrefix(values.PUBLIC_PATH_PREFIX),
  };
}

function resolveConfiguredPath(configuredPath: string): string {
  return isAbsolute(configuredPath) ? configuredPath : resolve(repositoryRoot, configuredPath);
}
