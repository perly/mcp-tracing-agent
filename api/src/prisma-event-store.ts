import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventStore, NewEvent, StoredEvent, TraceStatus } from './event-store.js';
import { PrismaService } from './prisma.service.js';

const toStored = (event: {
  id: string;
  traceId: string;
  service: string;
  level: string;
  message: string;
  timestamp: Date;
  rawLine: string;
}): StoredEvent => ({
  id: event.id,
  traceId: event.traceId,
  service: event.service,
  level: event.level,
  message: event.message,
  timestamp: event.timestamp.toISOString(),
  rawLine: event.rawLine,
});

@Injectable()
export class PrismaEventStore implements EventStore {
  constructor(private readonly prisma: PrismaService) {}

  async add(event: NewEvent & { rawLine: string }): Promise<StoredEvent> {
    const created = await this.prisma.event.create({
      data: {
        traceId: event.traceId,
        service: event.service,
        level: event.level,
        message: event.message,
        timestamp: new Date(event.timestamp),
        rawLine: event.rawLine,
      },
    });
    return toStored(created);
  }

  async listByTraceId(traceId: string): Promise<StoredEvent[]> {
    const events = await this.prisma.event.findMany({
      where: { traceId },
      orderBy: { timestamp: 'asc' },
    });
    return events.map(toStored);
  }

  async listRecent(status: TraceStatus | undefined, limit: number): Promise<StoredEvent[]> {
    const having =
      status === 'error'
        ? Prisma.sql`HAVING BOOL_OR(level = 'ERROR')`
        : status === 'ok'
          ? Prisma.sql`HAVING NOT BOOL_OR(level = 'ERROR')`
          : Prisma.empty;

    const traces = await this.prisma.$queryRaw<{ traceId: string }[]>`
      SELECT "traceId"
      FROM "Event"
      GROUP BY "traceId"
      ${having}
      ORDER BY MAX(timestamp) DESC
      LIMIT ${limit}
    `;
    const traceIds = traces.map((trace) => trace.traceId);
    if (traceIds.length === 0) return [];

    const events = await this.prisma.event.findMany({
      where: { traceId: { in: traceIds } },
      orderBy: { timestamp: 'asc' },
    });
    return events.map(toStored);
  }
}
