import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeTrace, parseLogLine, traceFromEvents } from "./analyze.js";

const logsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
  "mock_logs",
);

const readServiceLog = async (fileName: string) => ({
  service: fileName.replace(".log", ""),
  content: await readFile(path.join(logsDir, fileName), "utf-8"),
});

describe("analyzeTrace", () => {
  it("sorts events by time across services", () => {
    const result = analyzeTrace("trace_sort", [
      {
        service: "payment-service",
        content: "[2026-06-02T10:00:02.000Z] INFO second (trace_sort)",
      },
      {
        service: "gateway-service",
        content: "[2026-06-02T10:00:01.000Z] INFO first (trace_sort)\n[2026-06-02T10:00:03.000Z] INFO third (trace_sort)",
      },
    ]);

    assert.deepEqual(
      result.events.map((event) => event.timestamp),
      [
        "2026-06-02T10:00:01.000Z",
        "2026-06-02T10:00:02.000Z",
        "2026-06-02T10:00:03.000Z",
      ],
    );
  });

  it("returns zero events for an unknown trace id", () => {
    const result = analyzeTrace("trace_missing", [
      {
        service: "gateway-service",
        content: "[2026-06-02T10:00:01.000Z] INFO hello (trace_999)",
      },
    ]);

    assert.equal(result.summary.eventCount, 0);
    assert.deepEqual(result.events, []);
    assert.equal(result.summary.firstError, null);
  });

  it("identifies the payment service as the first error when it times out", async () => {
    const result = analyzeTrace("trace_500", [
      await readServiceLog("gateway-service.log"),
      await readServiceLog("payment-service.log"),
    ]);

    assert.equal(result.summary.firstError?.service, "payment-service");
    assert.match(result.summary.firstError?.line ?? "", /timed out/);
    assert.ok(result.events.some((event) => event.service === "gateway-service" && event.rawLine.includes("200 OK")));
  });
});

describe("traceFromEvents", () => {
  it("sorts stored events before naming the first error", () => {
    const result = traceFromEvents("trace_500", [
      {
        service: "gateway-service",
        level: "INFO",
        timestamp: "2026-06-02T11:00:05.100Z",
        rawLine:
          "[2026-06-02T11:00:05.100Z] INFO Payment success received, returning 200 OK to client (trace_500)",
      },
      {
        service: "payment-service",
        level: "ERROR",
        timestamp: "2026-06-02T11:00:05.000Z",
        rawLine:
          "[2026-06-02T11:00:05.000Z] ERROR Payment provider timed out after 5000ms (trace_500)",
      },
    ]);

    assert.equal(result.events[0]?.level, "ERROR");
    assert.equal(result.summary.firstError?.service, "payment-service");
  });
});

describe("parseLogLine", () => {
  it("reads the trace id and message from a mock log line", () => {
    const parsed = parseLogLine(
      "payment-service",
      "[2026-06-02T11:00:05.000Z] ERROR Payment provider timed out after 5000ms (trace_500)",
    );

    assert.equal(parsed?.traceId, "trace_500");
    assert.equal(parsed?.level, "ERROR");
    assert.equal(parsed?.message, "Payment provider timed out after 5000ms");
    assert.equal(parsed?.timestamp, "2026-06-02T11:00:05.000Z");
  });

  it("returns null for a blank line", () => {
    assert.equal(parseLogLine("gateway-service", ""), null);
  });
});
