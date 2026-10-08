import { useEffect, useState, type FormEvent } from 'react'
import { fetchTrace, fetchTraces } from './api.ts'
import { formatClock, formatDuration } from './format.ts'
import type { TraceDetail, TraceEvent, TraceListItem, TraceStatus, TraceSummary } from './types.ts'

const apiDown = 'The API is not running on port 3000.'

function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : apiDown
}

function isFirstError(event: TraceEvent, summary: TraceSummary): boolean {
  return (
    summary.firstError?.service === event.service &&
    summary.firstError.timestamp === event.timestamp &&
    summary.firstError.line === event.rawLine
  )
}

export function App() {
  const [filter, setFilter] = useState<TraceStatus | 'all'>('all')
  const [traces, setTraces] = useState<TraceListItem[]>([])
  const [traceId, setTraceId] = useState(() => new URLSearchParams(window.location.search).get('trace') ?? '')
  const [draft, setDraft] = useState('')
  const [detail, setDetail] = useState<TraceDetail | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  useEffect(() => {
    const status = filter === 'all' ? undefined : filter
    let cancelled = false
    fetchTraces(status)
      .then((items) => {
        if (cancelled) return
        setTraces(items)
        setListError(null)
        setTraceId((current) => current || items[0]?.traceId || '')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setTraces([])
        setListError(errorText(error))
      })
    return () => {
      cancelled = true
    }
  }, [filter])

  useEffect(() => {
    if (!traceId) return
    const url = new URL(window.location.href)
    url.searchParams.set('trace', traceId)
    window.history.replaceState(null, '', url)
    let cancelled = false
    fetchTrace(traceId)
      .then((next) => {
        if (cancelled) return
        setDetail(next)
        setDetailError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDetail(null)
        setDetailError(errorText(error))
      })
    return () => {
      cancelled = true
    }
  }, [traceId])

  const query = draft.trim().toLowerCase()
  const visibleTraces = traces.filter((trace) => trace.traceId.toLowerCase().includes(query))

  function openTrace(nextId: string) {
    setTraceId(nextId)
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextId = draft.trim()
    if (!nextId) return
    const exact = visibleTraces.find((trace) => trace.traceId.toLowerCase() === nextId.toLowerCase())
    if (exact) {
      setTraceId(exact.traceId)
      return
    }
    if (visibleTraces.length === 1) {
      setTraceId(visibleTraces[0].traceId)
      return
    }
    if (visibleTraces.length === 0) setTraceId(nextId)
  }

  return (
    <>
      <header className="top">
        <h1>Trace console</h1>
        <p>One request, across the services that handled it.</p>
      </header>
      <main className="layout">
        <section className="panel" aria-label="Traces">
          <form className="search" onSubmit={onSearch}>
            <label htmlFor="trace-id">Search</label>
            <input
              id="trace-id"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="trace id"
            />
          </form>
          <div className="status">
            <span id="status-label">Show</span>
            <div className="filters" role="group" aria-labelledby="status-label">
              <FilterButton current={filter} value="all" onSelect={setFilter}>
                All
              </FilterButton>
              <FilterButton current={filter} value="error" onSelect={setFilter}>
                Errors
              </FilterButton>
              <FilterButton current={filter} value="ok" onSelect={setFilter}>
                Ok
              </FilterButton>
            </div>
          </div>
          {listError ? <p className="empty">{listError}</p> : null}
          {!listError && traces.length === 0 ? <p className="empty">No traces.</p> : null}
          {!listError && traces.length > 0 && visibleTraces.length === 0 ? (
            <p className="empty">No traces match. Press Enter to open this id.</p>
          ) : null}
          <ul className="trace-list">
            {visibleTraces.map((trace) => (
              <li key={trace.traceId}>
                <button
                  type="button"
                  className={trace.traceId === traceId ? 'trace selected' : 'trace'}
                  onClick={() => openTrace(trace.traceId)}
                  aria-current={trace.traceId === traceId ? 'true' : undefined}
                >
                  <span className="trace-id">{trace.traceId}</span>
                  <span className={trace.status === 'error' ? 'mark error' : 'mark ok'}>
                    {trace.status === 'error' ? 'Error' : 'Ok'}
                  </span>
                  <span className="meta">{trace.services.join(', ')}</span>
                  <span className="meta">{formatDuration(trace.durationMs)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel" aria-label="Timeline">
          {detailError ? <p className="empty">{detailError}</p> : null}
          {detail && detail.summary.traceId === traceId ? <Timeline detail={detail} /> : null}
        </section>
      </main>
    </>
  )
}

function FilterButton(props: {
  current: TraceStatus | 'all'
  value: TraceStatus | 'all'
  onSelect: (value: TraceStatus | 'all') => void
  children: string
}) {
  return (
    <button
      type="button"
      className={props.current === props.value ? 'filter selected' : 'filter'}
      aria-pressed={props.current === props.value}
      onClick={() => props.onSelect(props.value)}
    >
      {props.children}
    </button>
  )
}

function Timeline(props: { detail: TraceDetail }) {
  const { summary, events } = props.detail
  if (summary.eventCount === 0) {
    return <p className="empty">No events for this trace id.</p>
  }

  return (
    <>
      <header className="summary">
        <h2>{summary.traceId}</h2>
        <p>
          {summary.services.join(', ')} · {formatDuration(summary.durationMs)}
        </p>
        {summary.firstError ? (
          <p className="first-error">
            First error in {summary.firstError.service}
          </p>
        ) : (
          <p className="ok-line">No error</p>
        )}
      </header>
      <ol className="timeline">
        {events.map((event, index) => {
          const firstError = isFirstError(event, summary)
          const className = firstError ? 'event error' : event.level === 'WARN' ? 'event warn' : 'event'
          return (
            <li key={`${event.timestamp}-${event.service}-${event.rawLine}-${index}`} className={className}>
              <time dateTime={event.timestamp}>{formatClock(event.timestamp)}</time>
              <span className="service">{event.service}</span>
              <span className="level">{event.level}</span>
              {firstError ? <span className="flag">First error</span> : null}
              <p>{event.rawLine}</p>
            </li>
          )
        })}
      </ol>
    </>
  )
}
