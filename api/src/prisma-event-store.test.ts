import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { DuplicateEventError } from './event-store.js';
import { PrismaEventStore } from './prisma-event-store.js';
import { PrismaService } from './prisma.service.js';

const prisma = new PrismaClient();
const store = new PrismaEventStore(prisma as PrismaService);
const okTrace = 'trace_store_ok';
const errorTrace = 'trace_store_error';

const row = (traceId: string, level: string, message: string, timestamp: string) => ({
  traceId,
  service: 'payment-service',
  level,
  message,
  timestamp,
  rawLine: `[${timestamp}] ${level} ${message} (${traceId})`,
});

describe('PrismaEventStore', () => {
  after(async () => {
    await prisma.event.deleteMany({ where: { traceId: { in: [okTrace, errorTrace] } } });
    await prisma.$disconnect();
  });

  it('filters traces in Postgres and keeps a failed replacement', async () => {
    await prisma.event.deleteMany({ where: { traceId: { in: [okTrace, errorTrace] } } });
    await store.add(row(okTrace, 'INFO', 'captured', '2026-06-02T13:00:00.000Z'));
    await store.add(row(errorTrace, 'INFO', 'started', '2026-06-02T13:00:01.000Z'));
    await store.add(row(errorTrace, 'ERROR', 'timed out', '2026-06-02T13:00:02.000Z'));

    const errors = await store.listRecent('error', 50);
    const errorIds = new Set(errors.map((event) => event.traceId));
    assert.equal(errorIds.has(errorTrace), true);
    assert.equal(errorIds.has(okTrace), false);

    const ok = await store.listRecent('ok', 50);
    const okIds = new Set(ok.map((event) => event.traceId));
    assert.equal(okIds.has(okTrace), true);
    assert.equal(okIds.has(errorTrace), false);

    await assert.rejects(
      () => store.add(row(okTrace, 'INFO', 'captured', '2026-06-02T13:00:00.000Z')),
      DuplicateEventError,
    );

    const duplicate = row(okTrace, 'INFO', 'next', '2026-06-02T13:00:03.000Z');
    await assert.rejects(() => store.replaceTraces([duplicate, { ...duplicate }]), DuplicateEventError);
    const remaining = await store.listByTraceId(okTrace);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.message, 'captured');
  });
});
