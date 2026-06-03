// Assembles the in-process MCP server that exposes our custom tools to the agent.
// createSdkMcpServer already returns { type: "sdk", name, instance } — pass it directly.
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { makeExcelWriteTool } from "./excelWrite.js";
import { makeExcelReadTool } from "./excelRead.js";
import { makeFigmaTool } from "./figma.js";

export const MCP_SERVER_NAME = "analytics";

export interface ToolContext {
  projectPath: string;
  figmaToken?: string;
}

export function createAnalyticsTools(ctx: ToolContext) {
  // createSdkMcpServer returns { type: "sdk", name, instance } — the exact shape
  // query() expects as a value in the mcpServers record.
  const server = createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: "0.1.0",
    tools: [makeFigmaTool(ctx), makeExcelWriteTool(ctx), makeExcelReadTool(ctx)],
  });

  // Pass the server directly — no additional wrapping needed.
  const mcpServers: Record<string, unknown> = {
    [MCP_SERVER_NAME]: server,
  };

  const toolNames = {
    figma: `mcp__${MCP_SERVER_NAME}__figma_get_screens`,
    excelWrite: `mcp__${MCP_SERVER_NAME}__excel_write_tracking`,
    excelRead: `mcp__${MCP_SERVER_NAME}__excel_read_tracking`,
  };

  return { server, mcpServers, toolNames };
}
