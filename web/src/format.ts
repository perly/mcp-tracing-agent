export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return 'Unknown duration'
  return `${durationMs} ms`
}

export function formatClock(timestamp: string): string {
  return timestamp.slice(11, 23)
}
