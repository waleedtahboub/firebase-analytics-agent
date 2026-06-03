# Firebase Analytics Agent — Progress & Handoff

## Exact prompt to continue tomorrow

```
I'm continuing work on the Firebase Analytics Agent we built at:
C:\Users\walee_\Desktop\root\01_24Online\03_tools\firebase-analytics-agent

This is a Node/TypeScript standalone agent (Claude Agent SDK) that adds Firebase Analytics
to Flutter apps end-to-end: analyze code (+Figma) → Excel approval → plan → dev-first implement.

The agent builds and typechecks cleanly. We fixed two bugs last session:
1. Auth: uses Claude Code CLI login (not ANTHROPIC_API_KEY) — done.
2. MCP permissions: custom tools (excel_write, excel_read, figma) need bypassPermissions — done.
3. MCP server wrapping: createSdkMcpServer already returns the right shape, no extra wrapping — done.

The last thing I tried was running `fa analyze` on Tasheh and it was rejected before completing.
Please:
1. Check the current state of the code (typecheck + smoke test with `fa status`)
2. Commit the current fixes (permission mode + server shape)  
3. Then attempt the first live `fa analyze` run on Tasheh
4. When tracking.xlsx is produced, open it and show me what events were proposed

The Flutter project path is:
C:\Users\walee_\Desktop\root\01_24Online\01_projects\03_tasheh\tasheh

Important context:
- No ANTHROPIC_API_KEY needed — uses `claude` CLI auth (Claude Code subscription)
- Tasheh uses: Bloc + Cubit, get_it + injectable, 3 flavors (main/main_dev/main_prod)
- firebase_core is already wired; firebase_analytics is NOT yet added
- Recommended analytics dir: lib/src/common/analytics/ (mirrors notification/)
- Dev-first rule: NEVER touch prod flavor until explicitly asked "move to prod"
- Build plan is at: C:\Users\walee_\.claude\plans\stateless-wiggling-riddle.md
```

---

## What's been built

### Repo location
`C:\Users\walee_\Desktop\root\01_24Online\03_tools\firebase-analytics-agent`

### Stack
- Node 18+ / TypeScript
- `@anthropic-ai/claude-agent-sdk@0.3.161` — the agent loop (shells out to `claude` CLI, uses Claude Code login, NO separate API key)
- `exceljs@4.4.0` — Excel generation
- `zod@4.4.3` — tool schemas
- `commander@15.0.0` — CLI
- `dotenv@17.4.2`

### All source files written and committed

```
src/
  cli.ts              — commander entry; all 7 commands (analyze/ask/plan/firebase/implement/promote-prod/status)
  agent.ts            — shared SDK harness (query loop, session capture, log streaming)
  config.ts           — env loading; requireClaudeCli() check (NOT requireApiKey)
  session.ts          — per-project state in <project>/.analytics-agent/session.json
  types.ts            — TrackingEvent, DetectResult, SessionState, Phase
  flutter/detect.ts   — deterministic scan: state mgmt, DI, flavors, Firebase state, conventions
  prompts/index.ts    — per-phase system + user prompts (analyze/ask/plan/firebase/implement/promoteProd)
  tools/
    figma.ts          — figma_get_screens custom tool (Figma REST API)
    excelWrite.ts     — excel_write_tracking custom tool (exceljs, new schema)
    excelRead.ts      — excel_read_tracking custom tool (reads Final Approval 1/0)
    index.ts          — createAnalyticsTools() → assembles MCP server + tool names
  lib/
    excelSchema.ts    — column defs: Event Name, Description, Parameters, Screen, Notes, Final Approval
    git.ts            — isGitRepo, ensureBranch, diffStat helpers
  phases/
    analyze.ts        — `fa analyze` phase
    ask.ts            — `fa ask` phase (resumes session)
    plan.ts           — `fa plan` phase
    firebase.ts       — `fa firebase` phase (detect-first/idempotent)
    implement.ts      — `fa implement` phase (DEV only, on git branch)
    promoteProd.ts    — `fa promote-prod` phase (only on explicit command)
scripts/
  selftest.ts         — no-API Excel round-trip test (✅ verified)
skill/
  SKILL.md            — Claude Code skill wrapper (installed to ~/.claude/skills/firebase-analytics)
```

### Git history
```
d8a6bee  Fix auth: use Claude Code CLI instead of ANTHROPIC_API_KEY
1540823  Initial commit: Firebase Analytics Agent (Node/TS, Claude Agent SDK)
```

---

## Task status (M1–M8)

