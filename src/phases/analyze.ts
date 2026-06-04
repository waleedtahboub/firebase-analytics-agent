import { detectFlutter } from "../flutter/detect.js";
import { createAnalyticsTools } from "../tools/index.js";
import { analyzeSystem, analyzeUser } from "../prompts/index.js";
import { runPhase } from "../agent.js";
import { getConfig, requireClaudeCli } from "../config.js";
import { saveSession, statePaths } from "../session.js";

export async function analyze(
  projectPath: string,
  opts: { figma?: string; model?: string }
): Promise<void> {
  const cfg = getConfig("analyze", opts.model);
  requireClaudeCli();

  const detect = detectFlutter(projectPath);
  if (!detect.dependencies.length) {
    console.warn("⚠ No pubspec dependencies detected — is this the Flutter project root?");
  }
  if (opts.figma && !cfg.figmaToken) {
    console.warn("⚠ --figma given but FIGMA_TOKEN is not set; Figma will be skipped.");
  }

  const { mcpServers, toolNames } = createAnalyticsTools({
    projectPath,
    figmaToken: cfg.figmaToken,
  });
  if (opts.figma) saveSession(projectPath, { figmaUrl: opts.figma });

  console.log(`\n▶ Analyzing ${detect.projectPath}`);
  console.log(`  state: ${detect.stateManagement}; firebase: core=${detect.firebase.hasCore} analytics=${detect.firebase.hasAnalytics}\n`);

  const res = await runPhase({
    projectPath,
    systemPrompt: analyzeSystem(detect),
    prompt: analyzeUser(detect.projectPath, opts.figma),
    allowedTools: ["Read", "Grep", "Glob", toolNames.figma, toolNames.excelWrite],
    permissionMode: "bypassPermissions",
    model: cfg.model,
    mcpServers,
    phase: "analyzed",
  });

  const paths = statePaths(projectPath);
  console.log(`\n\n✅ Analysis complete.${res.costUsd ? ` (~$${res.costUsd.toFixed(2)})` : ""}`);
  console.log(
    `\nNext:\n  1. Open ${paths.trackingXlsx}\n  2. Fill the "Final Approval" column (1 = implement, 0 = skip)\n  3. Optionally ask questions:  fa ask "..."\n  4. Then:  fa plan\n`
  );
}
