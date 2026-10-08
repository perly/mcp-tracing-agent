export type TraceStatus = 'ok' | 'error'

export type FirstError = {
  service: string
  timestamp: string
  line: string
}

export type TraceSummary = {
  traceId: string
  eventCount: number
  services: string[]
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  firstError: FirstError | null
}

export type TraceListItem = TraceSummary & {
  status: TraceStatus
}

export type TraceEvent = {
  service: string
  level: string
  rawLine: string
  timestamp: string
}

export type TraceDetail = {
  summary: TraceSummary
  events: TraceEvent[]
}
