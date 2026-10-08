import type { TraceDetail, TraceListItem, TraceStatus } from './types.ts'

export async function fetchTraces(status?: TraceStatus): Promise<TraceListItem[]> {
  const query = status ? `?status=${status}` : ''
  const response = await fetch(`/traces${query}`)
  if (!response.ok) {
    throw new Error(`The API returned ${response.status}`)
  }
  return response.json() as Promise<TraceListItem[]>
}

export async function fetchTrace(traceId: string): Promise<TraceDetail> {
  const response = await fetch(`/traces/${encodeURIComponent(traceId)}`)
  if (!response.ok) {
    throw new Error(`The API returned ${response.status}`)
  }
  return response.json() as Promise<TraceDetail>
}
