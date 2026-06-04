import { detectFlutter } from "../flutter/detect.js";
import { createAnalyticsTools } from "../tools/index.js";
import { askSystem } from "../prompts/index.js";
import { runPhase } from "../agent.js";
import { getConfig, requireClaudeCli } from "../config.js";
import { loadSession } from "../session.js";

export async function ask(
  projectPath: string,
  question: string,
  opts: { model?: string }
): Promise<void> {
  const cfg = getConfig("ask", opts.model);
  requireClaudeCli();

  const session = loadSession(projectPath);
  if (!session.sessionId) {
    console.error("No prior analysis found for this project. Run `fa analyze` first.");
    process.exitCode = 1;
    return;
  }

  const detect = detectFlutter(projectPath);
  const { mcpServers, toolNames } = createAnalyticsTools({
    projectPath,
    figmaToken: cfg.figmaToken,
  });

  await runPhase({
    projectPath,
    systemPrompt: askSystem(detect),
    prompt: question,
    allowedTools: ["Read", "Grep", "Glob", toolNames.excelRead],
    permissionMode: "bypassPermissions",
    model: cfg.model,
    resume: session.sessionId,
    mcpServers,
    phase: "asked",
  });
  console.log("\n");
}
