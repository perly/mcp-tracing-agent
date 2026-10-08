export type TraceEvent = {
  service: string;
  level: string;
  rawLine: string;
  timestamp: string;
};

export type TraceSummary = {
  traceId: string;
  eventCount: number;
  services: string[];
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  firstError: { service: string; timestamp: string; line: string } | null;
};

export type ServiceLog = {
  service: string;
  content: string;
};

export type ParsedLogLine = {
  service: string;
  timestamp: string;
  level: string;
  message: string;
  traceId: string;
  rawLine: string;
};

const LOG_LINE = /^\[(.+?)\]\s+([A-Z]+)\s+(.+?)\s+\(([^)]+)\)\s*$/;

export const parseLogLine = (service: string, line: string): ParsedLogLine | null => {
  const match = line.match(LOG_LINE);
  if (!match) return null;
  const timestamp = match[1];
  const level = match[2];
  const message = match[3];
  const traceId = match[4];
  if (!timestamp || !level || !message || !traceId) return null;
  return { service, timestamp, level, message, traceId, rawLine: line };
};

const parseLine = (service: string, line: string): TraceEvent => {
  const parsed = parseLogLine(service, line);
  if (parsed) {
    return { service, level: parsed.level, rawLine: line, timestamp: parsed.timestamp };
  }
  const timestamp = line.match(/\[(.*?)\]/)?.[1] ?? new Date().toISOString();
  const level = line.match(/\]\s+([A-Z]+)\s/)?.[1] ?? "UNKNOWN";
  return { service, level, rawLine: line, timestamp };
};

export const summarizeTrace = (traceId: string, events: TraceEvent[]): TraceSummary => {
  const services = [...new Set(events.map((event) => event.service))];
  const first = events[0];
  const last = events[events.length - 1];
  const startedAt = first?.timestamp ?? null;
  const endedAt = last?.timestamp ?? null;
  const durationMs =
    startedAt && endedAt
      ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
      : null;
  const firstError = events.find((event) => event.level === "ERROR") ?? null;

  return {
    traceId,
    eventCount: events.length,
    services,
    startedAt,
    endedAt,
    durationMs,
    firstError: firstError
      ? { service: firstError.service, timestamp: firstError.timestamp, line: firstError.rawLine }
      : null,
  };
};

export const formatRawLine = (input: {
  timestamp: string;
  level: string;
  message: string;
  traceId: string;
}): string => `[${input.timestamp}] ${input.level} ${input.message} (${input.traceId})`;

const orderEvents = (events: TraceEvent[]): TraceEvent[] =>
  [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

export const traceFromEvents = (traceId: string, events: TraceEvent[]) => {
  const ordered = orderEvents(events);
  return { summary: summarizeTrace(traceId, ordered), events: ordered };
};

export const analyzeTrace = (traceId: string, logs: ServiceLog[]) => {
  const events: TraceEvent[] = [];

  for (const log of logs) {
    for (const line of log.content.split("\n")) {
      if (!line.includes(traceId)) continue;
      events.push(parseLine(log.service, line));
    }
  }

  return traceFromEvents(traceId, events);
};
