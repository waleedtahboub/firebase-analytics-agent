// Assembles the in-process MCP server that exposes our custom tools to the agent.
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
  const server = createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: "0.1.0",
    tools: [makeFigmaTool(ctx), makeExcelWriteTool(ctx), makeExcelReadTool(ctx)],
  });

  const mcpServers: Record<string, unknown> = {
    [MCP_SERVER_NAME]: { type: "sdk", name: MCP_SERVER_NAME, instance: server },
  };

  const toolNames = {
    figma: `mcp__${MCP_SERVER_NAME}__figma_get_screens`,
    excelWrite: `mcp__${MCP_SERVER_NAME}__excel_write_tracking`,
    excelRead: `mcp__${MCP_SERVER_NAME}__excel_read_tracking`,
  };

  return { server, mcpServers, toolNames };
}
