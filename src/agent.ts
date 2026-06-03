// Thin wrapper around the Claude Agent SDK's query() that every phase shares:
// streams output to the console + run.log, captures the session id, and persists state.
//
// Auth: the SDK shells out to the `claude` CLI — uses your Claude Code login,
// NOT a raw ANTHROPIC_API_KEY.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { appendFileSync } from "node:fs";
import { ensureStateDir, statePaths, saveSession } from "./session.js";
import type { Phase } from "./types.js";

export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "bypassPermissions"
  | "plan";

export interface RunPhaseOptions {
  projectPath: string;
  prompt: string;
  systemPrompt: string;
  allowedTools: string[];
  permissionMode?: PermissionMode;
  model: string;
  resume?: string;
  mcpServers?: Record<string, unknown>;
  maxTurns?: number;
  phase?: Phase;
  /** Extra directories the agent may read/write (e.g. the state dir). */
  additionalDirectories?: string[];
}

export interface RunPhaseResult {
  sessionId?: string;
  resultText: string;
  costUsd?: number;
}

/** Run one agent phase to completion. */
export async function runPhase(opts: RunPhaseOptions): Promise<RunPhaseResult> {
  ensureStateDir(opts.projectPath);
  const logPath = statePaths(opts.projectPath).log;
  const log = (s: string) => {
    try {
      appendFileSync(logPath, s);
    } catch {
      /* logging is best-effort */
    }
  };

  let sessionId: string | undefined = opts.resume;
  let resultText = "";
  let costUsd: number | undefined;

  log(`\n\n===== ${opts.phase ?? "phase"} @ ${new Date().toISOString()} =====\n`);

  // Cast options to a loose type so we are resilient to SDK version drift.
  const options: Record<string, unknown> = {
    systemPrompt: opts.systemPrompt,
    model: opts.model,
    cwd: opts.projectPath,
    allowedTools: opts.allowedTools,
    permissionMode: opts.permissionMode ?? "acceptEdits",
    maxTurns: opts.maxTurns ?? 80,
    // Do not load the developer's global Claude Code settings/subagents.
    settingSources: [],
  };
  if (opts.mcpServers) options.mcpServers = opts.mcpServers;
  if (opts.resume) options.resume = opts.resume;
  if (opts.additionalDirectories) options.additionalDirectories = opts.additionalDirectories;

  const stream = query({ prompt: opts.prompt, options: options as never });

  for await (const message of stream as AsyncIterable<any>) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id ?? sessionId;
    } else if (message.type === "assistant") {
      const content = message.message?.content ?? [];
      for (const block of content) {
        if (block?.type === "text" && block.text) {
          process.stdout.write(block.text);
          log(block.text);
        } else if (block?.type === "tool_use") {
          const line = `\n  · ${block.name}${toolHint(block)}\n`;
          process.stdout.write(line);
          log(line);
        }
      }
    } else if (message.type === "result") {
      sessionId = message.session_id ?? sessionId;
      costUsd = message.total_cost_usd;
      if (typeof message.result === "string") resultText = message.result;
    }
  }

  if (sessionId) {
    saveSession(opts.projectPath, {
      sessionId,
      model: opts.model,
      ...(opts.phase ? { phase: opts.phase } : {}),
    });
  }

  return { sessionId, resultText, costUsd };
}

/** A short, human-friendly hint about what a tool call is doing. */
function toolHint(block: any): string {
  const input = block?.input ?? {};
  const target = input.file_path || input.path || input.pattern || input.command || input.fileUrlOrKey;
  if (!target) return "";
  const s = String(target);
  return ` ${s.length > 80 ? s.slice(0, 77) + "..." : s}`;
}
