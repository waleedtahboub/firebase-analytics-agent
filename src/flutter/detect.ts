// Deterministic scan of a Flutter project: state management, DI, flavors,
// Firebase state, and conventions. Fed into the agent prompts as ground truth.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { DetectResult, StateManagement } from "../types.js";

function listDartFiles(root: string, cap = 4000): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length && out.length < cap) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === ".dart_tool" || name === "build" || name === ".git" || name === ".analytics-agent") continue;
        stack.push(p);
      } else if (name.endsWith(".dart")) {
        out.push(p);
      }
    }
  }
  return out;
}

export function detectFlutter(projectPathRaw: string): DetectResult {
  const projectPath = resolve(projectPathRaw);
  const notes: string[] = [];
  const libDir = join(projectPath, "lib");

  let pubspec = "";
  const pubspecPath = join(projectPath, "pubspec.yaml");
  if (existsSync(pubspecPath)) pubspec = readFileSync(pubspecPath, "utf8");
  else notes.push("No pubspec.yaml found — is this the Flutter project root?");

  const hasDep = (name: string) => new RegExp(`^\\s+${name}\\s*:`, "m").test(pubspec);
  const dependencies = Array.from(pubspec.matchAll(/^\s{2}([a-z0-9_]+)\s*:/gim)).map((m) => m[1]);

  let stateManagement: StateManagement = "unknown";
  if (hasDep("flutter_bloc") || hasDep("bloc")) stateManagement = "bloc";
  else if (hasDep("flutter_riverpod") || hasDep("riverpod") || hasDep("hooks_riverpod"))
    stateManagement = "riverpod";

  const usesGetIt = hasDep("get_it");
  const usesInjectable = hasDep("injectable");

  let entryFiles: string[] = [];
  if (existsSync(libDir)) {
    try {
      entryFiles = readdirSync(libDir)
        .filter((f) => /^main.*\.dart$/.test(f))
        .map((f) => `lib/${f}`);
    } catch {
      /* ignore */
    }
  }

  const dartFiles = existsSync(libDir) ? listDartFiles(libDir) : [];
  const diInit = new Set<string>();
  const initCallSites: string[] = [];
  const optionsFiles: string[] = [];
  let routerObserver: string | null = null;

  for (const file of dartFiles) {
    const rel = relative(projectPath, file).replace(/\\/g, "/");
    if (/firebase_options.*\.dart$/.test(rel)) optionsFiles.push(rel);
    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of content.matchAll(/(?:Future<void>|void)\s+(configure\w*Dependencies)\s*\(/g))
      diInit.add(m[1]);
    if (/Firebase\s*\.\s*initializeApp/.test(content)) initCallSites.push(rel);
    if (!routerObserver) {
      const obs = content.match(/class\s+(\w+)\s+extends\s+AutoRouterObserver/);
      if (obs) {
        const line = content.slice(0, content.indexOf(obs[0])).split(/\r?\n/).length;
        routerObserver = `${rel}:${line}`;
      }
    }
  }

  let analyticsDir: string;
  let analyticsDirReason: string;
  if (existsSync(join(libDir, "src", "common"))) {
    analyticsDir = "lib/src/common/analytics";
    analyticsDirReason = existsSync(join(libDir, "src", "common", "notification"))
      ? "mirrors existing lib/src/common/notification/"
      : "matches existing lib/src/common/ layout";
  } else if (existsSync(join(libDir, "services"))) {
    analyticsDir = "lib/services/firebase_analytics";
    analyticsDirReason = "matches existing lib/services/ layout";
  } else {
    analyticsDir = "lib/services/firebase_analytics";
    analyticsDirReason = "default (no existing services/common convention found)";
  }

  return {
    projectPath,
    stateManagement,
    usesGetIt,
    usesInjectable,
    entryFiles,
    diInitFunctions: Array.from(diInit),
    firebase: {
      hasCore: hasDep("firebase_core"),
      hasAnalytics: hasDep("firebase_analytics"),
      optionsFiles,
      initCallSites: initCallSites.slice(0, 10),
    },
    analyticsDir,
    analyticsDirReason,
    routerObserver,
    dependencies,
    notes,
  };
}

/** A compact, human/agent-readable summary of the detection result. */
export function describeDetect(d: DetectResult): string {
  return [
    `Project: ${d.projectPath}`,
    `State management: ${d.stateManagement}${d.usesGetIt ? " + get_it" : ""}${
      d.usesInjectable ? " + injectable" : ""
    }`,
    `Entry files: ${d.entryFiles.join(", ") || "(none found)"}`,
    `DI init functions: ${d.diInitFunctions.join(", ") || "(none found)"}`,
    `Firebase: core=${d.firebase.hasCore} analytics=${d.firebase.hasAnalytics}; options=[${d.firebase.optionsFiles.join(
      ", "
    )}]; initializeApp in [${d.firebase.initCallSites.join(", ")}]`,
    `Router observer: ${d.routerObserver ?? "(none found)"}`,
    `Recommended analytics dir: ${d.analyticsDir} (${d.analyticsDirReason})`,
    d.notes.length ? `Notes: ${d.notes.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
