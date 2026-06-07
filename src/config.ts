// Environment + configuration loading.
// NOTE: The Claude Agent SDK works by spawning the `claude` CLI binary —
// it uses your Claude Code login, NOT a separate ANTHROPIC_API_KEY.
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

function findPackageRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
export const packageRoot = findPackageRoot(moduleDir);

// Load .env from the agent's package root first, then from the current dir.
// dotenv does not override variables already set.
loadEnv({ path: join(packageRoot, ".env"), quiet: true });
loadEnv({ quiet: true });

// Per-phase model defaults.
// analyze + plan need deep reasoning over a large codebase → Opus.
// Everything else (ask, firebase, implement, promote-prod) → Sonnet (faster + cheaper).
export const MODEL_OPUS   = "claude-opus-4-8";
export const MODEL_SONNET = "claude-sonnet-4-6";

export const PHASE_MODELS: Record<string, string> = {
  analyze:      MODEL_OPUS,
  plan:         MODEL_OPUS,
  ask:          MODEL_SONNET,
  firebase:     MODEL_SONNET,
  implement:    MODEL_SONNET,
  "promote-prod": MODEL_SONNET,
  report:         MODEL_SONNET,
};

export interface AgentConfig {
  figmaToken?: string;
  firebaseToken?: string;
  model: string;
}

export function getConfig(phase: string, overrideModel?: string): AgentConfig {
  const phaseDefault = PHASE_MODELS[phase] ?? MODEL_SONNET;
  return {
    figmaToken: process.env.FIGMA_TOKEN,
    firebaseToken: process.env.FIREBASE_TOKEN,
    model: overrideModel || process.env.FA_MODEL || phaseDefault,
  };
}

/**
 * Verify the `claude` CLI binary is installed and reachable.
 * The Agent SDK shells out to `claude` — it uses your Claude Code login,
 * not a raw API key.
 */
export function requireClaudeCli(): void {
  try {
    execFileSync("claude", ["--version"], { encoding: "utf8", stdio: "pipe" });
  } catch {
    throw new Error(
      "The `claude` CLI was not found in your PATH.\n" +
        "The Firebase Analytics Agent uses the Claude Agent SDK, which requires the\n" +
        "Claude Code CLI to be installed and authenticated.\n\n" +
        "  Install: https://claude.ai/download  (or `npm i -g @anthropic-ai/claude-code`)\n" +
        "  Then:    claude login\n"
    );
  }
}
