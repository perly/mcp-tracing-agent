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

export interface EventStore {
  add(event: NewEvent & { rawLine: string }): Promise<StoredEvent>;
  listByTraceId(traceId: string): Promise<StoredEvent[]>;
  listRecent(status: TraceStatus | undefined, limit: number): Promise<StoredEvent[]>;
}

export const EVENT_STORE = Symbol('EVENT_STORE');
