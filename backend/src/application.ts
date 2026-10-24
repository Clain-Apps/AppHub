import { createServer, type Server } from "node:http";
import type { ConnectionControls } from "./backendService";
import { createCatalogRefresh } from "./catalog/createCatalogRefresh";
import { createCatalogStore } from "./catalog/catalogStore";
import type { Configuration } from "./configuration";
import { createEventBus, type EventBus } from "./eventBus";
import { createHostedApplicationLister } from "./host/listHostedApplications";
import { listProcessPaths } from "./host/listProcessPaths";
import { createHttpRequestHandler } from "./httpRoutes";
import type { Logger } from "./logger";
import { attachWebSocketServer } from "./webSocketServer";

export interface ApplicationDependencies {
  configuration: Configuration;
  logger: Logger;
  now?: () => Date;
  listProcessPaths?: () => Promise<string[]>;
}

export interface Application {
  server: Server;
  eventBus: EventBus;
  start(port: number): Promise<number>;
  stop(): Promise<void>;
}

/** Builds the HTTP server and the WebSocket server on top of it. Nothing listens until `start`. */
export function createApplication(dependencies: ApplicationDependencies): Application {
  const now = dependencies.now ?? (() => new Date());
  const eventBus = createEventBus();
  const catalogStore = createCatalogStore({ catalogDirectory: dependencies.configuration.catalogDirectory });
  const hostedApplicationLister = createHostedApplicationLister({
    configuration: dependencies.configuration,
    catalogStore,
    listProcessPaths: dependencies.listProcessPaths ?? listProcessPaths,
  });
  const catalogRefresh = createCatalogRefresh({
    listApplications: hostedApplicationLister.listApplications,
    publishEvent: eventBus.publish,
  });

  const server = createServer(
    createHttpRequestHandler({
      configuration: dependencies.configuration,
      catalogStore,
      logger: dependencies.logger,
      startCatalogRefresh: catalogRefresh.startCatalogRefresh,
    }),
  );
  const webSockets = attachWebSocketServer(server, {
    configuration: dependencies.configuration,
    eventBus,
    logger: dependencies.logger,
    now,
    createBackendService,
  });

  return { server, eventBus, start, stop };

  function createBackendService(connection: ConnectionControls) {
    return {
      configuration: dependencies.configuration,
      now,
      publishEvent: eventBus.publish,
      connection,
      startCatalogRefresh: catalogRefresh.startCatalogRefresh,
      saveApplicationDisplay: catalogStore.saveApplicationDisplay,
    };
  }

  function start(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen({ port, host: dependencies.configuration.listenHost }, () => {
        const address = server.address();
        resolve(typeof address === "object" && address !== null ? address.port : port);
      });
    });
  }

  async function stop(): Promise<void> {
    await webSockets.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
}
