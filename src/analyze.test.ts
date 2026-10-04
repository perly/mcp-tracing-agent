import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeTrace } from "./analyze.js";

const logsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "mock_logs");

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
