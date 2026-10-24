import type { BackendService } from "../backendService";
import { refreshCatalog } from "./catalog/refreshCatalog";
import { updateApplicationDisplay } from "./catalog/updateApplicationDisplay";
import { ping } from "./ping/ping";
import { subscribeToTopic, unsubscribeFromTopic } from "./subscriptions/subscriptions";

/**
 * The registry of every message the frontend may send. Each key is the message name. The derived types
 * in shared/src/messageToBackend.ts follow this object, so adding a handler here is the only step needed.
 */
export const messagesFromFrontend = {
  ping,
  refreshCatalog,
  updateApplicationDisplay,
  subscribeToTopic,
  unsubscribeFromTopic,
} as const;

export type MessagesFromFrontend = typeof messagesFromFrontend;

export type MessageHandlerName = keyof MessagesFromFrontend;

type UntypedMessageHandler = (backendService: BackendService, data: unknown) => unknown;

export function isMessageHandlerName(message: string): message is MessageHandlerName {
  return Object.hasOwn(messagesFromFrontend, message);
}

export function getMessageHandler(message: MessageHandlerName): UntypedMessageHandler {
  return messagesFromFrontend[message] as UntypedMessageHandler;
}
