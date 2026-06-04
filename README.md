# Firebase Analytics Agent

> An AI agent that adds production-ready Firebase Analytics to any Flutter app — from zero to DebugView-verified events, with a human approval step in the middle.

An end-to-end agent that adds **Firebase Analytics** to any **Flutter** app.

It reads the codebase (and optionally a Figma file), proposes a tracking plan as an **Excel sheet you approve**, writes a technical implementation plan, and then **implements it dev-first** — following the project's own conventions (Bloc or Riverpod, `get_it`/`injectable`, flavors). It never commits or pushes.

---

## How it works (the big picture)

```
Your Flutter project
       │
       ▼
  fa analyze          ← agent reads every screen, route, cubit, bloc
       │                 and proposes events in a spreadsheet
       ▼
  tracking.xlsx        ← YOU open this and mark each event 1 (do it) or 0 (skip)
       │
       ▼
  fa plan             ← agent reads your approvals and writes a technical plan
       │
       ▼
  IMPLEMENTATION_PLAN.md  ← YOU review and edit if needed
       │
       ▼
  fa firebase         ← agent connects the Firebase dev project (idempotent)
       │
       ▼
  fa implement        ← agent writes all the Dart code (DEV flavor only, on a branch)
       │
       ▼
  You test in DebugView  ← run the dev flavor, confirm events appear in Firebase
       │
       ▼
  fa promote-prod     ← agent mirrors the wiring to the PROD flavor
```

