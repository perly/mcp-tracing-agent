import { Module } from '@nestjs/common';
import { TracesModule } from './traces.module.js';

@Module({
  imports: [TracesModule],
})
export class AppModule {}
