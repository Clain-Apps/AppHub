import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWebSocketService, type WebSocketService } from "./websockets.service";

interface FakeSocketControls {
  socket: WebSocket;
  sentFrames: Array<{ correlationIdentifier: string; message: string; data: Record<string, unknown> }>;
  open(): void;
  receive(frame: unknown): void;
  closeFromServer(): void;
}

function createFakeSocket(): FakeSocketControls {
  const handlersByType = new Map<string, Array<(event: unknown) => void>>();
  const sentFrames: FakeSocketControls["sentFrames"] = [];

  function emit(type: string, event: unknown): void {
    for (const handler of handlersByType.get(type) ?? []) handler(event);
  }

  const socket = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlersByType.set(type, [...(handlersByType.get(type) ?? []), handler]);
    },
    send: (text: string) => {
      sentFrames.push(JSON.parse(text));
    },
    close: () => emit("close", {}),
  } as unknown as WebSocket;

  return {
    socket,
    sentFrames,
    open: () => emit("open", {}),
    receive: (frame) => emit("message", { data: JSON.stringify(frame) }),
    closeFromServer: () => emit("close", {}),
  };
}

describe("web socket service", () => {
  let fakeSockets: FakeSocketControls[];
  let service: WebSocketService;

  beforeEach(() => {
    fakeSockets = [];
    service = createWebSocketService({
      webAddress: "ws://localhost/socket",
      createSocket: () => {
        const fakeSocket = createFakeSocket();
        fakeSockets.push(fakeSocket);
        return fakeSocket.socket;
      },
      requestTimeoutMilliseconds: 1000,
      reconnectDelayMilliseconds: 500,
    });
  });

  afterEach(() => {
    service.close();
    vi.useRealTimers();
  });

  async function connectService(): Promise<FakeSocketControls> {
    const connecting = service.connect();
    const fakeSocket = fakeSockets[fakeSockets.length - 1];
    if (!fakeSocket) throw new Error("No socket was created");
    fakeSocket.open();
    await connecting;
    return fakeSocket;
  }

  it("matches each response to its request by correlation identifier, whatever order they arrive in", async () => {
    const fakeSocket = await connectService();
    const first = service.send({ message: "ping", data: {} });
    const second = service.send({ message: "ping", data: {} });
    const [firstFrame, secondFrame] = fakeSocket.sentFrames;

    fakeSocket.receive({ correlationIdentifier: secondFrame?.correlationIdentifier, result: { serverTime: "second" } });
    fakeSocket.receive({ correlationIdentifier: firstFrame?.correlationIdentifier, result: { serverTime: "first" } });

    expect((await first).serverTime).toBe("first");
    expect((await second).serverTime).toBe("second");
  });

  it("rejects with the backend error code so callers can branch on it", async () => {
    const fakeSocket = await connectService();
    const request = service.send({ message: "subscribeToTopic", data: { topic: "catalog" } });
    fakeSocket.receive({ correlationIdentifier: fakeSocket.sentFrames[0]?.correlationIdentifier, error: { code: "invalidMessageData", message: "Bad" } });
    await expect(request).rejects.toMatchObject({ code: "invalidMessageData" });
  });

  it("subscribes to the topic before it listens, and delivers only that topic's events", async () => {
    const fakeSocket = await connectService();
    const receivedEvents: unknown[] = [];
    const subscribing = service.subscribe("catalog", (event) => receivedEvents.push(event));
    expect(fakeSocket.sentFrames[0]).toMatchObject({ message: "subscribeToTopic", data: { topic: "catalog" } });
    fakeSocket.receive({ correlationIdentifier: fakeSocket.sentFrames[0]?.correlationIdentifier, result: { subscriptions: ["catalog"] } });
    const unsubscribe = await subscribing;

    const catalogEvent = { topic: "catalog", name: "catalogRefreshStarted" as const };
    fakeSocket.receive({ event: catalogEvent });
    expect(receivedEvents).toEqual([catalogEvent]);

    const unsubscribing = unsubscribe();
    expect(fakeSocket.sentFrames[1]).toMatchObject({ message: "unsubscribeFromTopic", data: { topic: "catalog" } });
    fakeSocket.receive({ correlationIdentifier: fakeSocket.sentFrames[1]?.correlationIdentifier, result: { subscriptions: [] } });
    await unsubscribing;
    fakeSocket.receive({ event: catalogEvent });
    expect(receivedEvents).toHaveLength(1);
  });
});