The agent runs on your machine and edits your repo directly. You stay in control at every checkpoint.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node 18+** | `node --version` to check |
| **Claude Code CLI** | Install from [claude.ai/download](https://claude.ai/download), then run `claude login` once |
| **Flutter project** | Bloc or Riverpod; `get_it`/`injectable` supported |
| **`flutterfire` CLI** | Only needed for `fa firebase` and `fa promote-prod` — `dart pub global activate flutterfire_cli` |
| **`firebase` CLI** | Only needed for `fa firebase` and `fa promote-prod` — install from [firebase.tools](https://firebase.tools), then `firebase login` |
| **`FIGMA_TOKEN`** *(optional)* | Only if you want Figma cross-referencing during `fa analyze` |

---

## Install

```bash
# 1. Clone / navigate to the agent repo
cd path/to/firebase-analytics-agent

# 2. Install dependencies and build
npm install
npm run build

# 3. Put the `fa` command on your PATH (one-time, machine-wide)
npm link
```

After `npm link`, the `fa` command is available everywhere. No API key needed — it uses your Claude Code login.

### Optional: Figma token

Create a `.env` file in the agent repo root:

```
FIGMA_TOKEN=your_figma_personal_access_token
```

---

## Quick start

```bash
# Check what the agent detects about your project (no API call, instant)
fa status --project path/to/your/flutter/app

# Run the full analysis → produces tracking.xlsx
fa analyze path/to/your/flutter/app

# With Figma cross-referencing
fa analyze path/to/your/flutter/app --figma https://www.figma.com/file/...
```

---

## Step-by-step guide

### Step 1 — Analyze

```bash
fa analyze path/to/flutter/app
```

The agent explores the codebase, maps every user journey, and proposes analytics events.
When it finishes, open:

```
path/to/flutter/app/.analytics-agent/tracking.xlsx
```

Fill the **Final Approvel?** column:
- `1` = implement this event
- `0` = skip it
- leave blank = undecided (agent will skip)

Save and close the file.

---

### Step 2 — Ask (optional)

Have a question about a specific event before approving?

```bash
fa ask "Should we track the OTP resend separately or fold it into otp_failed?" \
  --project path/to/flutter/app
```

The agent answers using the analysis context it already has.

---

### Step 3 — Plan

```bash
fa plan --project path/to/flutter/app
```

The agent reads your approved events and writes a technical plan to:

```
path/to/flutter/app/.analytics-agent/IMPLEMENTATION_PLAN.md
```

Review it. Edit if needed. Proceed when happy.

---

### Step 4 — Connect Firebase (dev)

```bash
fa firebase --dev-project your-dev-firebase-project-id \
  --project path/to/flutter/app
```

The agent is **idempotent** — if Firebase is already wired, it verifies the setup and only adds what's missing (e.g. `firebase_analytics` package). It only touches the **dev** flavor.

> If it says the `flutterfire` or `firebase` CLI is missing, install them first (see Prerequisites), then re-run.

---

### Step 5 — Implement (dev only)

```bash
fa implement --project path/to/flutter/app
```

The agent writes all the Dart code:
- `AnalyticsService` (abstract) + `FirebaseAnalyticsService` (impl)
- Event-name constants + PII sanitizer
- DI registration (`get_it`/`injectable` or Riverpod)
- Route observer for `screen_view`
- All approved log calls at the exact firing sites

Changes go on the `analytics/firebase-analytics` branch. **The agent never commits or pushes.**

Verify:
1. Run the **dev** flavor of the app
2. Open **Firebase DebugView** in the Firebase console
3. Confirm the events appear as you use the app

---

### Step 6 — Promote to prod (only when dev is verified)

```bash
fa promote-prod --prod-project your-prod-firebase-project-id \
  --project path/to/flutter/app
```

Mirrors the dev wiring exactly into the prod flavor. Same branch, no commit.

---

### Commit when done

The agent leaves all changes staged on the `analytics/firebase-analytics` branch. When you're satisfied:

```bash
cd path/to/flutter/app
git add -A
git commit -m "Add Firebase Analytics (approved events, dev-first)"
# then open a PR as normal
```

---

## All commands

```bash
fa analyze [projectPath] [--figma <url>] [--model <model>]
fa ask "<question>"      [--project <path>] [--model <model>]
fa plan                  [--project <path>] [--model <model>]
fa firebase              --dev-project <id> [--project <path>] [--model <model>]
fa implement             [--project <path>] [--model <model>]
fa promote-prod          --prod-project <id> [--project <path>] [--model <model>]
fa status                [--project <path>]
```

`[projectPath]` and `--project` default to the **current directory** if omitted.

---

## State files

Everything the agent produces lives in `<project>/.analytics-agent/` — add this to the Flutter project's `.gitignore`:

```
.analytics-agent/
```

| File | What it is |
|------|-----------|
| `tracking.xlsx` | The event plan spreadsheet (you fill Final Approvel?) |
| `tracking.json` | Machine-readable mirror of the spreadsheet |
| `IMPLEMENTATION_PLAN.md` | Technical plan written by `fa plan` |
| `session.json` | Saved agent context (enables resume across CLI runs) |
| `run.log` | Full agent output log for debugging |

---

## Safety rules (enforced by the agent)

| Rule | What it means |
|------|--------------|
| **Dev-first** | `fa implement` only touches the dev flavor; prod is a separate explicit step |
| **No auto-commit** | Agent edits on a branch and stops — you review and commit |
| **No PII** | Never logs phone, email, name, avatar, national ID, card data, or GPS |
| **Idempotent Firebase setup** | Re-running `fa firebase` verifies instead of clobbering |
| **Conventions per repo** | Service placed where the repo already keeps shared services |

---

## Cost & model

Each phase uses the best model for the job by default:

| Phase | Default model | Why |
|-------|--------------|-----|
| `fa analyze` | **Opus** | Deep codebase reasoning — needs the most capable model |
| `fa plan` | **Opus** | Designing the full technical implementation plan |
| `fa ask` | Sonnet | Q&A, much lighter task |
| `fa firebase` | Sonnet | Mostly file edits and CLI calls |
| `fa implement` | Sonnet | Follows the plan written by Opus |
| `fa promote-prod` | Sonnet | Mirrors dev wiring to prod |

You can override any phase with `--model`:

```bash
fa analyze path/to/app --model claude-sonnet-4-6   # cheaper analyze
fa implement --model claude-opus-4-8               # stronger implement
```

Or override all phases permanently in the agent's `.env`:

```
FA_MODEL=claude-sonnet-4-6
```

---

## How it works under the hood

The agent is built on the **[Claude Agent SDK](https://github.com/anthropic-ai/claude-agent-sdk)** (`@anthropic-ai/claude-agent-sdk`). It runs entirely on your machine — your code never leaves your environment.

```
your machine
├── fa CLI (Node/TypeScript)
│     └── Claude Agent SDK
│           └── shells out to the `claude` CLI binary
│                 └── uses your Claude Code login (no separate API key)
└── your Flutter project (read + edited in place)
```

Each phase runs an agent loop that:
1. Gets a system prompt describing the Flutter project (detected deterministically — no API call)
2. Uses built-in tools (`Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`) to explore and modify the codebase
3. Uses custom MCP tools (`excel_write_tracking`, `excel_read_tracking`, `figma_get_screens`) for the Excel handoff and optional Figma cross-referencing
4. Saves a session ID so the next phase resumes with full prior context — no re-reading the whole codebase

**Privacy:** No code, no event names, and no project data are sent anywhere except to the Claude API to run the agent (same as using Claude Code normally). The Excel file and implementation plan live only on your machine.

---

## Contributing

PRs are welcome! If you find a bug or want to add a feature, please open an issue first so we can discuss the approach.

**Good first contributions:**
- Support for additional state management patterns (MobX, Provider)
- Better handling of monorepo / multi-package Flutter projects
- A `fa reset` command to clear session state cleanly
- Tests for the phase logic

**To set up locally:**

```bash
git clone https://github.com/waleedtahboub/firebase-analytics-agent.git
cd firebase-analytics-agent
npm install
npm run typecheck   # should be clean
npm run build
```

Please keep PRs focused — one feature or fix per PR. Run `npm run typecheck` before submitting.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `claude: command not found` | Install Claude Code from [claude.ai/download](https://claude.ai/download) and run `claude login` |
| `fa: command not found` | Run `npm link` from the agent repo, or use `node dist/cli.js <cmd>` |
| `No prior analysis found` | Run `fa analyze` first — each phase requires the previous one |
| `flutterfire: command not found` | Run `dart pub global activate flutterfire_cli` |
| `firebase: command not found` | Install from [firebase.tools](https://firebase.tools) and run `firebase login` |
| Excel file locked error | Close `tracking.xlsx` in Excel before running the next phase |
| Want to re-run analysis from scratch | Delete `.analytics-agent/` in the Flutter project and re-run `fa analyze` |

---

## Using with Claude Code (`/firebase-analytics`)


If your team uses Claude Code, the skill is installed at `~/.claude/skills/firebase-analytics`. Just type `/firebase-analytics` in any Claude Code session — it will ask for your project path and drive the whole pipeline conversationally.

---

## License

MIT — see [LICENSE](./LICENSE).

---

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Claude](https://img.shields.io/badge/powered%20by-Claude%20Agent%20SDK-blueviolet)
