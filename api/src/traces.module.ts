import { Module } from '@nestjs/common';
import { EVENT_STORE } from './event-store.js';
import { EventsController } from './events.controller.js';
import { PrismaEventStore } from './prisma-event-store.js';
import { PrismaService } from './prisma.service.js';
import { TracesController } from './traces.controller.js';
import { TracesService } from './traces.service.js';

@Module({
  controllers: [EventsController, TracesController],
  providers: [
    TracesService,
    PrismaService,
    { provide: EVENT_STORE, useClass: PrismaEventStore },
  ],
})
export class TracesModule {}
