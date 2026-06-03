import { detectFlutter } from "../flutter/detect.js";
import { promoteProdSystem, promoteProdUser } from "../prompts/index.js";
import { runPhase } from "../agent.js";
import { getConfig, requireClaudeCli } from "../config.js";
import { loadSession, saveSession } from "../session.js";
import { ensureBranch, diffStat } from "../lib/git.js";
import { ANALYTICS_BRANCH } from "./firebase.js";

export async function promoteProd(
  projectPath: string,
  opts: { prodProject?: string; model?: string }
): Promise<void> {
  const cfg = getConfig(opts.model);
  requireClaudeCli();

  if (!opts.prodProject) {
    console.error("Provide the prod Firebase project id:  fa promote-prod --prod-project <id>");
    process.exitCode = 1;
    return;
  }

  const detect = detectFlutter(projectPath);
  const branch = ensureBranch(projectPath, ANALYTICS_BRANCH);
  if (branch.ok) {
    console.log(`▶ Promoting to PROD on branch ${branch.branch}`);
    saveSession(projectPath, { branch: branch.branch });
  }
  saveSession(projectPath, { prodProject: opts.prodProject });

  const session = loadSession(projectPath);
  const res = await runPhase({
    projectPath,
    systemPrompt: promoteProdSystem(detect, opts.prodProject),
    prompt: promoteProdUser(opts.prodProject),
    allowedTools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
    permissionMode: "acceptEdits",
    model: cfg.model,
    resume: session.sessionId,
    phase: "promoted",
  });

  const stat = diffStat(projectPath);
  console.log(`\n\n✅ Promote-to-prod complete.${res.costUsd ? ` (~$${res.costUsd.toFixed(2)})` : ""}`);
  if (stat) console.log(`\nChanged files:\n${stat}`);
  console.log(`\nReview the diff, then commit when you're happy (the agent never commits for you).\n`);
}
