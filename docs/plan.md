# Diamond Dash: milestone plan

**Docs version: 10** (2026-11-14): Milestone 1 step 2, playing your postseason games (bye-week fix).
<!-- Coding sessions: add 1 to this number, and update the date and note, in any commit that changes README.md, ARCHITECTURE.md, DESIGN.md, CLAUDE.md, docs/plan.md or docs/blueprint.md. The planning chat uses it to detect stale copies. -->

Planning happens in the claude.ai project; building happens in Claude Code sessions on this repo. This file is the hand-off between the two.

**Project goal** (owner's choice, Nov 14, 2026): share the game with friends as a public web page they open in a browser on a phone or computer (for example GitHub Pages). An app version may come later.

**How to use it**
- Milestone size is flexible (owner's choice): the planner sizes each one, and splits anything bigger than one coding session into steps. Keep only 1–2 detailed milestones under "Current milestones"; bigger plans go stale fast.
- The coding session keeps this file current (owner's choice): it adds milestone text from planning chats, updates the backlog, and moves finished work to "Done".
- A coding session builds the milestone in order, ticks off tasks, and updates the status lines, then moves finished milestones to "Done".
- Label every decision as either **owner's choice** or **Claude's default**.
- When a milestone is finished, update `DESIGN.md` (decisions) and `ARCHITECTURE.md` (APIs and modules) too.

---

## Roadmap

The short, ordered path toward the goal, set in planning chats: a line or two per item. The coding session updates it when a planning hand-off says so.

The order is **Claude's default** and not yet confirmed by the owner, except where marked. Items W1–W5 are described in `docs/blueprint.md` where a blueprint exists.

1. **Milestone 1:** playtest fixes (postseason play, reliever workload, WAR)
2. **Milestone 2:** in-season form (hot and cold streaks)
3. **Owner hand-playtest:** a full game, a few franchise days, a postseason game
4. **QoL pass:** fix the QoL list (owner's choice: one pass right before release)
5. **Publish on GitHub Pages** (the project goal)
6. **First-time polish:** how to play, first-run experience
7. **W1:** more pitch types, and pitches that work in more complex ways (needs an interview)
8. **W2:** more postseason effects (after the owner has seen the current ones)
9. **W5a:** clearer stat pages and rate stats
10. **W5b:** one growth model with training focus and intensity
11. **W4a:** budgets (revenue, markets, luxury tax, Finances screen)
12. **W4b:** trading depth
13. **W4c:** free agency depth
14. **W4d:** minor leagues (AAA with games; lower levels as rosters)
15. **W4e:** draft (bonuses, more rounds, prospect rankings)
16. **W3:** 3D characters and broadcast cameras (owner's choice: lower priority). Starts with a report on the hard-rule conflicts.

**Later** (owner's ideas; each needs an interview before planning)
- scouting
- OPS+, wRC+, ERA+, FIP, batted-ball data
- 25 hidden archetypes for player generation (maybe)
- development in the lower minor levels
- levels of hot and cold
- game modes: single player (multiple difficulties) and multiplayer modeled on fantasy baseball games
- matching manual and simmed games (reduce the differences)
- realism: a baseball study to ground the game's numbers
- browser test suite `tools/e2e/`, line-by-line code review, app version

---

## QoL list

Owner's choice: a running list, fixed in one pass right before the GitHub Pages release. The owner adds items as he finds them.

Items so far (Nov 14, 2026; the owner reports no bugs, and the problems are in team management):
- Team management and franchise screens: some information is hard to find.
- Popups and "back" behave oddly.
- New options are needed in team management (details to come).
- Likely related (Claude's inference): the known gaps "Escape closes all stacked popups at once" and "an offer popup can stay open if the screen changes underneath it".

---

## Current milestones

### Milestone 1: playtest fixes
**Status:** in progress
**Goal:** The owner can play or quick-play his own postseason games. Relievers throw realistic innings over a season. WAR and the awards land in realistic ranges.
**Why now:** The owner's simulated-season playtest (Nov 14, 2026) found these errors.

**In scope**
- The postseason play bug
- Reliever workload over a season, with a check on starters
- WAR calibration and Reliever of the Year eligibility

**Out of scope** (on purpose, for later)
- In-season form (Milestone 2), pitch rework, postseason effects
- Position-player fatigue, unless it is the cause

**Based on:** docs version 7. (The hand-off said "docs version 1", meaning the version before the hand-off's doc commit.)

**Plan check** (coding session, Nov 14, 2026: what the code showed before building)
- Docs: the hand-off was written against version 1; the repo was at version 7. Versions 2–7 already covered the GitHub sync note, the version rule for `CLAUDE.md`, the `main` default branch and an empty Roadmap section, and added releasing players and the one payroll total. None of that changes this milestone.
- Postseason: Play and Quick play already work whenever the owner's team has a game that day. A top-2 seed has a bye, so for the first four postseason days (three Wild Card days and an off day) both screens offer only Sim buttons, with no note that the owner's games come later. "Sim to the end" and Home's Week, Month and End of postseason then sim the owner's own games without asking. This is the likely cause of the report (to confirm with the owner: was his team a top-2 seed?). It is a small fix in two UI files, not a missing feature.
- All-Star Game: Play, Quick play and Sim are all offered.
- Workload: no season workload rule exists. The only rules are day-to-day (a reliever who pitched yesterday sits if 4 others are rested). The manager always brings in the weakest rested reliever first, so the worst arms pitch most and closers pitch least.
- WAR: the league total is already about 1,000 (984–1,018 over six seasons), split 60% hitters and 40% pitchers. MVPs come out at 5.5–9.0 (mostly 6–7), which is below the 8–10 target, not above it. Nobody reached 11. Rookies of the Year come out at 3.1–6.3, already inside the 3–6 target: rookies are not too strong (rookie regulars average a lower rating and lower WAR than other regulars). What looks like rookie inflation is that the best rookie often matches the MVP, because the top of the scale is compressed. So task 5 means stretching the top of the scale, not shrinking the total.

**Decisions**
- The owner can play his own postseason games: owner's choice. He reported only Sim was offered though his team qualified. Quick play, through the Diamond Series, is the existing design.
- No reliever pitches 3 days in a row. A long outing needs extra rest. If no one is rested, the least-tired pitcher goes. Work is spread across bullpen roles: Claude's default.
- Targets: top relievers about 60–80 IP (warning above about 95) and at most about 75 games; starters under about 210 IP: Claude's default.
- Reliever of the Year counts only pitchers with about 80% or more of their games in relief: Claude's default.
- WAR targets: league total about 1,000 a season (about 57% hitters, 43% pitchers); MVP about 8–10, no one much past 11; a typical Rookie of the Year 3–6: Claude's default.
- All targets come from general baseball knowledge, not research. A later realism study may replace them.
- Measure before and after, and report the numbers: Claude's default.

**Tasks** (four steps; commit after each)

Step 1: baseline
1. [x] Measure 2 or more simulated seasons: relievers' innings, games and 3-day streaks; the top starter's innings; the WAR total and its hitter/pitcher split; the top 10 by WAR; award winners' WAR and stat lines. Check whether any season workload rule already exists. Check whether Rookie of the Year inflation comes from the formula or from rookies being too strong. Done when: the numbers are in the report.

   **Baseline** (`node tools/measure.js`, six simulated seasons, before any change):
   | Measure | Baseline | Target |
   |---|---|---|
   | Runs per team-game | 4.54–4.66 | about 4.5 |
   | Relievers over 80 IP / over 95 IP / over 75 games (of about 262) | 74 / 63 / 57 | few / none / none |
   | Busiest reliever | 190–228 IP, 145–147 games | about 60–80 IP, at most about 75 games |
   | A team's best two relievers | about 36 IP, 30–40 games each | the most-used arms |
   | A team's weakest reliever | about 153 IP, 141 games | the least-used arm |
   | Relief appearances on a 3rd straight day | 3,700–3,850 a season (longest run 18 days) | 0 |
   | Top starter | 235–250 IP (25–35 starters over 210) | under about 210 IP |
   | Starters with 28+ starts | 191 IP, 6.0 IP per start | — |
   | WAR total (hitters / pitchers) | 984–1,018 (60% / 40%) | about 1,000 (57% / 43%) |
   | Reliever share of WAR | 1–24 of about 400 pitcher WAR | — |
   | MVP WAR | 5.5–9.0, mostly 6–7 | about 8–10, no one much past 11 |
   | Rookie of the Year WAR | 3.1–6.3 | 3–6 |
   | Reliever of the Year | 114–228 IP, 2–13 saves | a relief pitcher with realistic innings |

Step 2: postseason play
2. [x] Find and fix why only Sim is offered for the owner's postseason games. Check the All-Star Game's Play option too. Done when: in the browser, Play and Quick play each start a postseason game, record it and advance the series, including a game that can clinch.
   **Result:** the cause was the bye (see the plan check). Now the screens explain the bye and offer "Sim to my first game"; multi-day sims stop at the owner's postseason games and "Sim to the end" asks first (Claude's defaults). Checked in the browser at both sizes: Play and Quick play from Home and from the Postseason screen, series-point games, a Diamond Series clincher, and All-Star Play and Quick play. To confirm with the owner: was his team a top-2 seed?

Step 3: workload
3. [ ] Add the season workload rules. Done when: the targets hold over 2 or more seasons, no reliever pitches 3 straight days, every game has a pitcher, and simtest stays near 4.5 runs.
4. [ ] Apply Reliever of the Year eligibility. Done when: winners are relief pitchers with realistic innings.

Step 4: WAR, tests, docs
5. [ ] Recalibrate WAR. Done when: over 2 or more seasons the total is about 900–1,100, MVPs about 8–10, Rookies of the Year about 3–6.
6. [ ] Add tolerant checks for reliever innings, 3-day streaks and the WAR total to seasontest and franchisetest. Done when: they pass now and would fail on the old behavior.
7. [ ] Write the workload rules and WAR targets into DESIGN.md and ARCHITECTURE.md. Bump the Docs version. Done when: committed.

**Testing**
- [ ] `node tools/simtest.js 300 medium` (about 4.5 runs per team per game)
- [ ] `node tools/seasontest.js`
- [ ] `node tools/franchisetest.js 2 11` prints `all checks passed`
- [ ] Browser at 1280×800 and 390×844, no console errors: postseason Play and Quick play, All-Star Play
- [ ] Owner playtest: play one postseason game; sim a season and check Reliever of the Year innings and the WAR leaders

**Open questions** (for the owner)
- If the postseason problem is a missing feature and not a bug, report the size of the fix before building it. *(Answer: neither. Play worked; the bye hid it. The fix was about 50 lines in two UI files and `postseason.js`.)*
- Was the owner's team a top-2 seed (a bye) when only Sim was offered? If not, the report has another cause that hasn't been found.

**Risks**
- Tired-bullpen rules raised scoring before, so re-check runs per game.
- The postseason fix may touch shared files (main.js, UI files). Keep those edits to small hooks.
- Season checks vary from run to run, so keep thresholds tolerant.

### Milestone 2: in-season form
**Status:** planned (do not build until the owner says so)
**Goal:** During the season, players run hot or cold for a few weeks, and a few make a lasting breakout or decline. A hot or cold icon shows next to their names.
**Why now:** In the owner's playtest nobody slumped or broke out during the season. Per the docs, that only happens in spring training and offseason growth.

**In scope**
- A form modifier for hitters and pitchers
- Rare lasting changes mid-season
- Hot and cold icons
- Old saves keep working

**Out of scope** (on purpose, for later)
- Levels of hot and cold (later, owner's choice)
- News items (owner's choice)
- Spring, All-Star and exhibition games

**Based on:** docs version 7 (recheck after Milestone 1 bumps it).

**Decisions**
- Temporary hot and cold form, plus rare lasting breakouts or declines: owner's choice.
- Nothing posted to the news: owner's choice.
- One hot icon and one cold icon next to the player's name wherever it appears (roster, lineup, profile, leaders): owner's choice.
- Form comes from recent results plus luck, with a cap and a slow fade so it can't feed itself: Claude's default.
- The effect is a few rating points and averages out across the league, so balance targets don't move: Claude's default.
- Form applies in regular-season and postseason games, played or simmed: Claude's default.
- The icon reflects actual form and shows only for roughly the top and bottom 10%: Claude's default.
- Lasting changes: a few players a season, mostly young players up and veterans down, small, with no marker: Claude's default.
- Offseason growth must not count the same performance twice: Claude's default.
- Old saves load with neutral form: Claude's default.
- Build lasting changes so the later W5 growth model can absorb them: Claude's default.

**Tasks**
1. [ ] Check the plan against the code and report any mismatch. Done when: reported.
2. [ ] Form model in a logic file, applied where ratings become sim numbers. Done when: simtest and seasontest stay near 4.5 runs.
3. [ ] Lasting changes. Done when: franchisetest reports a few per season and ratings stay within 20–99.
4. [ ] Old saves. Done when: a save from before this milestone loads and plays.
5. [ ] Icons on the franchise screens. Done when: visible at both screen sizes with no overflow.
6. [ ] Docs: DESIGN.md, ARCHITECTURE.md player fields, Docs version bump. Done when: committed.

**Testing**
- [ ] The three Node tests above
- [ ] Browser at both sizes: every screen with icons
- [ ] Owner playtest: sim a month and look for hot and cold icons on the roster

**Open questions** (for the owner)
- Should the icon also show in the game HUD?
- Should a lasting change leave a small note on the profile?
- Should form apply in spring games?

**Risks**
- Balance drift
- Icon clutter on phones
- Feedback loops if the fade is too weak

---

## Template

```markdown
### Milestone N: <short name>
**Status:** planned | in progress | done
**Goal:** <one or two sentences: what the player can do or notice afterward>
**Why now:** <playtest feedback, a bug, or the next step from the briefing>

**In scope**
- ...

**Out of scope** (on purpose, for later)
- ...

**Based on:** docs version <N>. The coding session checks this against the current docs before building.

**Decisions**
- <decision>: owner's choice
- <decision>: Claude's default (owner hasn't decided; easy to change)

**Tasks**, in build order, each with how we'll know it's done:
1. [ ] <task>. Done when: <observable result or test>
2. [ ] <task>. Done when: ...

**Testing**
- [ ] `node tools/simtest.js 300 medium` (about 4.5 runs per team per game)
- [ ] `node tools/seasontest.js`
- [ ] `node tools/franchisetest.js 2 11` prints `all checks passed`
- [ ] Browser check at 1280×800 and 390×844, with no console errors: <which flows>
- [ ] Owner playtest: <what to try, what to look for>

**Open questions** (for the owner)
- ...

**Risks**
- ...
```

---

## Backlog

Ideas and known issues that aren't scheduled yet, from the project briefing at the end of `docs/transcript.md`.

**Toward the goal**
- Publish the game as a public web page so friends can play, for example on GitHub Pages. (Claude's suggestion for an early milestone; the owner picked a web link as the way to share.)
- Polish for new players: a clear first-time experience and how-to-play. (Claude's inference from the goal.)
- Later: an app version (owner asked to note it for later).

**Next steps**
- Owner playtest: a full season was simmed (Nov 14, 2026). The owner also did some manual play; what exactly is not confirmed. A hand-playtest of a full game, a few franchise days and a postseason game is Roadmap item 3.
- A permanent browser test suite in `tools/e2e/`.
- A line-by-line review of the agent-written modules (see `CLAUDE.md`).
- Default branch switched to `main`: done.
- Delete stale branches on GitHub (`ccr-deee3caa-ob0ti7`, `agent/*`): still open.

**Known gaps**
- Clinch and elimination marks can show a few days late.
- Draft prospects show by name only (their true ratings are hidden).
- After the final out, the celebration mob disappears once the box score opens.
- Escape closes all stacked popups at once.
- In games the owner plays, their own pitcher is never pulled automatically (by design, as in exhibition).
- Team budgets are about 2× to 3.4× typical payrolls, so CPU spending is capped at 60–80% of budget (by market tier).
- An offer popup can stay open if the screen changes underneath it.
- The batter's home run trot in the bat view is only a few steps.
- The sim marks most grounders as "dives", so replays use a stricter test of their own.

## Done

*(Finished milestones move here, with the date and a one-line summary.)*
