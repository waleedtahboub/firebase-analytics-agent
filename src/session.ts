// Per-project state stored in <project>/.analytics-agent/.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SessionState } from "./types.js";

export const STATE_DIR_NAME = ".analytics-agent";

export function stateDir(projectPath: string): string {
  return join(resolve(projectPath), STATE_DIR_NAME);
}

export function statePaths(projectPath: string) {
  const dir = stateDir(projectPath);
  return {
    dir,
    session: join(dir, "session.json"),
    trackingXlsx: join(dir, "tracking.xlsx"),
    trackingJson: join(dir, "tracking.json"),
    figmaMappings: join(dir, "figma-mappings.json"),
    plan: join(dir, "IMPLEMENTATION_PLAN.md"),
    log: join(dir, "run.log"),
  };
}

export function ensureStateDir(projectPath: string): string {
  const dir = stateDir(projectPath);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function loadSession(projectPath: string): SessionState {
  const p = statePaths(projectPath).session;
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")) as SessionState;
    } catch {
      // ignore corrupt state and start fresh
    }
  }
  return { projectPath: resolve(projectPath) };
}

export function saveSession(
  projectPath: string,
  patch: Partial<SessionState>
): SessionState {
  ensureStateDir(projectPath);
  const current = loadSession(projectPath);
  const next: SessionState = {
    ...current,
    ...patch,
    projectPath: resolve(projectPath),
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(statePaths(projectPath).session, JSON.stringify(next, null, 2), "utf8");
  return next;
}
