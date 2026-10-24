import type { EventFromBackend, EventTopic } from "apphub-shared";
import type { ConnectionControls } from "./backendService";

export interface EventSubscriber {
  sendEvent(event: EventFromBackend): void;
}

export interface EventBus {
  /** Registers a connection and returns the controls handlers use to subscribe it to topics. */
  registerConnection(subscriber: EventSubscriber): { controls: ConnectionControls; unregister(): void };
  publish(event: EventFromBackend): void;
}

export function createEventBus(): EventBus {
  const subscriptionsBySubscriber = new Map<EventSubscriber, Set<EventTopic>>();

  return { registerConnection, publish };

  function registerConnection(subscriber: EventSubscriber): { controls: ConnectionControls; unregister(): void } {
    const topics = new Set<EventTopic>();
    subscriptionsBySubscriber.set(subscriber, topics);
    return {
      controls: {
        subscribe: (topic) => {
          topics.add(topic);
        },
        unsubscribe: (topic) => {
          topics.delete(topic);
        },
        listSubscriptions: () => [...topics],
      },
      unregister: () => {
        subscriptionsBySubscriber.delete(subscriber);
      },
    };
  }

  function publish(event: EventFromBackend): void {
    for (const [subscriber, topics] of subscriptionsBySubscriber) {
      if (topics.has(event.topic)) subscriber.sendEvent(event);
    }
  }
}
