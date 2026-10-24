import { z } from "zod";
import type { BackendService } from "../../backendService";
import { parseMessageData } from "../parseMessageData";

const pingDataSchema = z.object({}).strict();

/** Confirms the connection works and returns the server time. */
export function ping(backendService: BackendService, data: z.infer<typeof pingDataSchema>) {
  parseMessageData(pingDataSchema, data);
  return { serverTime: backendService.now().toISOString() };
}
