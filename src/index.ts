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

/**
 * 2. רישום הכלים הזמינים (List Tools)
 * כאן אנחנו מספרים ל-LLM איזה כלים קיימים ומה הם דורשים לקבל
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "trace_analyzer",
        description: "סורק קובצי לוג מבוזרים ומחלץ אירועים עבור Trace ID ספציפי מסודרים לפי זמן",
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
      
      const matchedEvents: any[] = [];

      // סריקה אסינכרונית של כל קובצי הלוג בתיקייה (מדמה מיקרו-סרוויסים שונים)
      for (const file of files) {
        if (!file.endsWith(".log")) continue;
        
        const filePath = path.join(LOGS_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");

        for (const line of lines) {
          if (line.includes(traceId)) {
            // אנחנו מצפים לפורמט לוג פשוט: [TIMESTAMP] [LEVEL] MESSAGE (TraceID)
            // דוגמה: [2026-06-02T10:00:00.000Z] INFO Order created (trace_123)
            matchedEvents.push({
              service: file.replace(".log", ""),
              rawLine: line,
              // חילוץ זמני פשוט לצורך המיון
              timestamp: line.match(/\[(.*?)\]/)?.[1] || new Date().toISOString()
            });
          }
        }
      }

      // מיון האירועים לפי סדר כרונולוגי מדויק (קריטי למערכות מבוזרות!)
      matchedEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: `נמצאו ${matchedEvents.length} אירועים עבור Trace ID: ${traceId}`,
              events: matchedEvents
            }, null, 2),
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
