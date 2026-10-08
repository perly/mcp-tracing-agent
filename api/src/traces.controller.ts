import { Controller, Get, Param, Query } from '@nestjs/common';
import { TracesService } from './traces.service.js';

@Controller('traces')
export class TracesController {
  constructor(private readonly traces: TracesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.traces.list(status);
  }

  @Get(':traceId')
  findOne(@Param('traceId') traceId: string) {
    return this.traces.findOne(traceId);
  }
}
