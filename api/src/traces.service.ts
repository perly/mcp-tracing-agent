import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { formatRawLine, traceFromEvents, type TraceEvent } from '@tracing/analyzer';
import {
  EVENT_STORE,
  type EventStore,
  type NewEvent,
  type StoredEvent,
  type TraceStatus,
} from './event-store.js';

const TRACE_LIST_LIMIT = 50;

const parseStatus = (status?: string): TraceStatus | undefined => {
  if (status === undefined) return undefined;
  if (status === 'ok' || status === 'error') return status;
  throw new BadRequestException('status must be ok or error');
};

const toTraceEvent = (event: StoredEvent): TraceEvent => ({
  service: event.service,
  level: event.level,
  rawLine: event.rawLine,
  timestamp: event.timestamp,
});

@Injectable()
export class TracesService {
  constructor(@Inject(EVENT_STORE) private readonly store: EventStore) {}

  async create(input: NewEvent): Promise<StoredEvent> {
    return this.store.add({
      ...input,
      rawLine: formatRawLine(input),
    });
  }

  async findOne(traceId: string) {
    const events = (await this.store.listByTraceId(traceId)).map(toTraceEvent);
    return traceFromEvents(traceId, events);
  }

  async list(status?: string) {
    const traceStatus = parseStatus(status);
    const grouped = new Map<string, StoredEvent[]>();
    for (const event of await this.store.listRecent(traceStatus, TRACE_LIST_LIMIT)) {
      const rows = grouped.get(event.traceId) ?? [];
      rows.push(event);
      grouped.set(event.traceId, rows);
    }

    const summaries = [...grouped.entries()].map(([traceId, rows]) => {
      const { summary } = traceFromEvents(traceId, rows.map(toTraceEvent));
      return {
        ...summary,
        status: summary.firstError ? ('error' as const) : ('ok' as const),
      };
    });

    return summaries.sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));
  }
}
