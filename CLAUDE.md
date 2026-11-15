# Diamond Dash: notes for Claude

Diamond Dash is a browser baseball game: a playable game (behind-the-batter view plus a top-down field view) and a franchise mode (a 30-team league, 162-game seasons, postseason, offseason). The project owner directs and makes design decisions; you design, code, test and ship.

## Read first
1. `docs/transcript.md`: jump to the section **"Project briefing for a new chat"** near the end. It covers the current state, decisions, calibration, known gaps and next steps. The rest of that file is the full conversation history; search it when you need the reason behind a decision.
2. `DESIGN.md`: every product decision. Defaults Claude chose (where the owner left a question open) are labeled as defaults: either marked *(default)* or listed under a "Defaults" heading.
3. `ARCHITECTURE.md`: module contract, data model, APIs and file ownership.
4. `README.md`: how to play and the code layout.
5. `docs/plan.md`: the roadmap, the current milestones, the QoL list and the backlog. `docs/blueprint.md` holds the longer-range plans (nothing in it is built yet).

## Hard rules for the code
- No build step and no dependencies. Plain scripts on a global `BB` namespace, loaded by `index.html` in a fixed order. It must keep working when opened straight from disk (`file://`), so: no ES modules, no web workers, no fetching local files.
- Logic files never touch the DOM, so Node can test them: `util`, `data`, `sim`, `game`, `league`, `engine`, `season`, `depth`, `postseason`, `offseason`, `trades`, `form`.
- All team and player names stay fictional. No real MLB teams or players.
- Keep `DESIGN.md` and `ARCHITECTURE.md` up to date when you change behavior or APIs.

## Keeping the planning project in sync
The owner plans in a claude.ai project that syncs copies of README.md, ARCHITECTURE.md, DESIGN.md, CLAUDE.md, docs/plan.md and docs/blueprint.md from GitHub.
- In any commit that changes one of those six files, add 1 to the **Docs version** line at the top of docs/plan.md, and update its date and note.
- When the owner hands you a milestone from a planning chat, first compare its "Based on: docs version N" (if present) with the current docs version, and check the plan's assumptions against the actual code. Report any mismatch or stale assumption to the owner before building.
- When you change any of those six files, remind the owner to click **Sync now** on the project's GitHub files (or re-upload them if sync isn't set up). A new file (such as docs/blueprint.md) has to be added to the project's synced files once.

## Test after changes
- `node tools/simtest.js 300 medium`: gameplay physics. Aim for about 4.3–4.6 runs per team per game (4.53 after Milestone 2b's physics change).
- `node tools/seasontest.js`: one full season, about 5 s. It must print `all checks passed` (workload and WAR checks from `tools/checks.js`).
- `node tools/franchisetest.js 2 11`: two seasons with invariant checks and the same workload and WAR checks. It must print `all checks passed`.
- `node tools/oldsavetest.js save.json`: loads a save made by older code and plays on (see ARCHITECTURE.md "Testing").
- Browser checks: `node tools/e2e/form-check.js` covers the form icons, profile notes and HUD at both sizes; `node tools/e2e/play-check.js` plays an exhibition game and a franchise game and opens the leaders screen (about 4 minutes). For other screens, drive the game with Playwright at 1280×800 and 390×844, with no console errors. Serve the repo (`python3 -m http.server`) or open `index.html` straight from disk (`file://`), which also checks the works-from-disk rule. The rest of the browser suite isn't built yet (see next steps).
- `node tools/measure.js 2 11`: prints workload and WAR numbers for calibration. It checks nothing.

## Git
- Work on a branch. The owner has approved pushing finished, tested work to `main`; still confirm with them before pushing.
- End commit messages with the Co-Authored-By and Claude-Session lines your environment provides.

## Working with the owner
- Before building a new area, interview them: one multiple-choice question at a time, then a summary to confirm.
- Give plain, honest updates: what changed, what was tested, what isn't verified, and what needs their decision. Don't present your own defaults as their choices.
- They watch their usage limits. Work efficiently. If you use helper agents, have them commit often so stopping never loses work.

## Next steps
The order of work is the **Roadmap** in `docs/plan.md`. These items come from the briefing and are not all scheduled there:
1. Have the owner play a full game, a few franchise days and a postseason game by hand, then tune feel and pacing from their feedback. So far the owner has simmed a full season and done some manual play (what exactly is not confirmed).
2. Add a permanent browser test suite in `tools/e2e/` (started in Milestone 2 with `form-check.js`; the earlier Playwright scripts were never saved to the repo).
3. Do a line-by-line review of the agent-written modules (`depth`, `postseason`, `offseason`, `trades`, `js/ui/screens-*`, `profile`, `boxscore`, `rig`, `fx`, `render-*`). They were verified by tests and reports only.
4. Fix the known gaps listed in the briefing.
5. Delete stale branches on GitHub (`ccr-deee3caa-ob0ti7`, `agent/*`). The default branch is now `main` (done).