| # | Milestone | Status | Notes |
|---|-----------|--------|-------|
| M1 | Scaffold repo | ✅ DONE | package.json, tsconfig, dirs, CLI skeleton, config, session, types |
| M2 | Excel tools + analyze phase | ✅ CODE DONE — live run pending | Excel write/read round-trip verified; analyze.ts written; first live run blocked (see bugs below) |
| M3 | Figma tool | ✅ CODE DONE | figma.ts written; not yet live-tested (needs FIGMA_TOKEN) |
| M4 | ask + plan phases | ✅ CODE DONE | ask.ts, plan.ts written; not yet live-tested |
| M5 | Firebase connect phase | ✅ CODE DONE | firebase.ts written; not yet live-tested |
| M6 | Implement phase (DEV) | ✅ CODE DONE | implement.ts written; not yet live-tested |
| M7 | promote-prod phase | ✅ CODE DONE | promoteProd.ts written; not yet live-tested |
| M8 | Skill + docs | ✅ DONE | SKILL.md written + installed to ~/.claude/skills/firebase-analytics |

---

## Bugs fixed this session

### Bug 1 — Auth (FIXED, committed)
- **Problem:** code used `requireApiKey(cfg)` which threw because `ANTHROPIC_API_KEY` was not set
- **Root cause:** wrong assumption — the Claude Agent SDK does NOT use a raw API key; it shells out to the `claude` CLI binary and uses Claude Code login
- **Fix:** replaced `requireApiKey` with `requireClaudeCli()` (checks `claude --version`); removed `ANTHROPIC_API_KEY` from all config/env files

### Bug 2 — MCP server shape (FIXED, not yet committed)
- **Problem:** `Q.connect is not a function` crash when query() tried to connect to custom MCP server
- **Root cause 1:** `tools/index.ts` was double-wrapping the server: `createSdkMcpServer` already returns `{ type: "sdk", name, instance }` — wrapping it again in `{ type: "sdk", ..., instance: server }` broke it
- **Fix:** pass `server` directly as the mcpServers value (no extra wrapping)
- **Root cause 2:** `permissionMode: "acceptEdits"` blocks in-process MCP tool calls; needs `"bypassPermissions"`
- **Fix:** changed all phases that use custom MCP tools to `permissionMode: "bypassPermissions"`. Verified with a live test: ping tool returned "pong" ✅

### Status of Bug 2 fixes
Code is written and typechecks/builds clean (`npm run typecheck && npm run build` = OK).
**NOT YET COMMITTED.** The `fa analyze` live run was interrupted before it could be retried.

---

## What's remaining (in order)

1. **Commit the Bug 2 fixes** (MCP server shape + bypassPermissions) — `git add -A && git commit`
2. **First live `fa analyze` run on Tasheh** — this is the first real end-to-end test; produces `tracking.xlsx`
3. **Review `tracking.xlsx`** — check that the proposed events are sensible and the columns are right
4. **Live test `fa ask`** — ask a clarifying question; verify session resume works
5. **Live test `fa plan`** — fill a few rows with 1/0, run plan, check `IMPLEMENTATION_PLAN.md`
6. **Live test `fa firebase`** — idempotent check on Tasheh (firebase_core already wired, should just add firebase_analytics)
7. **Live test `fa implement`** — the big one; DEV flavor only, on `analytics/firebase-analytics` branch
8. **Verify in Firebase DebugView** — run the dev flavor and confirm events appear
9. **Live test `fa promote-prod`** — only after dev is verified

---

## Key decisions made

| Decision | What | Why |
|----------|------|-----|
| Auth | Claude Code CLI (no API key) | User uses Claude Code subscription; SDK shells out to `claude` binary |
| MCP permissions | `bypassPermissions` for phases with custom tools | SDK default blocks in-process MCP tool calls |
| Analytics dir | `lib/src/common/analytics/` for Tasheh | Mirrors existing `lib/src/common/notification/` convention |
| Fallback dir | `lib/services/firebase_analytics/` | Used when no `common/` convention exists |
| Dev-first | Implement DEV only; `promote-prod` is a separate explicit command | Hard rule — never touch prod until user says "move to prod" |
| Branch | `analytics/firebase-analytics` | Agent edits on this branch; never commits/pushes |
| State | `<project>/.analytics-agent/` | Per-project; git-ignored; holds tracking.xlsx, session.json, plan, logs |
| Excel columns | Event Name, Description, Parameters, Screen, Notes, Final Approval (1/0) | No CEO column; Final Approval is the decision gate the agent reads |
| Option (a) | End-to-end (analyze → implement) in one agent | Not split; user can course-correct at each checkpoint |

---

## Tasheh detection results (verified, no API needed)

```
State management: bloc + get_it + injectable
Entry files: lib/main.dart, lib/main_dev.dart, lib/main_prod.dart
DI init functions: configureDependencies, configureDevDependencies, configureProdDependencies
Firebase: core=true analytics=false
Options files: lib/firebase_options.dart (prod), lib/firebase_options_dev.dart (dev)
initializeApp call site: lib/src/common/di/di.dart
Router observer: lib/src/config/route/router.dart:16
Recommended analytics dir: lib/src/common/analytics (mirrors lib/src/common/notification/)
```
