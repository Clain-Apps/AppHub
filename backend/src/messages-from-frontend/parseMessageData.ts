import type { z } from "zod";
import { createApplicationError } from "apphub-shared";

/** The first statement of every handler. It returns the validated data or throws `invalidMessageData`. */
export function parseMessageData<Schema extends z.ZodType>(schema: Schema, data: unknown): z.infer<Schema> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `${issue.path.join(".") || "data"}: ${issue.message}`);
  throw createApplicationError("invalidMessageData", `The request data is invalid. ${problems.join("; ")}`, { problems });
}
