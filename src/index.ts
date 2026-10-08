import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { fetchTrace } from "./fetch-trace.js";


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

const apiUrl = process.env.TRACE_API_URL ?? "http://localhost:3000";

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
          "Loads one trace from the trace API. Returns the summary and the events in time order: services, duration, and the first ERROR.",
        inputSchema: {
          type: "object",
          properties: {
            traceId: {
              type: "string",
              description: "Trace id to load, for example trace_500",
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
      const result = await fetchTrace(traceId, apiUrl);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{ type: "text", text: message }],
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
  console.error(`Tracing MCP Server running on stdio, API ${apiUrl}`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
