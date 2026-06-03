// Minimal git helpers. The agent edits on a branch; it never commits or pushes.
import { execFileSync } from "node:child_process";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

export function isGitRepo(cwd: string): boolean {
  try {
    git(["rev-parse", "--is-inside-work-tree"], cwd);
    return true;
  } catch {
    return false;
  }
}

export function currentBranch(cwd: string): string | null {
  try {
    return git(["rev-parse", "--abbrev-ref", "HEAD"], cwd).trim();
  } catch {
    return null;
  }
}

/** Switch to `name`, creating it if needed. No-op if not a git repo. */
export function ensureBranch(cwd: string, name: string): { branch: string; created: boolean; ok: boolean } {
  if (!isGitRepo(cwd)) return { branch: "(not a git repo)", created: false, ok: false };
  const cur = currentBranch(cwd);
  if (cur === name) return { branch: name, created: false, ok: true };
  try {
    git(["checkout", name], cwd);
    return { branch: name, created: false, ok: true };
  } catch {
    try {
      git(["checkout", "-b", name], cwd);
      return { branch: name, created: true, ok: true };
    } catch {
      return { branch: cur ?? "(unknown)", created: false, ok: false };
    }
  }
}

export function diffStat(cwd: string): string {
  try {
    return git(["--no-pager", "diff", "--stat"], cwd);
  } catch {
    return "";
  }
}
