import { Body, Controller, Post } from '@nestjs/common';
import { CreateEventDto } from './create-event.dto.js';
import { TracesService } from './traces.service.js';

@Controller('events')
export class EventsController {
  constructor(private readonly traces: TracesService) {}

  @Post()
  create(@Body() body: CreateEventDto) {
    return this.traces.create(body);
  }
}
