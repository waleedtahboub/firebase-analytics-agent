import { detectFlutter } from "../flutter/detect.js";
import { firebaseSystem, firebaseUser } from "../prompts/index.js";
import { runPhase } from "../agent.js";
import { getConfig, requireClaudeCli } from "../config.js";
import { loadSession, saveSession } from "../session.js";
import { ensureBranch, diffStat } from "../lib/git.js";

export const ANALYTICS_BRANCH = "analytics/firebase-analytics";

export async function firebase(
  projectPath: string,
  opts: { devProject?: string; model?: string }
): Promise<void> {
  const cfg = getConfig("firebase", opts.model);
  requireClaudeCli();

  if (!opts.devProject) {
    console.error("Provide the dev Firebase project id:  fa firebase --dev-project <id>");
    process.exitCode = 1;
    return;
  }

  const detect = detectFlutter(projectPath);
  const branch = ensureBranch(projectPath, ANALYTICS_BRANCH);
  if (branch.ok) {
    console.log(`▶ Branch ${branch.branch}${branch.created ? " (created)" : ""} — DEV flavor only`);
    saveSession(projectPath, { branch: branch.branch });
  } else {
    console.warn("⚠ Not a git repo (or branch switch failed) — proceeding without a branch.");
  }
  saveSession(projectPath, { devProject: opts.devProject });

  const session = loadSession(projectPath);
  if (!session.sessionId) {
    console.error("No prior analysis found. Run `fa analyze` first.");
    process.exitCode = 1;
    return;
  }

  const res = await runPhase({
    projectPath,
    systemPrompt: firebaseSystem(detect, opts.devProject),
    prompt: firebaseUser(opts.devProject),
    allowedTools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
    permissionMode: "acceptEdits",
    model: cfg.model,
    resume: session.sessionId,
    phase: "firebase",
  });

  const stat = diffStat(projectPath);
  console.log(`\n\n✅ Firebase (dev) step done.${res.costUsd ? ` (~$${res.costUsd.toFixed(2)})` : ""}`);
  if (stat) console.log(`\nChanged files:\n${stat}`);
  console.log(`\nNext:  fa implement\n`);
}
