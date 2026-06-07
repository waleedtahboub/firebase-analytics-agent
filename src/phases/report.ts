import { detectFlutter } from "../flutter/detect.js";
import { createAnalyticsTools } from "../tools/index.js";
import { reportSystem, reportUser } from "../prompts/index.js";
import { runPhase } from "../agent.js";
import { getConfig, requireClaudeCli } from "../config.js";
import { loadSession } from "../session.js";

export async function report(
  projectPath: string,
  opts: { model?: string }
): Promise<void> {
  const cfg = getConfig("report", opts.model);
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
    systemPrompt: reportSystem(detect),
    prompt: reportUser(),
    allowedTools: ["Read", "Grep", "Glob", toolNames.excelRead],
    permissionMode: "bypassPermissions",
    model: cfg.model,
    resume: session.sessionId,
    mcpServers,
    phase: "reported",
  });
  console.log("\n");
}
