import type { HostedApplication } from "./hostedApplication";

/**
 * The only events the backend may push. The frontend must subscribe to a topic first, and the backend
 * pushes only to subscribers of that topic.
 */
export const eventTopics = ["catalog"] as const;
export type EventTopic = (typeof eventTopics)[number];

export type EventFromBackend =
  | {
      topic: "catalog";
      name: "catalogRefreshStarted";
    }
  | {
      topic: "catalog";
      name: "catalogChanged";
      applications: HostedApplication[];
    };

export function isEventTopic(value: string): value is EventTopic {
  return (eventTopics as readonly string[]).includes(value);
}
