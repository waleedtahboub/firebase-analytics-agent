# Firebase Analytics Agent

An end-to-end agent that adds **Firebase Analytics** to a **Flutter** app. It analyzes the
codebase (and optionally a Figma file), proposes a tracking plan as an **Excel sheet you approve**,
writes a technical plan, and then **implements it dev-first** — following each project's own
conventions (Bloc or Riverpod, `get_it`/`injectable`, flavors).

Built on the local **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`): it runs on your
machine and edits your repo in place, on a git branch. It never commits or pushes.

## The workflow

```
fa analyze <project> [--figma <url>]   # 1. read code (+Figma) -> tracking.xlsx
#   ↳ you open tracking.xlsx and fill "Final Approval": 1 = do it, 0 = skip
fa ask "<question>"                     # 2. (optional) ask about any event
fa plan                                 # 3. read approved rows -> IMPLEMENTATION_PLAN.md
#   ↳ you review / edit the plan
fa firebase --dev-project <id>          # 4. connect/init Firebase (DEV) — idempotent
fa implement                            # 5. implement approved events in the DEV flavor (on a branch)
#   ↳ you run the dev flavor + Firebase DebugView and confirm events
fa promote-prod --prod-project <id>     # 6. replicate the wiring into the PROD flavor
```

`fa status` shows what was detected and which phase you're in.

## Prerequisites

- **Node 18+**
- A **Flutter** project (state management: Bloc or Riverpod; `get_it`/`injectable` supported).
- **`ANTHROPIC_API_KEY`** — the agent uses Claude.
- For `--figma`: a **`FIGMA_TOKEN`** (Figma personal access token).
- For `firebase` / `promote-prod`: the **`flutterfire`** and **`firebase`** CLIs installed and
  authenticated (`firebase login` once, or set `FIREBASE_TOKEN`).

## Install

```bash
npm install
npm run build
npm link        # optional: puts `fa` on your PATH. Otherwise use: node dist/cli.js <cmd>
```

## Configure

```bash
cp .env.example .env       # then fill in ANTHROPIC_API_KEY, FIGMA_TOKEN, (FIREBASE_TOKEN)
```

## Safety & conventions

- **Dev-first.** `implement` only touches the dev flavor; prod is a separate, explicit
  `promote-prod` step.
- **On a branch.** Code changes happen on `analytics/firebase-analytics`. The agent **never
  commits or pushes** — you review the diff and commit.
- **No PII.** Generated tracking never logs phone, email, name, avatar, national-ID, card, or GPS.
- **Conventions per repo.** Event names + params are `snake_case`; Dart methods are `camelCase`
  (`logX`); the service goes where the repo already keeps shared services (e.g.
  `lib/src/common/analytics/`, mirroring an existing `notification/`), falling back to
  `lib/services/firebase_analytics/`.

## State

Per-project progress lives in `<project>/.analytics-agent/` (git-ignored in your tool, but
add it to the target app's `.gitignore`): `tracking.xlsx`, `tracking.json`,
`IMPLEMENTATION_PLAN.md`, `figma-mappings.json`, `session.json`, `run.log`.

## Cost

Each `analyze`/`implement` run makes several Opus calls over a large codebase, so it is not free.
Use `--model claude-sonnet-4-6` (or set `FA_MODEL`) to downshift. Back-to-back phases benefit from
prompt caching.

## Self-test (no API key)

```bash
npx tsx scripts/selftest.ts     # verifies the Excel write/read round-trip
fa status --project <flutter-app>   # verifies project detection
```
