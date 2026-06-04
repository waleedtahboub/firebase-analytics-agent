import { existsSync } from "node:fs";
import { detectFlutter } from "../flutter/detect.js";
import { createAnalyticsTools } from "../tools/index.js";
import { implementSystem, implementUser } from "../prompts/index.js";
import { runPhase } from "../agent.js";
import { getConfig, requireClaudeCli } from "../config.js";
import { loadSession, saveSession, statePaths } from "../session.js";
import { ensureBranch, diffStat } from "../lib/git.js";
import { ANALYTICS_BRANCH } from "./firebase.js";

export async function implement(projectPath: string, opts: { model?: string }): Promise<void> {
  const cfg = getConfig("implement", opts.model);
  requireClaudeCli();

  const paths = statePaths(projectPath);
  if (!existsSync(paths.trackingXlsx)) {
    console.error("No tracking.xlsx. Run `fa analyze` then fill it, then `fa plan` first.");
    process.exitCode = 1;
    return;
  }
  if (!existsSync(paths.plan)) {
    console.error("No IMPLEMENTATION_PLAN.md found. Run `fa plan` first.");
    process.exitCode = 1;
    return;
  }

  const detect = detectFlutter(projectPath);
  const branch = ensureBranch(projectPath, ANALYTICS_BRANCH);
  if (branch.ok) {
    console.log(`▶ Implementing on branch ${branch.branch}${branch.created ? " (created)" : ""} — DEV flavor only`);
    saveSession(projectPath, { branch: branch.branch });
  } else {
    console.warn("⚠ Not a git repo — strongly recommend branching/committing before implement.");
  }

  const session = loadSession(projectPath);
  if (!session.sessionId) {
    console.error("No prior analysis found. Run `fa analyze` first.");
    process.exitCode = 1;
    return;
  }

  const { mcpServers, toolNames } = createAnalyticsTools({
    projectPath,
    figmaToken: cfg.figmaToken,
  });

  const res = await runPhase({
    projectPath,
    systemPrompt: implementSystem(detect),
    prompt: implementUser(),
    allowedTools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash", toolNames.excelRead],
    permissionMode: "bypassPermissions",
    model: cfg.model,
    resume: session.sessionId,
    mcpServers,
    maxTurns: 160,
    phase: "implemented",
  });

  const stat = diffStat(projectPath);
  console.log(`\n\n✅ Implementation (DEV) complete.${res.costUsd ? ` (~$${res.costUsd.toFixed(2)})` : ""}`);
  if (stat) console.log(`\nChanged files:\n${stat}`);
  console.log(
    `\nVerify: run the DEV flavor with Firebase DebugView open and confirm the events fire.\nWhen satisfied:  fa promote-prod --prod-project <id>\n`
  );
}
