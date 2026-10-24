import {
  type EventFromBackend,
  type EventTopic,
  type FrameFromBackend,
  type MessageData,
  type MessageName,
  type MessageResult,
  type RequestEnvelope,
  createApplicationError,
  isEventEnvelope,
  isResponseErrorEnvelope,
} from "apphub-shared";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface WebSocketService {
  /** Resolves when the connection is open. Safe to call again while connecting or open. */
  connect(): Promise<void>;
  /** Sends one request and resolves with its one response, typed from the backend handler. */
  send<Name extends MessageName>(request: { message: Name; data: MessageData<Name> }): Promise<MessageResult<Name>>;
  /** Subscribes to a topic first, then calls the listener for its events. Returns a function that stops listening. */
  subscribe(topic: EventTopic, listener: (event: EventFromBackend) => void): Promise<() => Promise<void>>;
  onConnectionStatusChange(listener: (status: ConnectionStatus) => void): () => void;
  close(): void;
}

export interface WebSocketServiceOptions {
  webAddress: string;
  createSocket?: (webAddress: string) => WebSocket;
  requestTimeoutMilliseconds?: number;
  reconnectDelayMilliseconds?: number;
}

interface PendingRequest {
  resolve(result: unknown): void;
  reject(error: Error): void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

export function createWebSocketService(options: WebSocketServiceOptions): WebSocketService {
  const requestTimeoutMilliseconds = options.requestTimeoutMilliseconds ?? 30_000;
  const reconnectDelayMilliseconds = options.reconnectDelayMilliseconds ?? 2_000;
  const createSocket = options.createSocket ?? ((webAddress: string) => new WebSocket(webAddress));

  const pendingRequests = new Map<string, PendingRequest>();
  const listenersByTopic = new Map<EventTopic, Set<(event: EventFromBackend) => void>>();
  const statusListeners = new Set<(status: ConnectionStatus) => void>();
  let socket: WebSocket | null = null;
  let status: ConnectionStatus = "closed";
  let connectionPromise: Promise<void> | null = null;
  let isClosedOnPurpose = false;
  let nextRequestNumber = 1;
  let currentReconnectDelayMilliseconds = reconnectDelayMilliseconds;
  const maximumReconnectDelayMilliseconds = 30_000;

  return { connect, send, subscribe, onConnectionStatusChange, close };

  function updateStatus(newStatus: ConnectionStatus): void {
    status = newStatus;
    for (const listener of statusListeners) listener(newStatus);
  }

  function connect(): Promise<void> {
    isClosedOnPurpose = false;
    if (status === "open") return Promise.resolve();
    if (connectionPromise) return connectionPromise;
    connectionPromise = new Promise<void>((resolve, reject) => {
      const newSocket = createSocket(options.webAddress);
      socket = newSocket;
      updateStatus("connecting");
      newSocket.addEventListener("open", () => {
        connectionPromise = null;
        currentReconnectDelayMilliseconds = reconnectDelayMilliseconds;
        updateStatus("open");
        resubscribeToTopics().then(resolve, reject);
      });
      newSocket.addEventListener("message", (messageEvent) => handleFrame(messageEvent.data));
      newSocket.addEventListener("close", () => {
        const wasConnecting = connectionPromise !== null;
        connectionPromise = null;
        socket = null;
        updateStatus("closed");
        rejectAllPendingRequests(createApplicationError("connectionClosed", "The connection to the server closed"));
        if (wasConnecting) reject(createApplicationError("connectionFailed", "The connection to the server could not be opened"));
        if (!isClosedOnPurpose) scheduleReconnect();
      });
    });
    return connectionPromise;
  }

  /** Waits longer after each failed attempt, so a closed browser does not keep hammering the server. */
  function scheduleReconnect(): void {
    const delay = currentReconnectDelayMilliseconds;
    currentReconnectDelayMilliseconds = Math.min(currentReconnectDelayMilliseconds * 2, maximumReconnectDelayMilliseconds);
    setTimeout(() => {
      if (!isClosedOnPurpose) connect().catch(() => undefined);
    }, delay);
  }

  async function resubscribeToTopics(): Promise<void> {
    for (const topic of listenersByTopic.keys()) await send({ message: "subscribeToTopic", data: { topic } });
  }

  function send<Name extends MessageName>(request: { message: Name; data: MessageData<Name> }): Promise<MessageResult<Name>> {
    const openSocket = socket;
    if (openSocket === null || status !== "open") {
      return Promise.reject(createApplicationError("connectionClosed", "The connection to the server is not open"));
    }
    const correlationIdentifier = `request-${nextRequestNumber}`;
    nextRequestNumber += 1;
    const envelope: RequestEnvelope = { correlationIdentifier, message: request.message, data: request.data };

    return new Promise<unknown>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        pendingRequests.delete(correlationIdentifier);
        reject(createApplicationError("requestTimedOut", "The server did not answer in time", { message: request.message }));
      }, requestTimeoutMilliseconds);
      pendingRequests.set(correlationIdentifier, { resolve, reject, timeoutHandle });
      openSocket.send(JSON.stringify(envelope));
      // The wire carries untyped JSON. This is the one place the frontend trusts the backend contract
      // derived in shared/src/messageToBackend.ts.
    }) as Promise<MessageResult<Name>>;
  }

  function handleFrame(rawFrame: unknown): void {
    if (typeof rawFrame !== "string") return;
    const frame: FrameFromBackend = JSON.parse(rawFrame);
    if (isEventEnvelope(frame)) {
      for (const listener of listenersByTopic.get(frame.event.topic) ?? []) listener(frame.event);
      return;
    }
    const pending = pendingRequests.get(frame.correlationIdentifier);
    if (!pending) return;
    pendingRequests.delete(frame.correlationIdentifier);
    clearTimeout(pending.timeoutHandle);
    if (isResponseErrorEnvelope(frame)) pending.reject(createApplicationError(frame.error.code, frame.error.message));
    else pending.resolve(frame.result);
  }

  function rejectAllPendingRequests(error: Error): void {
    for (const pending of pendingRequests.values()) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(error);
    }
    pendingRequests.clear();
  }

  async function subscribe(topic: EventTopic, listener: (event: EventFromBackend) => void): Promise<() => Promise<void>> {
    const listeners = listenersByTopic.get(topic) ?? new Set();
    const isFirstListener = listeners.size === 0;
    listeners.add(listener);
    listenersByTopic.set(topic, listeners);
    if (isFirstListener) {
      try {
        await send({ message: "subscribeToTopic", data: { topic } });
      } catch (error) {
        listeners.delete(listener);
        if (listeners.size === 0) listenersByTopic.delete(topic);
        throw error;
      }
    }

    return async () => {
      listeners.delete(listener);
      if (listeners.size > 0) return;
      listenersByTopic.delete(topic);
      if (status === "open") await send({ message: "unsubscribeFromTopic", data: { topic } });
    };
  }

  function onConnectionStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  }

  function close(): void {
    isClosedOnPurpose = true;
    socket?.close();
  }
}
