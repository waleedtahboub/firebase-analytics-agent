# Firebase Analytics Agent

A Node/TypeScript CLI that adds Firebase Analytics to Flutter apps end-to-end.
Built on `@anthropic-ai/claude-agent-sdk` — it shells out to the `claude` CLI (Claude Code login), no API key needed.

## Build & run

```bash
npm install
npm run typecheck      # type-check only, no emit
npm run build          # compile → dist/
npm run fa -- <cmd>    # run CLI in dev mode (tsx, no build needed)
npm link               # install `fa` globally after building
```

## Key commands (for the target Flutter project)

```bash
fa analyze [path]                        # analyze codebase → tracking.xlsx
fa ask "<question>" --project <path>     # Q&A on proposed events
fa plan --project <path>                 # approved events → IMPLEMENTATION_PLAN.md
fa firebase --dev-project <id> --project <path>   # connect Firebase DEV
fa implement --project <path>            # write Dart code (DEV only, on branch)
fa promote-prod --prod-project <id> --project <path>  # mirror to PROD
fa status --project <path>               # show detection + current phase (no API call)
```

`--project` defaults to current directory if omitted.

## Source layout

```
src/
  cli.ts              — commander entry, all 7 commands
  agent.ts            — shared SDK harness (runPhase, session capture, streaming)
  config.ts           — getConfig(phase, override) — per-phase model defaults
  session.ts          — per-project state in <project>/.analytics-agent/session.json
  types.ts            — TrackingEvent, DetectResult, SessionState, Phase
  flutter/detect.ts   — deterministic Flutter scan (no API): state mgmt, DI, flavors, Firebase
  prompts/index.ts    — system + user prompts per phase
  lib/
    excelSchema.ts    — column defs (9 cols matching TRACKING_CHECKLIST format)
    git.ts            — ensureBranch, diffStat helpers
  tools/
    figma.ts          — figma_get_screens MCP tool
    excelWrite.ts     — excel_write_tracking MCP tool
    excelRead.ts      — excel_read_tracking MCP tool
    index.ts          — createAnalyticsTools() → MCP server + tool names
  phases/
    analyze.ts        — fa analyze
    ask.ts            — fa ask
    plan.ts           — fa plan
    firebase.ts       — fa firebase
    implement.ts      — fa implement
    promoteProd.ts    — fa promote-prod
scripts/
  selftest.ts         — Excel round-trip test (no API needed)
  reconcile.mjs       — one-off: maps TRACKING_CHECKLIST.xlsx approvals → tracking.xlsx
skill/
  SKILL.md            — Claude Code /firebase-analytics skill
```

## Per-phase model defaults

| Phase | Model | Reason |
|-------|-------|--------|
| analyze | `claude-opus-4-8` | Deep codebase reasoning |
| plan | `claude-opus-4-8` | Full technical plan design |
| ask / firebase / implement / promote-prod | `claude-sonnet-4-6` | Lighter tasks |

Override per-run with `--model <model>` or permanently with `FA_MODEL=` in `.env`.

## Excel schema (9 columns — matches TRACKING_CHECKLIST format)

`# | Section | Priority | What we track | Why it matters / what it answers | Event (for dev) | Approve? | Notes | Final Approvel?`

- **Column 6** (`Event (for dev)`) = Firebase event name + params + firing screen, e.g. `sign_up | method:string | RegisterAccountPage`
- **Column 9** (`Final Approvel?`) = user fills 1 (implement) or 0 (skip) — agent reads this in plan/implement phases
- The agent leaves `Approve?` (col 7) and `Final Approvel?` (col 9) blank — the user fills them

## MCP tools (custom, in-process)

All custom tools use `permissionMode: "bypassPermissions"` — required by the SDK for in-process MCP tools.
Tool names follow the pattern `mcp__analytics__<tool_name>`.

| Tool | When used |
|------|-----------|
| `mcp__analytics__excel_write_tracking` | analyze |
| `mcp__analytics__excel_read_tracking` | ask, plan, implement |
| `mcp__analytics__figma_get_screens` | analyze (only if --figma provided) |

## Phase rules (enforced in code)

- Every phase except `analyze` exits early with an error if no prior `sessionId` exists → run `fa analyze` first
- `implement` exits early if `IMPLEMENTATION_PLAN.md` is missing → run `fa plan` first
- `implement` only touches the DEV flavor — prod is `promote-prod`, triggered explicitly
- No phase ever commits or pushes — changes land on `analytics/firebase-analytics` branch

## State files (per Flutter project)

All written to `<project>/.analytics-agent/` — add to the Flutter project's `.gitignore`.

| File | Written by |
|------|-----------|
| `tracking.xlsx` | `fa analyze` |
| `tracking.json` | `fa analyze` |
| `IMPLEMENTATION_PLAN.md` | `fa plan` |
| `session.json` | every phase (saves sessionId + phase + model) |
| `run.log` | every phase (full agent output) |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| *(none)* | — | Auth uses `claude` CLI login — no API key needed |
| `FIGMA_TOKEN` | optional | Figma personal access token for `--figma` |
| `FIREBASE_TOKEN` | optional | Firebase CI token (alternative to `firebase login`) |
| `FA_MODEL` | optional | Override default model for all phases |

## Adding a new phase

1. Add a function in `src/phases/<name>.ts` — follow the pattern in `ask.ts` (load session, guard sessionId, call `runPhase`)
2. Add a prompt in `src/prompts/index.ts`
3. Wire the command in `src/cli.ts`
4. Add a model default in `PHASE_MODELS` in `src/config.ts`
5. Run `npm run typecheck`
