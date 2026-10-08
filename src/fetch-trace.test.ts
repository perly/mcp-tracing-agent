import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { fetchTrace } from "./fetch-trace.js";

describe("fetchTrace", () => {
  let server: Server;
  let apiUrl = "";

  before(async () => {
    server = createServer((request, response) => {
      if (request.url === "/traces/trace_500") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ summary: { traceId: "trace_500", firstError: { service: "payment-service" } } }));
        return;
      }
      response.writeHead(500);
      response.end();
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a port");
    apiUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns the trace JSON from the API", async () => {
    const result = await fetchTrace("trace_500", apiUrl);
    assert.deepEqual(result, {
      summary: { traceId: "trace_500", firstError: { service: "payment-service" } },
    });
  });

  it("reports an HTTP error without throwing past the caller", async () => {
    await assert.rejects(fetchTrace("trace_missing", apiUrl), /returned 500/);
  });

  it("reports that the API is down", async () => {
    await assert.rejects(fetchTrace("trace_500", "http://127.0.0.1:9"), /not reachable/);
  });
});
