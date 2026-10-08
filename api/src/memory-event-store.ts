import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventStore, NewEvent, StoredEvent, TraceStatus } from './event-store.js';

@Injectable()
export class MemoryEventStore implements EventStore {
  private readonly events: StoredEvent[] = [];

  async add(event: NewEvent & { rawLine: string }): Promise<StoredEvent> {
    const stored = { ...event, id: randomUUID() };
    this.events.push(stored);
    return stored;
  }

  async listByTraceId(traceId: string): Promise<StoredEvent[]> {
    return this.events
      .filter((event) => event.traceId === traceId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async listRecent(status: TraceStatus | undefined, limit: number): Promise<StoredEvent[]> {
    const grouped = new Map<string, StoredEvent[]>();
    for (const event of this.events) {
      const rows = grouped.get(event.traceId) ?? [];
      rows.push(event);
      grouped.set(event.traceId, rows);
    }

    const endedAt = (rows: StoredEvent[]) =>
      rows.reduce((latest, row) => (row.timestamp > latest ? row.timestamp : latest), '');

    return [...grouped.values()]
      .filter((rows) => {
        if (status === undefined) return true;
        const hasError = rows.some((row) => row.level === 'ERROR');
        return status === 'error' ? hasError : !hasError;
      })
      .sort((a, b) => endedAt(b).localeCompare(endedAt(a)))
      .slice(0, limit)
      .flat();
  }
}
