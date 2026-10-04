# MCP Tracing Agent

A small [Model Context Protocol](https://modelcontextprotocol.io) server that reconstructs one distributed trace from logs of several services.

An agent (for example Cursor) calls a single tool with a trace id. The server scans each service log, keeps the matching lines, and returns them in time order. That is the timeline of one request as it moved between services.

## Why this exists

In a system with more than one service, one user action is split across several log files. Searching each file by hand is slow, and the lines are not in one place. This server does that search and sort, and gives the result back to the agent as a tool.

## How it works

```text
Cursor agent
    |
    |  tool: trace_analyzer({ traceId })
    v
MCP server (stdio)
    |
    +--> mock_logs/gateway-service.log
    +--> mock_logs/payment-service.log
    |
    v
events sorted by timestamp
```

Each log line looks like this:

```text
[2026-06-02T10:00:01.100Z] INFO Received POST /orders request (trace_999)
```

The service name is the file name. Events from every file are merged and sorted by the timestamp in the first brackets.

The tool also returns a summary, not only the raw lines:

- which services took part
- how long the trace lasted, from the first event to the last
- the first `ERROR` line, or `null` when the trace has no error

## Sample

For `trace_999` the summary is: two services (`gateway-service`, `payment-service`), about 2300ms, and no error. The timeline is:

1. `gateway-service` receives `POST /orders`
2. `gateway-service` forwards the payment
3. `payment-service` starts processing the order
4. `payment-service` warns that the database is slow and retries
5. `payment-service` captures the payment
6. `gateway-service` returns `200 OK`

### Failure sample: `trace_500`

The gateway still returns `200 OK`, but the payment service times out. The summary points at that hop:

```json
{
  "traceId": "trace_500",
  "eventCount": 5,
  "services": ["gateway-service", "payment-service"],
  "startedAt": "2026-06-02T11:00:00.000Z",
  "endedAt": "2026-06-02T11:00:05.100Z",
  "durationMs": 5100,
  "firstError": {
    "service": "payment-service",
    "timestamp": "2026-06-02T11:00:05.000Z",
    "line": "[2026-06-02T11:00:05.000Z] ERROR Payment provider timed out after 5000ms (trace_500)"
  }
}
```

## Run it

Requirements: Node.js 20+.

```bash
npm install
npm test
npx tsc
```

`npm test` checks three things: events are sorted by time, an unknown trace id returns no events, and `trace_500` names `payment-service` as the first error.

Cursor starts the server itself. In `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tracing-agent": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-tracing-agent/dist/index.js"]
    }
  }
}
```

Then ask the agent to analyze `trace_999`.

The process speaks MCP on stdout. Debug lines go to stderr only, so they do not break the protocol.

## Tool

| Name | Input | Result |
| --- | --- | --- |
| `trace_analyzer` | `{ "traceId": "trace_999" }` | JSON with `summary` (services, duration, first error) and `events` sorted by time |

Unknown ids return an empty event list. Invalid input returns a tool error and the process keeps running.

## Stack

- Node.js, TypeScript, ESM
- `@modelcontextprotocol/sdk` with stdio transport
- Zod for tool arguments
