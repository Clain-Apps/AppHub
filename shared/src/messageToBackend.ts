import type { MessagesFromFrontend } from "../../backend/src/messages-from-frontend/messages-from-frontend";

/**
 * Message types are derived from the backend registry and the handler signatures. Do not write them by hand.
 * This file only imports types, so nothing from the backend is bundled into the frontend.
 */
export type MessageName = keyof MessagesFromFrontend;

type MessageHandler<Name extends MessageName> = MessagesFromFrontend[Name];

export type MessageData<Name extends MessageName> = Parameters<MessageHandler<Name>>[1];

export type MessageResult<Name extends MessageName> = Awaited<ReturnType<MessageHandler<Name>>>;

export type MessageToBackend = {
  [Name in MessageName]: { message: Name; data: MessageData<Name> };
}[MessageName];
