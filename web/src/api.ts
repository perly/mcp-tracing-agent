import type { TraceDetail, TraceListItem, TraceStatus } from './types.ts'

const apiDown = 'The API is not running on port 3000.'

async function readJson<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(path)
  } catch {
    throw new Error(apiDown)
  }
  if (!response.ok) {
    throw new Error(`The API returned ${response.status}.`)
  }
  return response.json() as Promise<T>
}

export async function fetchTraces(status?: TraceStatus): Promise<TraceListItem[]> {
  const query = status ? `?status=${status}` : ''
  return readJson<TraceListItem[]>(`/traces${query}`)
}

export async function fetchTrace(traceId: string): Promise<TraceDetail> {
  return readJson<TraceDetail>(`/traces/${encodeURIComponent(traceId)}`)
}
