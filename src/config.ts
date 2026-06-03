// Environment + configuration loading.
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

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
// dotenv does not override variables that are already set.
loadEnv({ path: join(packageRoot, ".env"), quiet: true });
loadEnv({ quiet: true });

export const DEFAULT_MODEL = "claude-opus-4-8";

export interface AgentConfig {
  anthropicApiKey?: string;
  figmaToken?: string;
  firebaseToken?: string;
  model: string;
}

export function getConfig(overrideModel?: string): AgentConfig {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    figmaToken: process.env.FIGMA_TOKEN,
    firebaseToken: process.env.FIREBASE_TOKEN,
    model: overrideModel || process.env.FA_MODEL || DEFAULT_MODEL,
  };
}

export function requireApiKey(cfg: AgentConfig): void {
  if (!cfg.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in, or export it in your shell."
    );
  }
}
