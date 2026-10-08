export type NewEvent = {
  traceId: string;
  service: string;
  level: string;
  message: string;
  timestamp: string;
};

export type StoredEvent = NewEvent & {
  id: string;
  rawLine: string;
};

export type TraceStatus = 'ok' | 'error';

export class DuplicateEventError extends Error {
  constructor() {
    super('This event is already stored');
    this.name = 'DuplicateEventError';
  }
}

export const eventKey = (event: {
  traceId: string;
  service: string;
  timestamp: string;
  rawLine: string;
}): string => `${event.traceId}\0${event.service}\0${event.timestamp}\0${event.rawLine}`;

export const assertUniqueEvents = (
  events: { traceId: string; service: string; timestamp: string; rawLine: string }[],
): void => {
  const seen = new Set<string>();
  for (const event of events) {
    const key = eventKey(event);
    if (seen.has(key)) throw new DuplicateEventError();
    seen.add(key);
  }
};

export interface EventStore {
  add(event: NewEvent & { rawLine: string }): Promise<StoredEvent>;
  replaceTraces(events: (NewEvent & { rawLine: string })[]): Promise<number>;
  listByTraceId(traceId: string): Promise<StoredEvent[]>;
  listRecent(status: TraceStatus | undefined, limit: number): Promise<StoredEvent[]>;
}

export const EVENT_STORE = Symbol('EVENT_STORE');
