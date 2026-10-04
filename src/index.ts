import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";


// 1. אתחול שרת ה-MCP
const server = new Server(
  {
    name: "distributed-tracing-agent",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {}, // אנחנו מצהירים שהשרת שלנו תומך בכלים (Tools)
    },
  }
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// הגדרת נתיב זמני לקובצי הלוג שננתח (לצורך הבדיקה המקומית)
const LOGS_DIR = path.resolve(__dirname, "..", "mock_logs");

console.error(`[MCP DEBUG] Looking for logs in absolute path: ${LOGS_DIR}`);

type TraceEvent = {
  service: string;
  level: string;
  rawLine: string;
  timestamp: string;
};

const summarizeTrace = (traceId: string, events: TraceEvent[]) => {
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

/**
 * 2. רישום הכלים הזמינים (List Tools)
 * כאן אנחנו מספרים ל-LLM איזה כלים קיימים ומה הם דורשים לקבל
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "trace_analyzer",
        description:
          "Scans distributed service logs for one trace id, sorts the events by time, and returns a short summary: services involved, duration, and the first ERROR.",
        inputSchema: {
          type: "object",
          properties: {
            traceId: {
              type: "string",
              description: "מזהה הטרנזקציה הייחודי לחיפוש (למשל: trace_123)",
            },
          },
          required: ["traceId"],
        },
      },
    ],
  };
});

/**
 * 3. מימוש הלוגיקה של הכלים (Call Tool)
 * כאן הקוד של ה-Node.js שלך אשכרה רץ כשה-LLM קורא לכלי
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "trace_analyzer") {
    try {
      // ולידציה של הפרמטרים בעזרת Zod
      const { traceId } = z.object({ traceId: z.string() }).parse(args);

      // ודואים שתיקיית הלוגים קיימת
      await fs.mkdir(LOGS_DIR, { recursive: true });
      const files = await fs.readdir(LOGS_DIR);
      
      const matchedEvents: TraceEvent[] = [];

      // סריקה אסינכרונית של כל קובצי הלוג בתיקייה (מדמה מיקרו-סרוויסים שונים)
      for (const file of files) {
        if (!file.endsWith(".log")) continue;
        
        const filePath = path.join(LOGS_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");

        for (const line of lines) {
          if (!line.includes(traceId)) continue;

          // [2026-06-02T10:00:00.000Z] INFO Order created (trace_123)
          const timestamp = line.match(/\[(.*?)\]/)?.[1] ?? new Date().toISOString();
          const level = line.match(/\]\s+([A-Z]+)\s/)?.[1] ?? "UNKNOWN";

          matchedEvents.push({
            service: file.replace(".log", ""),
            level,
            rawLine: line,
            timestamp,
          });
        }
      }

      matchedEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const summary = summarizeTrace(traceId, matchedEvents);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ summary, events: matchedEvents }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `שגיאה בניתוח הלוגים: ${error.message}` }],
      };
    }
  }

  throw new Error(`הכלי ${name} לא נמצא`);
});

/**
 * 4. הרצת השרת על גבי Stdio
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Tracing MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
