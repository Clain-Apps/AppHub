import { z } from "zod";

export const folderNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "The folder name may only contain letters, numbers, dots, underscores and hyphens");
