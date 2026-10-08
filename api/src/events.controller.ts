import { Body, Controller, Post } from '@nestjs/common';
import { CreateEventDto, ReplaceEventsDto } from './create-event.dto.js';
import { TracesService } from './traces.service.js';

@Controller('events')
export class EventsController {
  constructor(private readonly traces: TracesService) {}

  @Post('batch')
  replace(@Body() body: ReplaceEventsDto) {
    return this.traces.replace(body.events);
  }

  @Post()
  create(@Body() body: CreateEventDto) {
    return this.traces.create(body);
  }
}
