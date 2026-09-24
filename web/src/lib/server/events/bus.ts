import type { ActivityItem, OnlineList, Status } from '$lib/api/types';

export type BusEvent =
  | { channel: 'status'; data: Status }
  | { channel: 'online'; data: OnlineList }
  | { channel: 'activity'; id: string; data: ActivityItem };

export type BusListener = (event: BusEvent) => void;

export interface EventBus {
  publish(event: BusEvent): void;
  subscribe(listener: BusListener): () => void;
  listenerCount(): number;
}

export function createBus(): EventBus {
  const listeners = new Set<BusListener>();
  return {
    publish(event) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('bus listener failed', error);
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    listenerCount: () => listeners.size
  };
}

export const bus: EventBus = createBus();
