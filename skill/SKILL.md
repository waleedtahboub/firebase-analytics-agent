---
name: firebase-analytics
description: Add Firebase Analytics to a Flutter app end-to-end — analyze the codebase (and optionally Figma), produce an Excel event plan for the user to approve, write a technical plan, then implement it dev-first (Bloc/Riverpod + get_it/injectable aware). Use when the user wants to set up, add, or wire analytics/event tracking into a Flutter project.
---

# Firebase Analytics Agent (driver)

This skill drives the standalone Firebase Analytics Agent CLI. The agent itself does the heavy
work (codebase + Figma analysis, Excel generation, planning, dev-first implementation); your job
is to run its phases in order and pause for the human at each checkpoint.

## The CLI

Run it with (prefer `fa` if it's on PATH, otherwise use the absolute path):

```
fa <command>
# fallback:
node "C:/Users/walee_/Desktop/root/01_24Online/03_tools/firebase-analytics-agent/dist/cli.js" <command>
```

Requires `ANTHROPIC_API_KEY` (and `FIGMA_TOKEN` for Figma) in the agent's `.env` or the environment.

## How to drive it (stop at every checkpoint — do NOT chain phases without the user)

1. **Confirm the target.** Ask the user for the Flutter project path (default: current dir) and,
   optionally, a Figma file URL. Then run:
   `fa analyze <projectPath> [--figma <url>]`
2. **Hand off the Excel.** When it finishes, tell the user the path to `tracking.xlsx` (under
   `<project>/.analytics-agent/`) and ask them to fill the **Final Approval** column (1 = do it,
   0 = skip). **Wait** for them to say they're done. Do not proceed on your own.
3. **Clarifications (optional).** If they have questions about events, run
   `fa ask "<their question>"` and relay the answer. Loop until they're ready.
4. **Plan.** Run `fa plan`. Then show them `IMPLEMENTATION_PLAN.md` and invite edits. **Wait** for
   approval of the plan before implementing.
5. **Firebase (dev).** Ask for the **dev** Firebase project id and run
   `fa firebase --dev-project <id>`. If the agent reports the `firebase`/`flutterfire` CLI is
   missing or not logged in, tell the user to run `! firebase login` once, then retry.
6. **Implement (dev only).** Run `fa implement`. Summarize the changed files (it printed a diff
   stat) and tell the user to run the **dev** flavor with **Firebase DebugView** open to confirm
   events fire. **Wait** for them to confirm dev works.
7. **Promote to prod — only on explicit request.** ONLY when the user says something like
   "move to prod", ask for the **prod** Firebase project id and run
   `fa promote-prod --prod-project <id>`.

## Hard rules

- **Dev-first.** Never run `promote-prod` until the user has confirmed dev works and explicitly
  asks to move to prod.
- **Never commit or push** for the user — the agent edits on the `analytics/firebase-analytics`
  branch and leaves the diff for review. Let the user commit.
- The agent is **idempotent** about Firebase (it verifies an existing setup instead of clobbering
  it) and adapts to the project's own conventions — trust its detection.
- Use `fa status` anytime to see what was detected and which phase the project is in.
