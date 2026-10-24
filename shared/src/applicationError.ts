export interface ApplicationError extends Error {
  code: string;
  details: Record<string, unknown> | undefined;
}

/**
 * Classes are not used in this codebase, so structured errors are plain `Error` objects
 * that carry a stable `code`. Callers branch on `code`, never on the message text.
 */
export function createApplicationError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApplicationError {
  const error = new Error(message);
  return Object.assign(error, { code, details });
}

export function isApplicationError(value: unknown): value is ApplicationError {
  return value instanceof Error && "code" in value && typeof value.code === "string";
}
