import type { EventFromBackend, EventTopic, HostedApplication } from "apphub-shared";
import type { Configuration } from "./configuration";

/** What one open connection lets a handler do to itself. */
export interface ConnectionControls {
  subscribe(topic: EventTopic): void;
  unsubscribe(topic: EventTopic): void;
  listSubscriptions(): EventTopic[];
}

/**
 * The first argument of every message handler. It carries the shared dependencies and the controls of the
 * connection that made the request. Handlers hold no state of their own.
 */
export interface BackendService {
  configuration: Configuration;
  now(): Date;
  /** Sends an event to every connection subscribed to the event's topic. */
  publishEvent(event: EventFromBackend): void;
  connection: ConnectionControls;
  startCatalogRefresh(): Promise<HostedApplication[]>;
  saveApplicationDisplay({ folderName, displayName }: { folderName: string; displayName: string }): Promise<void>;
}
