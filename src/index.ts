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
import { analyzeTrace, type ServiceLog } from "./analyze.js";


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

const readServiceLogs = async (): Promise<ServiceLog[]> => {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  const files = await fs.readdir(LOGS_DIR);
  const logs: ServiceLog[] = [];

  for (const file of files) {
    if (!file.endsWith(".log")) continue;
    logs.push({
      service: file.replace(".log", ""),
      content: await fs.readFile(path.join(LOGS_DIR, file), "utf-8"),
    });
  }

  return logs;
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

      const logs = await readServiceLogs();
      const result = analyzeTrace(traceId, logs);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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
