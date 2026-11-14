# Diamond Dash: notes for Claude

Diamond Dash is a browser baseball game: a playable game (behind-the-batter view plus a top-down field view) and a franchise mode (a 30-team league, 162-game seasons, postseason, offseason). The project owner directs and makes design decisions; you design, code, test and ship.

## Read first
1. `docs/transcript.md`: jump to the section **"Project briefing for a new chat"** near the end. It covers the current state, decisions, calibration, known gaps and next steps. The rest of that file is the full conversation history; search it when you need the reason behind a decision.
2. `DESIGN.md`: every product decision. Defaults Claude chose (where the owner left a question open) are labeled as defaults: either marked *(default)* or listed under a "Defaults" heading.
3. `ARCHITECTURE.md`: module contract, data model, APIs and file ownership.
4. `README.md`: how to play and the code layout.

## Hard rules for the code
- No build step and no dependencies. Plain scripts on a global `BB` namespace, loaded by `index.html` in a fixed order. It must keep working when opened straight from disk (`file://`), so: no ES modules, no web workers, no fetching local files.
- Logic files never touch the DOM, so Node can test them: `util`, `data`, `sim`, `game`, `league`, `engine`, `season`, `depth`, `postseason`, `offseason`, `trades`.
- All team and player names stay fictional. No real MLB teams or players.
- Keep `DESIGN.md` and `ARCHITECTURE.md` up to date when you change behavior or APIs.

## Keeping the planning project in sync
The owner plans in a claude.ai project that holds copies of README.md, ARCHITECTURE.md, DESIGN.md, docs/plan.md and CLAUDE.md.
- In any commit that changes one of those five files, add 1 to the **Docs version** line at the top of docs/plan.md, and update its date and note.
- When the owner hands you a milestone from a planning chat, first compare its "Based on: docs version N" (if present) with the current docs version, and check the plan's assumptions against the actual code. Report any mismatch or stale assumption to the owner before building.
- Remind the owner to re-upload the files you changed to the project.

## Test after changes
- `node tools/simtest.js 300 medium`: gameplay physics. Aim for about 4.5 runs per team per game.
- `node tools/seasontest.js`: one full season, about 5 s.
- `node tools/franchisetest.js 2 11`: two seasons with invariant checks. It must print `all checks passed`.
- Browser checks: serve the repo (`python3 -m http.server`) and drive it with Playwright at 1280×800 and 390×844, with no console errors. There's no browser test suite in the repo yet (see next steps).

## Git
- Work on a branch. The owner has approved pushing finished, tested work to `main`; still confirm with them before pushing.
- End commit messages with the Co-Authored-By and Claude-Session lines your environment provides.

## Working with the owner
- Before building a new area, interview them: one multiple-choice question at a time, then a summary to confirm.
- Give plain, honest updates: what changed, what was tested, what isn't verified, and what needs their decision. Don't present your own defaults as their choices.
- They watch their usage limits. Work efficiently. If you use helper agents, have them commit often so stopping never loses work.

## Next steps (from the briefing)
1. Have the owner play a full game and a few franchise days by hand. Nobody has yet; tune feel and pacing from their feedback.
2. Add a permanent browser test suite in `tools/e2e/` (the earlier Playwright scripts were never saved to the repo).
3. Do a line-by-line review of the agent-written modules (`depth`, `postseason`, `offseason`, `trades`, `js/ui/screens-*`, `profile`, `boxscore`, `rig`, `fx`, `render-*`). They were verified by tests and reports only.
4. Fix the known gaps listed in the briefing.
5. GitHub's default branch should be `main` (the owner switches it in Settings).
