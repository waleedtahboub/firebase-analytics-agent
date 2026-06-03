#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import { analyze } from "./phases/analyze.js";
import { ask } from "./phases/ask.js";
import { plan } from "./phases/plan.js";
import { firebase } from "./phases/firebase.js";
import { implement } from "./phases/implement.js";
import { promoteProd } from "./phases/promoteProd.js";
import { loadSession, statePaths } from "./session.js";
import { detectFlutter, describeDetect } from "./flutter/detect.js";

const program = new Command();

program
  .name("fa")
  .description("Firebase Analytics Agent — analyze a Flutter app (+Figma), get approval in Excel, plan, and implement dev-first.")
  .version("0.1.0");

const proj = (p?: string): string => resolve(p ?? process.cwd());

program
  .command("analyze [projectPath]")
  .description("Analyze the Flutter app (+ optional Figma) and produce tracking.xlsx")
  .option("--figma <url>", "Figma file URL to cross-reference")
  .option("--model <model>", "Override the model (default: claude-opus-4-8)")
  .action(async (projectPath: string | undefined, options: { figma?: string; model?: string }) => {
    await analyze(proj(projectPath), { figma: options.figma, model: options.model });
  });

program
  .command("ask <question>")
  .description("Ask a question about the proposed events (resumes prior context)")
  .option("--project <path>", "Project path (default: current directory)")
  .option("--model <model>", "Override the model")
  .action(async (question: string, options: { project?: string; model?: string }) => {
    await ask(proj(options.project), question, { model: options.model });
  });

program
  .command("plan")
  .description("Read approved (Final Approval = 1) events and write IMPLEMENTATION_PLAN.md")
  .option("--project <path>", "Project path (default: current directory)")
  .option("--model <model>", "Override the model")
  .action(async (options: { project?: string; model?: string }) => {
    await plan(proj(options.project), { model: options.model });
  });

program
  .command("firebase")
  .description("Connect/initialize Firebase for the DEV flavor (detect-first, idempotent)")
  .requiredOption("--dev-project <id>", "Dev Firebase project id")
  .option("--project <path>", "Project path (default: current directory)")
  .option("--model <model>", "Override the model")
  .action(async (options: { devProject: string; project?: string; model?: string }) => {
    await firebase(proj(options.project), { devProject: options.devProject, model: options.model });
  });

program
  .command("implement")
  .description("Implement approved events in the DEV flavor, on a git branch")
  .option("--project <path>", "Project path (default: current directory)")
  .option("--model <model>", "Override the model")
  .action(async (options: { project?: string; model?: string }) => {
    await implement(proj(options.project), { model: options.model });
  });

program
  .command("promote-prod")
  .description("Replicate the verified analytics wiring into the PROD flavor (on your command)")
  .requiredOption("--prod-project <id>", "Prod Firebase project id")
  .option("--project <path>", "Project path (default: current directory)")
  .option("--model <model>", "Override the model")
  .action(async (options: { prodProject: string; project?: string; model?: string }) => {
    await promoteProd(proj(options.project), { prodProject: options.prodProject, model: options.model });
  });

program
  .command("status")
  .description("Show project detection + current phase")
  .option("--project <path>", "Project path (default: current directory)")
  .action((options: { project?: string }) => {
    const p = proj(options.project);
    console.log(describeDetect(detectFlutter(p)));
    const s = loadSession(p);
    console.log(
      `\nPhase: ${s.phase ?? "(none)"} | session: ${s.sessionId ?? "(none)"} | branch: ${s.branch ?? "(none)"}`
    );
    console.log(`State dir: ${statePaths(p).dir}`);
  });

program.parseAsync(process.argv).catch((e: any) => {
  console.error(`\n✖ ${e?.message ?? e}`);
  process.exit(1);
});
