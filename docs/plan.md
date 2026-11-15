# Diamond Dash: milestone plan

**Docs version: 25** (2026-11-15): Milestone 2b: tasks 4 and 5 done; stopped before task 6 until the owner approves the archetype list.
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

1. **Milestone 1:** playtest fixes (postseason play, reliever workload, WAR). **Done** (owner's choice: he playtested and is satisfied, Nov 15, 2026).
   - **Milestone 1b:** strikeout and slugging balance (owner's choice, added Nov 14, 2026). **Done** (same playtest, Nov 15, 2026).
2. **Milestone 2:** in-season form (hot and cold streaks, breakouts and busts). Built and tested; waiting for the owner's playtest.
3. **Milestone 2b:** balance pass 2 (doubles, Stuff vs Velocity, batting-average spread, 25 archetypes) (owner's choice: after Milestone 2, before Milestone 3). In progress.
4. **Milestone 3:** team control, arbitration and extensions (owner's choice: right after Milestone 2b, in the first public release)
5. **Owner hand-playtest:** mostly done. The owner played a full game by hand and simmed a full season. A postseason game by hand is the only part left.
6. **QoL pass:** fix the QoL list (owner's choice: one pass right before release)
7. **Publish on GitHub Pages** (the project goal)
8. **First-time polish:** how to play, first-run experience
9. **W1:** more pitch types, and pitches that work in more complex ways (needs an interview; builds on Milestone 2b's Stuff/Velocity split)
10. **W2:** more postseason effects (after the owner has seen the current ones)
11. **W5a:** clearer stat pages and rate stats
12. **W5b:** one growth model with training focus and intensity
13. **W4a:** budgets (revenue, markets, luxury tax, Finances screen)
14. **W4b:** trading depth
15. **W4c:** free agency depth (builds on Milestone 3)
16. **W4d:** minor leagues (AAA with games; lower levels as rosters)
17. **W4e:** draft (bonuses, more rounds, prospect rankings)
18. **W3:** 3D characters and broadcast cameras (owner's choice: lower priority). Starts with a report on the hard-rule conflicts.

**Later** (owner's ideas; each needs an interview before planning)
- scouting
- OPS+, wRC+, ERA+, FIP, batted-ball data
- development in the lower minor levels
- levels of hot and cold
- hidden busts at creation: some prospects secretly have a lower real ceiling than shown; goes with W5b growth model and scouting (owner's choice)
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

### Milestone 2: in-season form
**Status:** built, tested and on `main` (owner's OK, Nov 15, 2026). Waiting for the owner's playtest. Results are in DESIGN.md "In-season form".
**Stopped at:** all six tasks done and merged to `main`; waiting for the owner's playtest.
**Goal:** During the season, players run hot or cold for a few weeks, and a few make a lasting change: breakouts (some big, rarely far past potential) and prospect busts. Hot and cold icons show next to player names and in the game HUD. Each lasting change leaves a note on the player's profile.
**Why now:** In the owner's playtest nobody slumped or broke out during the season.

**In scope**
- A form modifier for hitters and pitchers
- Spring results set each player's starting form on Opening Day
- Lasting mid-season changes: small changes, big breakouts, prospect busts
- Hot and cold icons next to player names and in the game HUD
- A profile note for each lasting change
- Old saves keep working

**Out of scope** (on purpose, for later)
- Levels of hot and cold (owner's choice)
- News items (owner's choice)
- Form in All-Star and exhibition games
- Hidden busts at creation (Later list, with W5b)

**Based on:** docs version 16, before this hand-off's own edits.

**Plan check** (coding session, Nov 15, 2026: what the code showed before building)
- Docs version: the repo was at 16, as the hand-off says. No stale assumptions found in the other docs.
- Potential (`p.pot`) is on the same 20–99 scale as overall. Whenever ratings change, `refreshOvr` already raises potential to at least overall, so "potential rises to match" happens on its own.
- Offseason growth (`develop`, offseason.js): age 25 or under, potential drifts a little each winter; 26–28, it drops 3 (never below overall); **29 and older, potential is set equal to overall**. Growth aims at the gap between potential and overall, and never pulls a young player down on purpose, so a breakout isn't undone.
- **Mismatch:** for every player 29 or older, potential equals overall. So any lasting gain by a veteran goes "past potential", and a big veteran breakout (+5 OVR or more) is "way past potential" almost by definition. See Open questions.
- Size: overall is a weighted mix of 6 hitter ratings or 4 pitcher ratings, so +5 to +10 on 2–3 ratings moves overall by about +3 to +6.
- Spring breakouts raise potential to at least overall + 2; slumps leave it alone. Unchanged by this milestone.
- Trade values use potential only for players 25 and under. The CPU draft uses the potential of draft prospects, who are created during the offseason draft, so mid-season changes can't touch them; a bust on a drafted prospect already in an organization lowers his trade value, as intended.
- Performance nudges (offseason): a full season's results against the player's overall at season's end. After a mid-season breakout the overall is already higher, so the nudge shrinks by itself; I'll also skip the nudge for players who had a lasting change that season so nothing counts twice.
- Ratings become sim numbers in `league.js` (`toGameBatter`, `toGamePitcher`). Played and simmed regular, spring and postseason games all go through `engine.teamDef`, and `engine.createGame` knows the game type, so form can be switched on for regular and postseason only. All-Star games use their own builder (`depth.js`) and exhibition games never touch league ratings, so neither gets form.
- `simtest` runs exhibition games only, so it can't move; `seasontest` and `franchisetest` are the real balance checks for form.
- HUD: the batter and pitcher lines are single lines that cut off with "…" (max width 46% of the screen, 320 px). An icon fits right after the name; on a phone the end of the batter line ("1-3, HR") may get cut a little sooner. No layout change needed.
- Old saves: there is no save version or upgrade step; a loaded league is used as is. So the new fields must be optional (missing = neutral form, no notes).

**Decisions**
- Temporary hot and cold form, plus lasting breakouts or declines: owner's choice.
- Nothing posted to the news: owner's choice. (Profile notes are not news.)
- One hot icon and one cold icon next to the player's name wherever it appears (roster, lineup, profile, leaders): owner's choice.
- The icon also shows on the batter and pitcher in the game HUD: owner's choice.
- Spring games don't use form, but spring results set each player's form on Opening Day: owner's choice.
  - Form applies in regular-season and postseason games, played or simmed: Claude's default.
  - A player with no spring games starts neutral: Claude's default.
  - Existing spring breakouts and slumps stay as they are: Claude's default.
- Every lasting change leaves a small note on the player's profile: owner's choice. Format such as "Breakout: +3 contact (Jun 12)": Claude's default.
- Breakouts can be big and can push a player past his potential. Going way past potential is rare: owner's choice.
- Big breakouts go mostly to players 27 and under, with a rare late bloomer up to about 31; veterans get small changes, mostly down: owner's choice (Nov 15, 2026, from the plan check).
- Young prospects can take a lasting mid-season drop that also lowers their potential, to balance the breakouts: owner's choice.
- Sizes and rates (Claude's default; tune if tests show a problem):
  - Small change: +/-1 to 3 on a few ratings. Mostly young players up, veterans down.
  - Big breakout: +5 to +10 on a few ratings, about 1-3 per season across all 30 teams.
  - Prospect bust (age 24 or under): a similar size and number, downward.
  - "Way past potential" (more than 5 over his old potential): about once every season or two.
- When a breakout passes a player's potential, his potential rises to match, so offseason growth doesn't pull him back: Claude's default.
- Form comes from recent results plus luck, with a cap and a slow fade so it can't feed itself: Claude's default.
- The form effect is a few rating points and averages out across the league, so balance targets don't move: Claude's default.
- The icon reflects actual form and shows only for roughly the top and bottom 10% of players: Claude's default.
- Offseason growth already nudges by performance against ratings. It must not count the same performance twice: Claude's default.
- Old saves load with neutral form and no notes: Claude's default.
- Build lasting changes so the later W5b growth model can absorb them: Claude's default.

**Tasks**
1. [x] Check this plan against the code. Done when: a report to the owner covers each point below, and any mismatch is settled before building.
   - the potential field, and how offseason growth, spring breakouts, trade values and the CPU draft use it
   - where ratings become sim numbers
   - room in the HUD for an icon
2. [x] Form model in a logic file, applied where ratings become sim numbers; spring results set the starting form. Done when: simtest stays near 4.6 runs per team per game, seasontest passes, and a new season starts with some players already hot or cold.
   **Result:** `js/form.js`. simtest 4.63 (unchanged: it runs exhibition games, which never use form). seasontest passes. Opening Day: 73–115 players hot and 67–110 cold; at midseason 8.5–13% of active players hot and 9–12% cold. Runs per team-game 4.40–4.66, about +0.02 against the same seeds without form. Hot streaks pushed the season's top starter to 222–230 IP about one season in three, so a pace guard was added (Claude's default; see DESIGN.md "Bullpen workload"): 203–216 IP over 12 measured seasons.
3. [x] Lasting changes: small changes, big breakouts (rarely way past potential, with potential raised to match) and prospect busts (with lower potential), each with a profile note. Done when: franchisetest prints per-season counts of each kind, inside the rates above, and ratings stay within 20-99.
   **Result** (22 test seasons): big breakouts 0–6 a season, average about 2; prospect busts 0–4, average about 2; steps forward 2–14 and back 4–14. Ratings stay within 20–99 and potential is never below overall (franchisetest checks both). **A little short:** "way past potential" happened 6 times in 22 seasons (about once every 3–4) against a target of once every season or two. **Over target once:** one season had 6 big breakouts (target 1–3).
4. [x] Old saves. Done when: a save from before this milestone loads and plays.
   **Result:** `node tools/oldsavetest.js` on a save made by the pre-milestone code one month into a season: it loads with neutral form, plays a month (hot and cold players appear), plays a user game, finishes the season with notes, and reaches the next Opening Day with form set from spring. Nothing needed upgrading: every new field is optional.
5. [x] Icons next to player names and in the game HUD, plus the profile notes on screen. Done when: visible at both screen sizes with no overflow.
   **Result:** 🔥 and ❄️ after the name on every player link (roster, leaders, box scores, profile) and in the lineup and rotation pickers; the profile shows a "Form" line and a "Notes" list. Checked with `node tools/e2e/form-check.js` from `file://` at 1280×800 and 390×844: no page overflow, no console errors. On phones the HUD's pitcher line drops its "Pitching:" label when he has an icon, so his energy bar still fits; the batter line still cuts off its end with "…" as before.
6. [x] Docs: DESIGN.md, ARCHITECTURE.md player fields, Docs version bump. Done when: committed.

**Testing**
- [x] `node tools/simtest.js 300 medium` (about 4.6 runs per team per game): 4.63
- [x] `node tools/seasontest.js` prints `all checks passed`
- [x] `node tools/franchisetest.js 2 11` prints `all checks passed` (also with `MANUAL=1`). Earlier runs, before the pace guard, failed the top-starter check twice. Separately, `MANUAL=1` runs on other seeds sometimes fail "rotation has injured" for the manual team, or "CPU refuses junk for its best player"; the pre-milestone code fails these the same way, so they are older flaky checks, not caused by form.
- [x] Browser at 1280×800 and 390×844, no console errors: roster, lineup, profile and leaders with icons and notes, plus a played game showing the HUD icon
- [ ] Owner playtest: sim a month and look for hot and cold icons; play a game and check the HUD; sim a season or two and read the breakout and bust notes

**Open questions** (for the owner)
- Defaults Claude added while building (keep or change?): the icon threshold (form ±2.8), the starter pace guard (8+ starts averaging over 6.2 IP get 10% less stamina), about 9 steps forward and 8 steps back a season, one lasting change per player per season, and the 🔥 / ❄️ icons.
- Players 29 and older have potential equal to overall, so any veteran gain is "past potential". How should big breakouts work? *(Owner, Nov 15, 2026: mostly young. Big breakouts go mostly to players 27 and under, with a rare late bloomer up to about 31. "Way past potential" means a new overall more than 5 above the old potential, for everyone. Veterans still get small changes, mostly down.)*

**Risks**
- Balance drift, especially from big breakouts piling up over many seasons
- Changing potential also moves trade values and CPU draft choices
- Icon clutter on phones and in the HUD
- Feedback loops if the fade is too weak
- Breakouts and offseason growth stacking on each other

### Milestone 2b: balance pass 2
**Status:** in progress
**Stopped at:** tasks 4 (physics for doubles) and 5 (Stuff and Velocity) done and pushed. Stopped before task 6 (archetypes): the owner is looking at the archetype list again and hasn't approved it. Not run yet for this milestone: `franchisetest` with `MANUAL=1`, `oldsavetest`, and the browser check after task 5.
**Goal:** More doubles, Stuff and Velocity doing different jobs, and a wider spread of batting averages with real outliers, driven partly by 25 hidden player archetypes.
**Why now:** Owner's feedback after Milestones 1b and 2 (Nov 15, 2026): doubles are still short; Stuff should matter more and lead to more strikeouts, separately from Velocity; averages are too high and there are no outliers. Fable (an earlier coding session) suggested a physics change for doubles; Milestone 1b found that no league-only setting raises doubles without also raising home runs or triples.

**In scope**
- A ball-physics change for doubles, everywhere
- Separate jobs for Stuff and Velocity
- The batting-average level and spread
- 25 hidden archetypes for hitters and pitchers, in player generation and assigned to existing players
- Re-checking everything that depends on these numbers (WAR, awards, bullpen, form, season checks)

**Out of scope** (on purpose, for later)
- New pitch types or pitch behavior (W1)
- Showing archetypes anywhere in the game (owner's choice: hidden)
- Growth model changes (W5b)

**Based on:** docs version 19.

**Decisions**
- Owner's choices:
  - Build after Milestone 2, before Milestone 3.
  - League AVG slightly lower, about .260, with a wider spread across players.
  - 5-10 .300 hitters per league (replaces 1b's 25-35 in the whole league).
  - Batting champion about .330-.350.
  - Build the 25 archetypes now: hidden, used only to generate players, exactly 25, covering hitters and pitchers. New and existing players each get one.
  - The coding session drafts the 25 archetypes, and the owner approves them before they're built.
  - Stuff (movement) drives swinging strikes and strikeouts. Velocity makes hitters late: weaker contact and fewer hard hits, but few extra strikeouts.
  - League strikeout rate stays about 21%, with a much wider gap between high- and low-Stuff pitchers.
  - Change the ball physics everywhere (playable game, exhibitions, simtest) to get more doubles. It's OK if runs fall to about 4.3 per team-game.
  - From the owner's reply to the proposal (Nov 15, 2026):
    - Doubles average at least about 1.4 per team-game.
    - There are too many .300 hitters. Regulars under .240 must outnumber .300 hitters. The league AVG target may move if that needs it.
    - Stuff matters for whiffs and Velocity for weak contact (confirmed).
    - Power moving AVG more than Contact is wrong: Contact comes first.
    - Work may stop at any time for usage limits, so commit often and keep "Stopped at" current.
- Claude's defaults:
  - Doubles target stays 1.2 or more per team-game (approved in 1b). *(Replaced by the owner: 1.4 or more on average.)* Home runs go back toward about 1.5 per team-game. Triples don't inflate.
  - 1b's standout targets stay: 1-2 (maybe 3-4) starters at 28%+ K and hitters slugging .600+ per league.
  - The low end widens too: some regulars hit around .220-.240.
  - The Stuff/Velocity split applies wherever pitch ratings are used, including games the owner plays. 1b's edge in games the owner plays (CPU hitters strike out a little more, best CPU pitchers a little harder to hit hard) stays.
  - Old saves get an archetype assigned from current ratings, without rewriting ratings. The full spread shows as new players arrive or in a new league.
  - Measure first, then show a target table and the archetype list, and wait for the owner's OK (same method as 1b).
  - Tune with Milestone 2's form switched on.

**Plan check** (coding session, Nov 15, 2026: what the code showed before building)
- Docs version: the repo was at 19, as the hand-off says. Step 0 (the GitHub rename) was already done in an earlier session.
- **Where Stuff and Velocity enter the results**
  - Stuff sets the quality of every pitch (`league.js` `toGamePitcher`). Pitch quality then does four things: it raises the CPU hitter's timing error on every pitch and his chase rate (`game.js` `cpuSwing`), it lowers exit velocity on contact (`game.js` `contactFx`), and when you bat it shrinks your timing window and adds a little break (`main.js`). Stuff is also three quarters of the two-strike put-away edge.
  - Velocity is worth about 1 mph per 12 rating points (about 2.3 mph at most). A faster pitch arrives sooner, which matters when you bat. For CPU hitters it adds only 0.8% timing error per mph, plus one quarter of the put-away edge. It has no effect on exit velocity.
  - Measured (table below): 10 points of Stuff are worth +2.4 points of strikeout rate and 3.6 fewer hard-hit balls per 100. 10 points of Velocity are worth +0.7 and almost nothing. So today Stuff does both jobs and Velocity does very little in simmed games, though it is 25–30% of a pitcher's overall.
  - Exhibition pitchers have no Stuff rating: each pitch gets a random quality, and velocity is a random −2 to +4 mph. The split has to work from those two numbers too.
- **Ball physics**
  - `js/sim.js` holds contact (exit velocity, launch angle, direction), flight, fielding, throws and baserunning. `js/game.js` holds the CPU hitter's timing and how a pitch changes contact. Every game type uses both: exhibitions, league games you play, simmed games, spring, All-Star, postseason, and `simtest`.
  - League games add their own settings on top (`league.js` `TUNE`): 1b's rangier infielders (×1.17) and slower outfielders (×0.9). Exhibitions and `simtest` don't use them. That is why the league has 1.11 doubles and 0.23 triples per team-game while `simtest` has 0.76 and 0.08.
  - Where doubles come from today (300 exhibition games): 0.57 of the 0.72 doubles per team-game are fly balls over an outfielder's head that reach the wall. Outfielders field 3.8 line drives per team-game on the ground and 99.5% of them are singles, however far the outfielder had to run. There are no gap doubles. A ball hit straight at an outfielder and one he chased 80 feet come back to the infield equally fast.
  - Trial (in a scratch copy, 600 games each, league-style fielding; nothing kept in the code): giving an outfielder extra time to stop, turn and throw after a long run moved doubles from 1.08 to 1.5–1.9 per team-game with home runs unchanged. Triples rose only when the same delay applied at the wall; making runners need a clearer margin to try for third brought them to 0.21. With exhibition fielding and infielders 10% rangier: doubles 1.37, triples 0.06, AVG .268, runs 4.41.
- **How players are generated**
  - One function makes every player: `BB.league.makePlayer` (`league.js`). Each rating is drawn on its own around the player's level plus a small position offset, so ratings don't come in recognizable shapes. New leagues, draft classes (`offseason.js`, 210 prospects a year), the starting free agents and emergency fill-ins all go through it, so archetypes plug in at that one place.
  - Offseason growth moves all of a player's ratings together, with a little noise, so a shape set at creation lasts through his career.
  - There is no save version or upgrade step. Existing players and old saves get their archetype the first time the league is used after loading.
  - Exhibition rosters don't use ratings, so they get no archetypes.
- **How much form moves batting averages** (6 seasons with form, the same 3 seeds without)
  | Measure | Form on | Form off |
  |---|---|---|
  | League AVG | .271 | .270 |
  | Spread of regulars' AVG (SD) | .026 | .024 |
  | .300 hitters per league | 18.6 | 16.9 |
  | Batting champion (average) | .342 | .335 |
  | Hitters slugging .600 or more, per league | 3.2 | 1.6 |
  | Runs per team-game | 4.55 | 4.48 |
- **Mismatches with the plan** (settled in the proposal below, which needs the owner's OK)
  - The spread of batting averages is not narrow today: among regulars it is .025–.026 (SD), with the lowest at .192–.221. About .019 of that is luck over 550 at-bats. What is off is the level (.271, so 29–45 hitters reach .300) and the cause: Power moves AVG more than Contact does (+.013 against +.007 per 10 points), and hitters' strikeout rates are nearly all alike (spread 2.2 points). A pure contact hitter can't win a batting title today.
  - "5–10 .300 hitters per league" and "a wider spread" pull against each other. At a league AVG of .260, about 9 hitters per league reach .300 with today's spread, and a clearly wider spread (.030) would mean about 12. So the spread can widen only a little; the change is in the level and in who the outliers are.
  - Home runs are at 1.51–1.64 per team-game (average 1.59), triples at 0.22–0.24 (already high; `simtest` has 0.08), and hitters slugging .600 or more at 0–6 per league (average 3) with form on, above 1b's 1–2.
  - 1b's "best CPU pitchers a little harder to hit hard" comes from Stuff today. After the split it comes from Velocity. The effect stays; the rating behind it changes.

**Baseline** (`node tools/measure.js 2 11,12,13`, twice: 12 simulated seasons with form on) **and targets** (proposed by Claude; approved by the owner Nov 15, 2026 with two changes, marked)
| Measure | Now | Target |
|---|---|---|
| Runs per team-game | 4.42–4.66 (average 4.55) | about 4.4 (4.3–4.6) |
| League AVG | .269–.274 | about .260 (.255–.264); may move if the .300 and .240 counts need it (owner) |
| League strikeout rate | 20.6–21.3% | about 21% (20–22%) |
| League SLG | .445–.458 | about .440 (.430–.450) |
| Doubles per team-game | 1.09–1.15 | 1.4 or more on average (owner; was "about 1.4") |
| Triples per team-game | 0.22–0.24 | 0.2 or fewer |
| Home runs per team-game | 1.51–1.64 | about 1.5 (1.4–1.55) |
| .300 hitters per league (of about 124 regulars) | 14–27, average 19 | 5–10 |
| Regulars under .240 against .300 hitters, whole league | 11–27 against 29–45 | more under .240 than at .300 (owner) |
| Batting champion, each league | .328–.364, average .343 | .330–.350 |
| Spread of regulars' AVG (SD) | .023–.027, average .025–.026 | .026–.029: a little wider (see the plan check) |
| Regulars under .240 / under .220, whole league | 11–27 / 0–4 | about 35–55 / about 8–18 |
| Lowest regular | .192–.221 | about .190–.215 |
| 10 points of Contact are worth, in AVG | +.007 | about +.016 |
| 10 points of Power are worth, in AVG | +.013 | about +.008 |
| Spread of regulars' strikeout rates (hitters, SD) | 2.2 points | about 4.5 points: best contact hitters about 10–12%, low-contact sluggers about 30% |
| 10 points of Stuff are worth, in pitcher K% | +2.4 points | about +4 |
| 10 points of Velocity are worth, in pitcher K% | +0.7 | +0.5 or less |
| K% of pitchers with Stuff under 50 / 80 or more | 16.7% / 27% | about 14–15% / about 30% |
| Spread of qualified starters' K% (SD) | 2.5–3.5, average 2.9 | about 4 |
| Starters at 28% K or more, per league | 0–4, average 1.5 | 1–2, maybe 3–4 (as in 1b) |
| 10 points of Velocity are worth, in hard-hit rate | −0.1 | about −3 |
| 10 points of Stuff are worth, in hard-hit rate | −3.6 | about 0 (−1 to +1) |
| Hard-hit rate against Velocity under 50 / 80 or more | 44% / 39% | about 47% / about 35% |
| Hitters slugging .600 or more, per league | 0–6, average 3 | 1–2, maybe 3–4 (as in 1b) |

A regular is a hitter with 502 or more plate appearances; a qualified starter has 162 or more innings. Hard-hit means 100 mph or more off the bat, which about 42% of balls in play reach. "10 points are worth" holds the pitcher's or hitter's other ratings fixed.

**More baseline detail**
| Rating band | Pitchers: K% by Stuff | Pitchers: K% by Velocity | Hard-hit by Stuff | Hard-hit by Velocity | Hitters: AVG by Contact | Hitters: AVG by Power |
|---|---|---|---|---|---|---|
| Under 50 | 16.7% | 18.8% | 49.0% | 44.0% | .260 | .253 |
| 50–59 | 19.0% | 19.8% | 45.2% | 43.6% | .265 | .262 |
| 60–69 | 21.7% | 21.4% | 41.2% | 41.9% | .276 | .276 |
| 70–79 | 23.9% | 22.6% | 37.9% | 41.4% | .293 | .292 |
| 80 or more | 27.1% | 24.5% | 36.8% | 38.8% | .297 | .305 |

- Bands don't hold the other ratings fixed, and good pitchers tend to be good at everything, so the Velocity columns overstate what Velocity does by itself. Pitchers with high Stuff and low Velocity strike out 22.9% with 37.4% hard-hit; low Stuff and high Velocity: 19.7% and 45.7%.
- The twelve batting champions had Contact 66–87 and Power 57–97. One season's top five by AVG: Contact 75, 82, 67, 55, 62 and Power 79, 74, 84, 75, 90, with 34–50 home runs each.

**How the targets would be reached** (Claude's defaults; the settings get tuned while building)
- Doubles, everywhere: an outfielder who runs a long way to cut a ball off needs extra time to stop, turn and throw; runners need a clearer margin to try for third; infielders cover a little more ground in every game type, so singles fall as doubles rise; the wall plays a little taller or the ball carries a little less, so a few home runs become doubles off the wall. 1b's league-only fielding settings shrink or go away.
- Stuff: all of the put-away edge and more of the swing-and-miss; none of the weak contact.
- Velocity: hitters are late (more balls to the opposite field) and exit velocity drops; almost no strikeouts of its own. In games you bat, a fast pitch still arrives sooner.
- Contact: counts for more, mostly through strikeouts: a good contact hitter protects the plate with two strikes. Power keeps driving home runs.
- Archetypes: move points between a player's ratings without changing his overall, so team strength, salaries and trade values stay where they are.

**Proposed archetypes** (Claude's draft, still waiting for the owner's OK). "Very high" is about 14 points above the player's own level, "high" about 9, "above" about 5; "below", "low" and "very low" are the same sizes downward. Every player still varies by a few points around his shape. Shares are of all hitters or of all pitchers.

| # | Hitters | High | Low | Share | Plays like |
|---|---|---|---|---|---|
| 1 | All-around | nothing stands out | nothing | 15% | a little of everything |
| 2 | Contact artist | Contact very high | Power low | 6% | .300 or better, few home runs, few strikeouts |
| 3 | Slap-and-run hitter | Contact high, Speed high | Power very low | 6% | singles, infield hits, steals |
| 4 | On-base machine | Eye very high, Contact above | Power below, Speed below | 6% | walks and a good average |
| 5 | Pure slugger | Power very high | Contact low, Speed low | 9% | 35 or more home runs, a low average, many strikeouts |
| 6 | Three-outcome hitter | Power high, Eye high | Contact very low | 6% | home runs, walks and strikeouts; about .220 |
| 7 | Free swinger | Power high, Contact above | Eye very low | 6% | hits for power, chases, rarely walks |
| 8 | Line-drive hitter | Contact high, Power above | Speed below, Arm below | 9% | a good average with doubles |
| 9 | Glove-first defender | Fielding very high, Arm high | Contact low, Power low | 9% | a light bat that saves runs in the field |
| 10 | Speedster | Speed very high, Fielding above | Power low, Eye below | 6% | steals, triples, range |
| 11 | Power-speed athlete | Power high, Speed high | Contact low, Eye low | 5% | home runs and steals, streaky |
| 12 | Cannon arm | Arm very high, Power above | Speed low, Contact below | 6% | throws runners out; some pop |
| 13 | Bat-first hitter | Contact high, Power high, Eye above | Fielding very low, Arm low, Speed low | 6% | a middle-of-the-order bat with no glove |
| 14 | Glove-and-pop | Fielding high, Power high | Contact very low, Eye below | 5% | 20 home runs, .215, a strong glove |

| # | Pitchers | High | Low | Share | Plays like |
|---|---|---|---|---|---|
| 15 | All-around arm | nothing stands out | nothing | 14% | a little of everything |
| 16 | Flamethrower | Velocity very high | Control low | 10% | weak contact, walks |
| 17 | Strikeout artist | Stuff very high | Velocity low | 9% | many strikeouts; hit hard when hit |
| 18 | Control artist | Control very high | Velocity low, Stuff below | 10% | few walks, many balls in play |
| 19 | Workhorse | Stamina very high | Stuff low, Velocity below | 9% | deep into games, few strikeouts |
| 20 | Max-effort arm | Velocity high, Stuff high | Stamina very low | 9% | dominant in short outings (mostly relievers) |
| 21 | Crafty pitcher | Stuff high, Control high | Velocity very low | 8% | strikeouts without speed |
| 22 | Wild thing | Stuff high, Velocity above | Control very low | 8% | strikeouts and walks |
| 23 | Contact manager | Velocity high, Control above | Stuff low | 9% | weak contact, few strikeouts |
| 24 | Soft-tosser | Control high, Stamina high | Velocity very low, Stuff below | 7% | throws strikes and lasts; gets hit hard |
| 25 | Power workhorse | Velocity high, Stamina high | Stuff low, Control below | 7% | deep into games on weak contact |

- Position tilts the mix: glove-first defenders are mostly catchers, shortstops, second basemen and center fielders; sluggers and bat-first hitters are mostly first basemen, DHs and corner outfielders; max-effort arms are mostly relievers; workhorses are starters. League-wide shares still match the table, within a couple of points.
- Existing players and old saves get the archetype whose shape is nearest their current ratings. Their ratings don't change.

**Tasks** (commit and push after each)
Step 1: measure and propose
1. [x] Check this plan against the code. Done when: a report to the owner covers each point below.
   - where Stuff and Velocity enter the results (1b's put-away edge is 3/4 Stuff, 1/4 Velocity)
   - which files hold the ball physics, and which game types use them
   - how players are generated, and where archetypes would plug in
   - how much Milestone 2's form moves batting averages
   **Result:** see "Plan check" above, with four mismatches for the owner.
2. [x] Measure a baseline over several seasons (with form). Done when: a report to the owner covers each point below.
   - batting averages: .300 hitters per league, the batting champion, the spread of qualified AVG, and the lowest regulars
   - doubles, triples and home runs
   - strikeouts: K% by Stuff band, and the spread of K%
   - contact quality (hard-hit rate or exit velocity) by Velocity band
   - runs
   **Result:** see "Baseline" above (12 seasons). `tools/measure.js` now prints these numbers: a list of seeds, `BRIEF=1` for the summary only, `FORM=0` to switch form off.
3. [ ] Propose a target table, and the 25 archetypes with each one's name, high and low ratings, and rough share of players. **Wait for the owner's OK.** Done when: the owner approves or changes them.
   **Targets: approved Nov 15, 2026 with changes** (doubles 1.4 or more on average; more regulars under .240 than at .300, with the league AVG free to move). **Archetypes: not approved yet.** The owner's reply covered the targets only. Asked again after task 5 (Nov 15, 2026): the owner wants to look at the list again first, so task 6 waits.
Step 2: physics
4. [x] Physics change for doubles. Done when:
   - doubles are 1.2 or more per team-game, home runs about 1.5, and triples not inflated
   - runs are about 4.3-4.6 in both simtest and full seasons
   - a played game in the browser looks right
   **Result** (four seasons; details in DESIGN.md "Balance pass 2"): an outfielder who runs a long way to a ball on the ground needs extra time to field it, and the infield and outfield range settings moved from the league into the shared physics. League doubles 1.62–1.65, triples 0.10–0.11, home runs 1.44–1.56, runs 4.27–4.51 (one season of four a little under 4.3), AVG .258–.264. `simtest`: 4.53 runs, .267, doubles 1.64, home runs 1.48. Checked in the browser at both sizes (`node tools/e2e/play-check.js`): a staged gap hit, an exhibition game and a franchise game, no console errors. **Not as planned:** exhibition triples rose from 0.08 to 0.20 per team-game (league triples fell from 0.23 to 0.11). The season checks got doubles, triples and wider extra-base-hit bands now, so the tests stay green between tasks.
Step 3: Stuff and Velocity
5. [x] Split their jobs. Done when:
   - K% rises clearly with Stuff and barely with Velocity
   - contact quality falls with Velocity
   - the league K% is about 21%
   - standout starters average 1-2 per league
   **Result** (eight seasons; table in DESIGN.md "Balance pass 2"): 10 points of Stuff are worth +3.7 to +3.8 points of K% (was +2.4) and 10 of Velocity +0.1 (was +0.7). 10 points of Velocity take 2.9–3.0 points off the hard-hit rate (was 0.1) and 10 of Stuff 0.3–0.4 (was 3.6). League K% 20.5–21.3%. `simtest` 4.48 runs; league runs 4.32–4.51. **Not fully inside the target:** starters at 28% K average about 2.2 per league (0 to 6 in a single league), a little over "1–2"; this gets re-checked in task 8, after the archetypes change who has elite Stuff. The league's power setting went from 1.025 to 1.
Step 4: archetypes and the AVG spread
6. [ ] Archetypes in player generation, and assigned to existing players and old saves. Done when: every player has one; new leagues and draft classes match the approved shares; an old save loads and plays.
7. [ ] Batting-average spread. Done when, over several seasons:
   - league AVG is about .260
   - there are 5-10 .300 hitters per league
   - the batting champion hits .330-.350
   - the spread is wider than the baseline
8. [ ] Re-check Milestone 1's bullpen and WAR targets, 1b's standouts and Milestone 2's form rates. Refit the WAR settings and the contract expectation if they moved. Done when: the numbers are reported and inside their windows.
9. [ ] Update the season checks (tools/checks.js) with the new bands, update DESIGN.md, ARCHITECTURE.md and README.md, and bump the Docs version. Then one independent review agent. Done when: committed, and the review's findings are fixed or reported.

**Testing**
- [ ] node tools/simtest.js 300 medium (new baseline after the physics change; about 4.3-4.6)
- [ ] node tools/seasontest.js prints all checks passed
- [ ] node tools/franchisetest.js 2 11 prints all checks passed (also with MANUAL=1), plus tools/oldsavetest.js
- [ ] Browser at 1280x800 and 390x844, no console errors: a played game, an exhibition game and the leaders screen
- [ ] Owner playtest: play a game and see whether doubles and strikeouts feel right; sim a season and check the AVG, K% and doubles leaders

**Open questions** (for the owner)
- Task 3: are the 25 archetypes OK as listed, or what should change? (Needed before task 6.)
- *(Answered Nov 15, 2026: the targets are approved with changes; fewer .300 hitters matters more than a wider spread. See Decisions.)*

**Risks**
- The physics change alters how the game the owner plays feels
- simtest gets a new baseline, so older numbers in the docs no longer compare
- Wider spreads move WAR, awards, contracts and team records
- Existing leagues won't show the full spread until players turn over
- Form adds noise on top of the batting-average spread
- Milestone 3's arbitration salaries depend on the WAR scale set here

### Milestone 3: team control, arbitration and extensions
**Status:** planned (build in a new session after Milestone 2b is merged to main, when the owner says so)
**Based on:** docs version 19 (written against version 16; recheck after Milestone 2b).
**Goal:** Young players stay under team control until 6 years of big-league service: about 3 years near the minimum salary, then 3 arbitration years with automatic raises. The owner tenders or non-tenders arbitration players, and can offer an extension to anyone on his team at any time. Prospects who never make it become minor-league free agents. CPU teams follow the same rules.
**Why now:** The owner noticed (Nov 15, 2026) that the game has no service-time rule, and wants it in the first public release.

**In scope**
- Service time on every player; status: pre-arbitration, arbitration year 1-3, free agent after 6 years
- Automatic arbitration salaries; tender or non-tender in the offseason
- Extensions for any player on the owner's team, at any time
- Minor-league free agency
- CPU teams under the same rules
- Service time and status on the profile
- Trade values that count years of control
- Old saves keep working

**Out of scope** (on purpose, for later)
- Arbitration hearings and filing numbers (owner's choice: automatic)
- "Super Two", service-time manipulation rules, minor-league options, a 40-man roster
- Bidding wars and player preferences in free agency (W4c)

**Decisions**
- Owner's choices:
  - 6 years of team control before a young player's first free agency, like MLB.
  - Only big-league days count: the active roster or the big-league injured list.
  - Pay: about 3 years near the minimum, then 3 years of arbitration.
  - Arbitration salaries are set automatically from stats. The owner tenders (keeps the player at that salary) or non-tenders (he becomes a free agent).
  - Extensions can go to anyone on the owner's team, at any time, until the player reaches free agency, like MLB.
  - Minor-league free agency: a player who has been in the organization for 7 seasons without reaching 6 years of service becomes a free agent, unless he's on the active roster.
  - Built as its own milestone right after Milestone 2b.
- Claude's defaults:
  - Service builds by the day. A full regular season on the active roster or big-league injured list = 1 year. Spring and postseason days don't count.
  - Draftees start at 0. Reserves and prospects don't build service.
  - Players already in the league, and old saves, get an estimated service time from their career records and age.
  - A player under 6 years who already has a contract keeps it. Control rules apply when it ends.
  - Pre-arbitration players are renewed at the game's current minimum salary.
  - Arbitration salaries reuse the existing asking-price expectation (WAR against what his rating usually brings): about 40% / 60% / 80% of his free-agent value in arbitration years 1-3.
  - The existing re-signing step applies only to players with 6+ years. Players under 6 go through tender or non-tender instead.
  - An extension is accepted if it reaches the player's asking price. Controlled players take a discount for security. A player can refuse.
  - CPU teams extend selectively, so free agency doesn't empty out. They also non-tender weak arbitration players.
  - Trade values count years of control left and the cheap salary.
  - Build in two steps, likely two sessions: Step 1 logic, Step 2 screens.

**Tasks**
Step 1: rules and logic
1. [ ] Check this plan against the code. Done when: a report to the owner covers each point below, and any mismatch is settled before building.
   - how draftees' and generated players' contracts are set, and how the starting veterans' history is built
   - the minimum salary and the asking-price function
   - the re-signing and free-agency steps, released players' dead money and trade values
2. [ ] Service time: a new player field that builds by the day, plus estimates for existing players and old saves. Done when: franchisetest checks that a full season on the active roster = 1 year, reserves gain none, and an old save loads with estimates.
3. [ ] Control in the offseason: pre-arbitration renewals, automatic arbitration salaries, tender or non-tender, re-signing only for 6+ years, minor-league free agency. Done when: franchisetest prints per-season counts (arbitration cases, non-tenders, minor-league free agents), and checks that no player under 6 years reaches free agency except by non-tender, release or minor-league free agency.
4. [ ] Extensions (an offer and accept function) and CPU extensions and non-tenders. Done when: tests show some CPU extensions each season, and the report gives total payrolls and free-agent pool size against today's numbers.
5. [ ] Trade values count control. Done when: a test shows a cheap controlled player valued above a same-rated player on an expiring deal.
Step 2: screens
6. [ ] Profile: service time, status, and an "Offer extension" button at any time. Done when: it works at both screen sizes with no overflow.
7. [ ] Offseason: a tender or non-tender screen inside the re-signing step. Done when: a click-through from the end of the postseason to Opening Day works with real buttons.
8. [ ] Docs: DESIGN.md, ARCHITECTURE.md player fields, Docs version bump. Then one independent review agent. Done when: committed, and the review's findings are fixed or reported.

**Testing**
- [ ] node tools/simtest.js 300 medium (should stay at Milestone 2b's new baseline)
- [ ] node tools/seasontest.js prints all checks passed
- [ ] node tools/franchisetest.js 2 11 prints all checks passed (also with MANUAL=1), plus a longer run of about 8 seasons to see minor-league free agency
- [ ] Browser at 1280x800 and 390x844, no console errors: profile with service time and the extension offer, the tender screen, the offseason click-through
- [ ] Owner playtest: sim 2-3 seasons; check your young players' status, tender or non-tender someone, offer an extension during the season

**Open questions** (for the owner)
- None right now. The owner can change any Claude's default after playtesting.

**Risks**
- Cheap young players lower payrolls, which shifts budgets and the free-agent market
- CPU extensions could empty free agency
- Milestone 2's big breakouts raise arbitration salaries (intended, but watch the size)
- Milestone 2b's wider spreads and WAR refit change arbitration and extension values
- Service estimates for existing players could put too many of them into free agency at once
- Interaction with released players' dead money and the CPU spending cap

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
- Owner hand-playtest (Roadmap item 5): mostly done. The owner played a full game by hand and simmed a full season. A postseason game by hand is the only part left.
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

- **Milestone 1: playtest fixes** (done Nov 15, 2026): the owner can play his own postseason games (the bye was the cause), relievers have season workload rules, WAR and the awards are calibrated. Playtested by the owner and he is satisfied.
- **Milestone 1b: strikeout and slugging balance** (done Nov 15, 2026): more strikeouts, lower averages, more extra-base hits, and 1–2 standout pitchers and hitters per league. Playtested by the owner and he is satisfied.

The full text of both milestones follows, for reference.

#### Milestone 1: playtest fixes
**Status:** done. Built and on `main` Nov 14, 2026; the owner playtested it and is satisfied (owner's choice, Nov 15, 2026).
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
- Postseason: Play and Quick play already work whenever the owner's team has a game that day. A top-2 seed has a bye, so for the first four postseason days (three Wild Card days and an off day) both screens offer only Sim buttons, with no note that the owner's games come later. "Sim to the end" and Home's Week, Month and End of postseason then sim the owner's own games without asking. This was the cause of the report (the owner confirmed his team was a top-2 seed). It is a small fix in two UI files, not a missing feature.
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
   **Result:** the cause was the bye (see the plan check). Now the screens explain the bye and offer "Sim to my first game"; multi-day sims stop at the owner's postseason games and "Sim to the end" asks first (Claude's defaults). Checked in the browser at both sizes: Play and Quick play from Home and from the Postseason screen, series-point games, a Diamond Series clincher, and All-Star Play and Quick play. The owner confirmed his team was a top-2 seed.

Step 3: workload
3. [x] Add the season workload rules. Done when: the targets hold over 2 or more seasons, no reliever pitches 3 straight days, every game has a pitcher, and simtest stays near 4.5 runs.
   **Result** (twelve seasons; details and the before/after table in DESIGN.md "Bullpen workload"): 0 appearances on a 3rd straight day; every game had a pitcher; top starter 202–218 IP; bullpen arms average 60–76 IP and 45–69 games; league scoring 4.42–4.72 (average 4.5); simtest 4.63 (was 4.62). **Slightly over target:** the busiest reliever throws 85–100 IP in relief (target about 60–80, warning above about 95), the games leader pitches 75–82 games (target at most about 75), and the top starter passes 210 IP in about one season in three.
4. [x] Apply Reliever of the Year eligibility. Done when: winners are relief pitchers with realistic innings.
   **Result:** eight winners over four seasons, all with 0 starts: 28–45 saves, 57–81 IP, 49–68 games.

Step 4: WAR, tests, docs
5. [x] Recalibrate WAR. Done when: over 2 or more seasons the total is about 900–1,100, MVPs about 8–10, Rookies of the Year about 3–6.
   **Result** (six seasons; table in DESIGN.md "WAR and the awards"): total 998–1,037, hitters 55–57%; MVPs 7.4–10.2, average 8.9, 10 of 12 at 8 or more; Rookies of the Year 2.6–6.6, all aged 20–25. Also fixed: from year 2 on, generated veterans with empty careers counted as rookies (a 30-year-old could win). **Not fully inside the window:** about one MVP in six is at 7–8, and about one season in six has a player at 11–12, because the best season varies a lot from year to year.
6. [x] Add tolerant checks for reliever innings, 3-day streaks and the WAR total to seasontest and franchisetest. Done when: they pass now and would fail on the old behavior.
   **Result:** `tools/checks.js`, used by both tests. Run against the code from before step 2, 9 of 11 checks fail. The WAR total check passes on the old code too (the total was already about 1,000); the hitters' and relievers' shares are the WAR checks that catch the old behavior.
7. [x] Write the workload rules and WAR targets into DESIGN.md and ARCHITECTURE.md. Bump the Docs version. Done when: committed.

**Testing**
- [x] `node tools/simtest.js 300 medium` (about 4.5 runs per team per game): 4.63, the same as before the milestone (4.62)
- [x] `node tools/seasontest.js`: all checks passed, 4.47–4.52 runs per team-game
- [x] `node tools/franchisetest.js 2 11` prints `all checks passed` (also with `MANUAL=1`)
- [x] Browser at 1280×800 and 390×844, no console errors: postseason Play and Quick play, All-Star Play (run from disk through `file://`)
- [x] Owner playtest: play one postseason game; sim a season and check Reliever of the Year innings and the WAR leaders (satisfied, Nov 15, 2026)

**Open questions** (for the owner)
- These are Claude's defaults made while building. Keep or change? The rookie age limit (27), the WAR stretch for hitters, the 1.5% contact lift for league hitters, and sims stopping at your postseason games. *(Owner, Nov 14: keep all four.)*
- If the postseason problem is a missing feature and not a bug, report the size of the fix before building it. *(Answer: neither. Play worked; the bye hid it. The fix was about 50 lines in two UI files and `postseason.js`.)*
- Was the owner's team a top-2 seed (a bye) when only Sim was offered? If not, the report has another cause that hasn't been found. *(Owner, Nov 14: yes, it was. The bye was the cause.)*

**Risks**
- Tired-bullpen rules raised scoring before, so re-check runs per game.
- The postseason fix may touch shared files (main.js, UI files). Keep those edits to small hooks.
- Season checks vary from run to run, so keep thresholds tolerant.

#### Milestone 1b: strikeout and slugging balance
**Status:** done. Built and on `main` Nov 14, 2026; the owner playtested it and is satisfied (owner's choice, Nov 15, 2026). Results are in DESIGN.md "Strikeout and slugging balance".
**Goal:** Top pitchers strike out more hitters, batting averages come down a little, and more hits go for extra bases. Each league has 1–2 standout pitchers and 1–2 standout hitters a season.
**Why now:** The owner's feedback after Milestone 1 (Nov 14, 2026): strikeout rates for top pitchers look a bit low and batting averages a bit high.

**In scope**
- League strikeout rate, batting average and extra-base hits
- How much a pitcher's Stuff and a hitter's ratings separate the best from the rest
- Everything that depends on those numbers: WAR, the awards, the season checks, the docs

**Out of scope** (on purpose, for later)
- New pitch types or pitch behavior (W1)
- In-season form (Milestone 2)
- Exhibition games and the playable game's physics, unless the owner says otherwise (see Open questions)

**Based on:** docs version 13.

**Decisions**
- Raise strikeouts slightly, lower batting average, raise slugging through extra-base hits: owner's choice.
- 1–2 standout pitchers and 1–2 standout hitters per league: owner's choice.
- Keep runs per team-game near 4.5: owner's choice.
- Measure first, propose targets, and wait for the owner's OK before changing anything: owner's choice.
- Re-run all three tests and re-check Milestone 1's reliever-innings and WAR targets after the change; commit and push after each step: owner's choice.
- The target numbers in the table below: proposed by Claude from general baseball knowledge (not research), approved by the owner on Nov 14, 2026.
- More diversity, not everyone bunched near the middle: 1–2, maybe 3 or 4, standout players way above the pack: owner's choice.
- Accept fewer doubles for now and let more of the slugging come from home runs; try for doubles but don't hold the milestone for them: owner's choice.
- CPU hitters strike out a little more against your pitching, and the best CPU pitchers are a little harder to hit hard, in games you play: approved by the owner.
- Push each step to `main`: owner's choice.
- Change only how league ratings turn into sim numbers (`league.js`), so exhibition games and `simtest` don't move: Claude's default.
- A "standout" means a qualified starter at 28% strikeouts or more, or a qualified hitter slugging .600 or more: Claude's default.

**Baseline** (`node tools/measure.js`, four simulated seasons on the Milestone 1 code) **and proposed targets**
| Measure | Now | Proposed target |
|---|---|---|
| Runs per team-game | 4.47–4.61 | about 4.5 (4.4–4.6) |
| League strikeout rate | 18.1–18.6% | about 21% (20–22%) |
| League AVG | .284–.287 | about .268 (.263–.273) |
| League SLG | .427–.435 | about .440 (.435–.450) |
| League OBP (walks stay at about 6%) | .325–.328 | about .310 |
| Extra-base hits per team-game | 2.22–2.29 (22% of hits) | about 2.8 (about 31% of hits) |
| Doubles per team-game | 0.73–0.78 | about 1.2 or more |
| Home runs per team-game | 1.41–1.49 | no higher than now |
| Qualified starters: average K% and spread | 18.7%, spread 1.7 points | about 21%, spread about 3.5 points |
| Best starter by K% | 22.5% (about 8.4 per 9 innings, 190 K) | about 29–31% (about 11 per 9, 240 K or more) |
| Starters at 28% K or more | 0 | 1–2 per league |
| 200-strikeout pitchers | 0 | about 6–10 in the league |
| .300 hitters (of about 252 qualified) | 63–74 | about 25–35 |
| Batting champion | .340–.345 | about .330–.345 |
| Hitters slugging .600 or more | 0–1 in the whole league | 1–2 per league |
| Best slugger | .555–.600 | about .620–.660 |

**Top 5 now** (2027 season of the first baseline run)
| Starters by K% | | Hitters by AVG | | Hitters by SLG | |
|---|---|---|---|---|---|
| T. Santos (UNI) | 22.5%, 158 K, 4.46 ERA | B. Reed (UNI) | .343 | I. Daniels (BAY) | .560, 41 HR, 10 2B |
| T. Diaz (CAP) | 22.5%, 192 K, 2.38 ERA | V. Romero (RVB) | .341 | K. Doyle (SIL) | .555, 39 HR, 17 2B |
| M. Mendez (ICB) | 22.3%, 182 K, 2.84 ERA | M. Brooks (HAW) | .340 | B. Ramos (RID) | .552, 39 HR, 20 2B |
| S. Graves (CAP) | 22.2%, 167 K, 3.02 ERA | P. Ochoa (SUN) | .333 | T. Fujita (RID) | .544, 34 HR, 11 2B |
| M. Vega (SUM) | 22.2%, 175 K, 4.15 ERA | T. Fujita (RID) | .329 | B. Reed (UNI) | .531, 29 HR, 17 2B |

**What the baseline shows**
- Starters are bunched: the best strikeout rate is only 4 points above the average. A pitcher's Stuff rating moves his results by about 5% at most, and a hidden random quality on each pitch matters about as much. That is also why low-rated starters post Cy Young seasons (noted in Milestone 1).
- About 1 qualified hitter in 4 bats .300.
- Extra-base hits are mostly home runs. Doubles are rare (about 0.75 per team-game), so a slugging leader has 40 home runs and 10–20 doubles.

**Trial runs before the owner asked to stop** (one season each, one setting changed, nothing kept in the code)
- All hitters' timing 5.5% worse: strikeouts 20.5%, AVG .276, runs 4.19.
- All hitters' power 5% up: runs 5.15, home runs 1.73 per team-game, doubles only 0.87.
- All runners 6% faster: triples quadruple, doubles fall.
- Stuff rating counting 3 times as much: Stuff then predicts strikeouts well, but the best starter still reaches only 9 per 9 innings.
- So the first three targets are reachable with league-only settings, standouts need Stuff to count for much more than 3 times as much, and **doubles are the open problem**: none of these settings raises doubles without raising home runs or triples.

**Tasks** (commit and push after each step)

Step 1: measure
1. [x] Measure the league strikeout rate, AVG, SLG, extra-base hits and runs per team-game, and the top 5 starters by K% and top 5 hitters by AVG and SLG. Done when: reported to the owner and written here.

Step 2: targets
2. [x] Propose target numbers and wait for the owner's OK. Done when: the owner approves or changes the table above. *(Approved Nov 14, 2026, with "more diversity" and "fewer doubles is fine for now".)*

Step 3: build
3. [x] Retune the league settings to the approved targets, with runs per team-game near 4.5. Done when: the targets hold over 2 or more seasons.
   **Result** (six seasons, three seeds): runs 4.48–4.65; strikeouts 20.9–21.4%; AVG .268–.274; SLG .445–.457; extra-base hits 2.86–2.99 per team-game (30–31% of hits). **Short of target:** doubles 1.10–1.16 (target 1.2), home runs up about 8% (accepted by the owner), SLG a little over .450 in about one season in three.
4. [x] Make ratings separate the best from the rest so each league has 1–2 standouts. Done when: 2 or more seasons show 1–2 standout starters and 1–2 standout hitters per league, and not more.
   **Result:** starters at 28% K or more: 0–4 per league, average 1.5 (best 29–33%, about 240–250 K). Hitters slugging .600 or more: 0–4 per league, average 2 (best .600–.660). A league with no elite-rated player has no standout that year.

Step 4: keep everything else in sync
5. [x] Re-check Milestone 1's targets: no reliever on a 3rd straight day, reliever innings and games, top starter innings, the WAR total and split, MVP and Rookie of the Year WAR. Refit the WAR settings and the contract expectation if they moved. Done when: the numbers are reported and inside Milestone 1's windows.
   **Result:** 0 appearances on a 3rd straight day; top starter 202–218 IP (the late-inning hook was tightened to hold this); WAR total 1,003–1,019, hitters 55–57%; MVPs 7.4–9.9 (average 8.6), nobody at 11; Rookies of the Year 1.9–6.2. WAR settings and the contract expectation were refitted. **Slipped a little:** the busiest reliever is at 90–107 IP (was 85–100) and the games leader at 76–88 (was 75–82), because starters now leave a little earlier.
6. [x] Update the season checks (`tools/checks.js`) with strikeout, average and extra-base-hit bands. Done when: they pass now and fail on the Milestone 1 code.
   **Result:** five league bands added. The Milestone 1 numbers (18% strikeouts, .285, 2.25 extra-base hits, best starter 22.5%) are outside four of them.
7. [x] Update DESIGN.md, ARCHITECTURE.md and README.md. Bump the Docs version. Done when: committed.

**Testing**
- [x] `node tools/simtest.js 300 medium` (unchanged at about 4.6, unless the owner approves a physics change): 4.63, unchanged
- [x] `node tools/seasontest.js` prints `all checks passed`
- [x] `node tools/franchisetest.js 2 11` prints `all checks passed` (also with `MANUAL=1`)
- [x] Browser at 1280×800 and 390×844, no console errors: a played franchise game and the leaders screen (also a postseason run-through and an exhibition game)
- [x] Owner playtest: sim a season and look at the strikeout, AVG and slugging leaders (satisfied, Nov 15, 2026)

**Open questions** (for the owner)
- *(Answered Nov 14, 2026: the targets are right; (a) accept fewer doubles for now; the change in games you play is OK. See Decisions.)*

**Risks**
- Bigger gaps between players change who wins: the best teams may win more than about 105 games.
- WAR was calibrated in Milestone 1 for a flat top; real standouts could push the best season past 12 unless the stretch is reduced.
- More strikeouts mean more pitches per inning, which moves starter and reliever innings.
- Seasons vary from run to run, so "1–2 per league" can only hold on average.
