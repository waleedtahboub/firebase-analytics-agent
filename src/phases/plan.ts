import { existsSync } from "node:fs";
import { detectFlutter } from "../flutter/detect.js";
import { createAnalyticsTools } from "../tools/index.js";
import { planSystem, planUser } from "../prompts/index.js";
import { runPhase } from "../agent.js";
import { getConfig, requireClaudeCli } from "../config.js";
import { loadSession, statePaths } from "../session.js";

export async function plan(projectPath: string, opts: { model?: string }): Promise<void> {
  const cfg = getConfig("plan", opts.model);
  requireClaudeCli();

  const paths = statePaths(projectPath);
  if (!existsSync(paths.trackingXlsx)) {
    console.error(`No tracking.xlsx at ${paths.trackingXlsx}. Run \`fa analyze\` first.`);
    process.exitCode = 1;
    return;
  }

  const session = loadSession(projectPath);
  if (!session.sessionId) {
    console.error("No prior analysis found. Run `fa analyze` first.");
    process.exitCode = 1;
    return;
  }

  const detect = detectFlutter(projectPath);
  const { mcpServers, toolNames } = createAnalyticsTools({
    projectPath,
    figmaToken: cfg.figmaToken,
  });

  const res = await runPhase({
    projectPath,
    systemPrompt: planSystem(detect),
    prompt: planUser(),
    allowedTools: ["Read", "Grep", "Glob", "Write", toolNames.excelRead],
    permissionMode: "bypassPermissions",
    model: cfg.model,
    resume: session.sessionId,
    mcpServers,
    additionalDirectories: [paths.dir],
    phase: "planned",
  });

  console.log(`\n\n✅ Plan written to ${paths.plan}.${res.costUsd ? ` (~$${res.costUsd.toFixed(2)})` : ""}`);
  console.log(
    `\nNext:\n  1. Review/edit ${paths.plan}\n  2. Connect Firebase (dev):  fa firebase --dev-project <id>\n  3. Implement (dev):  fa implement\n`
  );
}
