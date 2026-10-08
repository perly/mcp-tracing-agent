import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from './configure-app.js';
import { EVENT_STORE } from './event-store.js';
import { EventsController } from './events.controller.js';
import { MemoryEventStore } from './memory-event-store.js';
import { TracesController } from './traces.controller.js';
import { TracesService } from './traces.service.js';

const trace500Events = [
  {
    traceId: 'trace_500',
    service: 'gateway-service',
    level: 'INFO',
    message: 'Payment success received, returning 200 OK to client',
    timestamp: '2026-06-02T11:00:05.100Z',
  },
  {
    traceId: 'trace_500',
    service: 'payment-service',
    level: 'ERROR',
    message: 'Payment provider timed out after 5000ms',
    timestamp: '2026-06-02T11:00:05.000Z',
  },
  {
    traceId: 'trace_500',
    service: 'gateway-service',
    level: 'INFO',
    message: 'Received POST /orders request',
    timestamp: '2026-06-02T11:00:00.000Z',
  },
  {
    traceId: 'trace_500',
    service: 'gateway-service',
    level: 'INFO',
    message: 'Forwarding payment request to payment-service',
    timestamp: '2026-06-02T11:00:00.050Z',
  },
  {
    traceId: 'trace_500',
    service: 'payment-service',
    level: 'INFO',
    message: 'Processing payment for order_id_77',
    timestamp: '2026-06-02T11:00:00.100Z',
  },
];

describe('traces', () => {
  let app: INestApplication;

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EventsController, TracesController],
      providers: [TracesService, { provide: EVENT_STORE, useClass: MemoryEventStore }],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it('names payment-service as the first error for trace_500', async () => {
    for (const event of trace500Events) {
      await request(app.getHttpServer()).post('/events').send(event).expect(201);
    }

    const response = await request(app.getHttpServer()).get('/traces/trace_500').expect(200);

    assert.deepEqual(
      response.body.events.map((event: { timestamp: string }) => event.timestamp),
      [
        '2026-06-02T11:00:00.000Z',
        '2026-06-02T11:00:00.050Z',
        '2026-06-02T11:00:00.100Z',
        '2026-06-02T11:00:05.000Z',
        '2026-06-02T11:00:05.100Z',
      ],
    );
    assert.equal(response.body.summary.firstError.service, 'payment-service');
    assert.match(response.body.summary.firstError.line, /timed out/);
    assert.ok(
      response.body.events.some(
        (event: { service: string; rawLine: string }) =>
          event.service === 'gateway-service' && event.rawLine.includes('200 OK'),
      ),
    );

    const list = await request(app.getHttpServer()).get('/traces?status=error').expect(200);
    assert.equal(list.body[0].traceId, 'trace_500');
    assert.equal(list.body[0].status, 'error');
  });
});
