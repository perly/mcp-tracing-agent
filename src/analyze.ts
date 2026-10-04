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

const parseLine = (service: string, line: string): TraceEvent => {
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

export const analyzeTrace = (traceId: string, logs: ServiceLog[]) => {
  const events: TraceEvent[] = [];

  for (const log of logs) {
    for (const line of log.content.split("\n")) {
      if (!line.includes(traceId)) continue;
      events.push(parseLine(log.service, line));
    }
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { summary: summarizeTrace(traceId, events), events };
};
