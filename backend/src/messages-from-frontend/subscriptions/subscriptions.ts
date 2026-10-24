import { z } from "zod";
import { eventTopics } from "apphub-shared";
import type { BackendService } from "../../backendService";
import { parseMessageData } from "../parseMessageData";

const topicDataSchema = z.object({ topic: z.enum(eventTopics) }).strict();

/** Subscribes this connection to a topic. Events are pushed only after this. */
export function subscribeToTopic(backendService: BackendService, data: z.infer<typeof topicDataSchema>) {
  const { topic } = parseMessageData(topicDataSchema, data);
  backendService.connection.subscribe(topic);
  return { subscriptions: backendService.connection.listSubscriptions() };
}

export function unsubscribeFromTopic(backendService: BackendService, data: z.infer<typeof topicDataSchema>) {
  const { topic } = parseMessageData(topicDataSchema, data);
  backendService.connection.unsubscribe(topic);
  return { subscriptions: backendService.connection.listSubscriptions() };
}
