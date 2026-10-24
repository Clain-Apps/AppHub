import { mkdir, mkdtemp } from "node:fs/promises";
import { request as sendHttpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApplication, type Application } from "./application";
import type { Configuration } from "./configuration";
import { createLogger } from "./logger";

const allowedOrigin = "http://allowed.test";

interface Frame {
  correlationIdentifier?: string;
  result?: unknown;
  error?: { code: string; message: string };
  event?: { topic: string; name: string; applications?: unknown };
}

describe("application: catalog refresh over the WebSocket", () => {
  let application: Application;
  let port: number;
  let appsDirectory: string;

  beforeAll(async () => {
    appsDirectory = await mkdtemp(join(tmpdir(), "apphub-app-apps-"));
    const catalogDirectory = await mkdtemp(join(tmpdir(), "apphub-app-catalog-"));
    await mkdir(join(appsDirectory, "poolcomp"));
    await mkdir(join(appsDirectory, "journal"));
    const configuration: Configuration = {
      appsDirectory,
      catalogDirectory,
      publicApplicationHost: "example.test",
      port: 0,
      allowedOrigins: [allowedOrigin],
      frontendDirectory: join(tmpdir(), "apphub-missing-frontend"),
      listenHost: "127.0.0.1",
      publicPathPrefix: "/allapps",
    };
    application = createApplication({
      configuration,
      logger: createLogger(() => undefined),
      listProcessPaths: async () => [join(appsDirectory, "poolcomp")],
    });
    port = await application.start(0);
  });

  afterAll(async () => {
    await application.stop();
  });

  it("rejects a socket from a disallowed origin", async () => {
    await expect(openSocket("http://other.test")).rejects.toMatchObject({ message: expect.stringMatching(/401|Unexpected server response/i) });
  });

  it("pushes a refresh started event then the merged catalog", async () => {
    const socket = await openSocket(allowedOrigin);
    const frames: Frame[] = [];
    socket.on("message", (raw) => {
      frames.push(JSON.parse(raw.toString()) as Frame);
    });

    socket.send(JSON.stringify({ correlationIdentifier: "subscribe-1", message: "subscribeToTopic", data: { topic: "catalog" } }));
    await waitFor(() => frames.some((frame) => frame.correlationIdentifier === "subscribe-1"));

    socket.send(JSON.stringify({ correlationIdentifier: "refresh-1", message: "refreshCatalog", data: {} }));
    await waitFor(() => frames.some((frame) => frame.event?.name === "catalogChanged"));

    expect(frames.some((frame) => frame.event?.name === "catalogRefreshStarted")).toBe(true);
    const changed = frames.find((frame) => frame.event?.name === "catalogChanged");
    expect(changed?.event?.applications).toEqual([
      {
        folderName: "journal",
        displayName: "journal",
        imageAddress: null,
        webAddress: "https://journal.example.test",
        isActive: false,
      },
      {
        folderName: "poolcomp",
        displayName: "poolcomp",
        imageAddress: null,
        webAddress: "https://poolcomp.example.test",
        isActive: true,
      },
    ]);

    const health = await sendHttp("GET", "/api/health");
    expect(health).toEqual({ statusCode: 200, body: { status: "ok" } });
    const prefixedHealth = await sendHttp("GET", "/allapps/api/health");
    expect(prefixedHealth).toEqual({ statusCode: 200, body: { status: "ok" } });
    socket.close();
  });

  function openSocket(origin: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin });
      socket.once("open", () => resolve(socket));
      socket.once("error", reject);
    });
  }

  function sendHttp(method: string, path: string): Promise<{ statusCode: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const outgoing = sendHttpRequest({ host: "127.0.0.1", port, method, path }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          resolve({
            statusCode: incoming.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          });
        });
      });
      outgoing.on("error", reject);
      outgoing.end();
    });
  }
});

function waitFor(condition: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (Date.now() - started > 5_000) {
        clearInterval(interval);
        reject(new Error("Timed out waiting for a WebSocket frame"));
      }
    }, 20);
  });
}
