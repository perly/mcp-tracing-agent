import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { parseLogLine, type ParsedLogLine } from '@tracing/analyzer';

const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
const logsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mock_logs');

const readParsedLines = async () => {
  const files = await readdir(logsDir);
  const parsed: ParsedLogLine[] = [];

  for (const file of files) {
    if (!file.endsWith('.log')) continue;
    const service = file.replace(/\.log$/, '');
    const content = await readFile(path.join(logsDir, file), 'utf8');
    for (const line of content.split('\n')) {
      if (line.trim() === '') continue;
      const event = parseLogLine(service, line);
      if (!event) {
        throw new Error(`Could not parse ${file}: ${line}`);
      }
      parsed.push(event);
    }
  }

  return parsed;
};

const main = async (): Promise<void> => {
  const events = await readParsedLines();
  const traceIds = [...new Set(events.map((event) => event.traceId))];
  const ready = await fetch(`${apiUrl}/traces`);
  if (!ready.ok) {
    throw new Error(`API at ${apiUrl} returned ${ready.status}. Start it before seeding.`);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.event.deleteMany({ where: { traceId: { in: traceIds } } });
  } finally {
    await prisma.$disconnect();
  }

  for (const event of events) {
    const response = await fetch(`${apiUrl}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        traceId: event.traceId,
        service: event.service,
        level: event.level,
        message: event.message,
        timestamp: event.timestamp,
      }),
    });
    if (!response.ok) {
      throw new Error(`POST /events failed with ${response.status}: ${await response.text()}`);
    }
  }

  console.log(`Seeded ${events.length} events for ${traceIds.join(', ')}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
