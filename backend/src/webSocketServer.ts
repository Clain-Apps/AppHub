import {
  createApplicationError,
  isApplicationError,
  type EventFromBackend,
  type FrameFromBackend,
} from "apphub-shared";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { z } from "zod";
import type { BackendService } from "./backendService";
import type { Configuration } from "./configuration";
import type { EventBus } from "./eventBus";
import type { Logger } from "./logger";
import { getMessageHandler, isMessageHandlerName } from "./messages-from-frontend/messages-from-frontend";
import { isAllowedOrigin } from "./origin";
import { pathWithoutPublicPrefix } from "./publicPathPrefix";

export interface WebSocketDependencies {
  configuration: Configuration;
  eventBus: EventBus;
  logger: Logger;
  now: () => Date;
  createBackendService(connection: BackendService["connection"]): BackendService;
}

const socketPath = "/socket";
const maximumPayloadBytes = 1024 * 1024;
const heartbeatIntervalMilliseconds = 30_000;

const requestEnvelopeSchema = z
  .object({
    correlationIdentifier: z.string().min(1).max(100),
    message: z.string().min(1).max(100),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

/**
 * Accepts a connection only when the request comes from an allowed origin.
 * After that, every frame is a request that gets exactly one response, and events are pushed only to
 * connections that subscribed to the event's topic.
 */
export function attachWebSocketServer(server: Server, dependencies: WebSocketDependencies): { close(): Promise<void> } {
  const { configuration, eventBus, logger } = dependencies;
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: maximumPayloadBytes });
  const aliveBySocket = new Map<WebSocket, boolean>();

  server.on("upgrade", (request, socket, head) => {
    if (!authoriseUpgrade(request)) return rejectUpgrade(socket, 401, "Unauthorized");
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => handleConnection(webSocket));
  });

  const heartbeat = setInterval(() => {
    for (const webSocket of aliveBySocket.keys()) {
      if (aliveBySocket.get(webSocket) === false) {
        webSocket.terminate();
        continue;
      }
      aliveBySocket.set(webSocket, false);
      webSocket.ping();
    }
  }, heartbeatIntervalMilliseconds);
  heartbeat.unref();

  return {
    close: () =>
      new Promise((resolve) => {
        clearInterval(heartbeat);
        for (const webSocket of aliveBySocket.keys()) webSocket.close(1001);
        webSocketServer.close(() => resolve());
      }),
  };

  function authoriseUpgrade(request: IncomingMessage): boolean {
    const path = pathWithoutPublicPrefix({
      path: new URL(request.url ?? "/", "http://localhost").pathname,
      publicPathPrefix: configuration.publicPathPrefix,
    });
    if (path !== socketPath) return false;
    if (!isAllowedOrigin(request.headers.origin, configuration.allowedOrigins)) {
      logger.log({ level: "warning", event: "webSocketOriginRejected" });
      return false;
    }
    return true;
  }

  function rejectUpgrade(socket: Duplex, statusCode: number, statusText: string): void {
    socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  function handleConnection(webSocket: WebSocket): void {
    aliveBySocket.set(webSocket, true);
    webSocket.on("pong", () => {
      aliveBySocket.set(webSocket, true);
    });

    const registration = eventBus.registerConnection({
      sendEvent: (event: EventFromBackend) => sendFrame(webSocket, { event }),
    });
    const backendService = dependencies.createBackendService(registration.controls);

    webSocket.on("message", (rawData, isBinary) => {
      handleMessage(webSocket, backendService, rawData, isBinary).catch(() => {
        logger.log({ level: "error", event: "webSocketMessageFailed" });
      });
    });
    webSocket.on("close", () => {
      aliveBySocket.delete(webSocket);
      registration.unregister();
    });
    webSocket.on("error", () => {
      logger.log({ level: "warning", event: "webSocketError" });
    });
  }

  async function handleMessage(
    webSocket: WebSocket,
    backendService: BackendService,
    rawData: RawData,
    isBinary: boolean,
  ): Promise<void> {
    const correlationIdentifier = readCorrelationIdentifier(rawData);

    try {
      if (isBinary) throw createApplicationError("invalidFrame", "Send text frames only");
      const envelope = parseEnvelope(rawData);
      if (!isMessageHandlerName(envelope.message)) {
        throw createApplicationError("unknownMessage", `Unknown message "${envelope.message}"`);
      }
      const result = await getMessageHandler(envelope.message)(backendService, envelope.data);
      sendFrame(webSocket, { correlationIdentifier: envelope.correlationIdentifier, result });
    } catch (error) {
      if (!isApplicationError(error)) {
        logger.log({ level: "error", event: "messageHandlerFailed", fields: { errorName: error instanceof Error ? error.name : "unknown" } });
      }
      sendFrame(webSocket, {
        correlationIdentifier,
        error: isApplicationError(error)
          ? { code: error.code, message: error.message }
          : { code: "internalError", message: "Something went wrong" },
      });
    }
  }

  function parseEnvelope(rawData: RawData): z.infer<typeof requestEnvelopeSchema> {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawData.toString());
    } catch {
      throw createApplicationError("invalidFrame", "The frame is not valid JSON");
    }
    const result = requestEnvelopeSchema.safeParse(parsedJson);
    if (!result.success) throw createApplicationError("invalidFrame", "The frame must have correlationIdentifier, message and data");
    return result.data;
  }

  function readCorrelationIdentifier(rawData: RawData): string {
    try {
      const parsed: unknown = JSON.parse(rawData.toString());
      if (typeof parsed === "object" && parsed !== null && "correlationIdentifier" in parsed && typeof parsed.correlationIdentifier === "string") {
        return parsed.correlationIdentifier.slice(0, 100);
      }
    } catch {
      // The frame is rejected below with invalidFrame.
    }
    return "";
  }

  function sendFrame(webSocket: WebSocket, frame: FrameFromBackend): void {
    if (webSocket.readyState === webSocket.OPEN) webSocket.send(JSON.stringify(frame));
  }
}
