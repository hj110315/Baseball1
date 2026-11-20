# Diamond Dash: long plan (working draft)

**Saved:** Nov 15, 2026, part-way through the planning request. **Updated:** Nov 20, 2026 (Phases 2 and 3 written). **Based on:** docs version 26.

**This is a working draft.** It is not one of the synced docs, so it needs no Docs version bump. At the final hand-off it is replaced by `docs/longplan.md` and deleted.

## Where this stopped

| Stage | State |
|---|---|
| Stage 1: read the map, interview | Done. The owner confirmed the summary. |
| Stage 2: the overview | Done. The owner said OK, then answered six open questions. |
| Stage 3: every session in detail | Phases 1–3 (S1–S35) are written and shown to the owner. Waiting for "next". |
| Final hand-off | Not started. |

**Next step:** Stage 3, Phase 4 (S36–S44). Then phases 5 to 10, one phase per reply. Phases 6, 8 and 10 have more than 15 sessions and take two replies each. Then the final hand-off message.

The owner plans to continue next week. The mind-map photo is not in the repo; section 2 below is its full transcription.

---

## How to continue (the owner's rules for this request)

The request: use the owner's hand-drawn mind map to build a long-term development plan of about 100–200 coding sessions, with every session planned in full detail. Follow the project's instructions (version check, labels, hard rules), with three exceptions:
- This plan overrides "detailed plans only for the next 1–2 milestones". It is a forecast saved in its own file, `docs/longplan.md`. `docs/plan.md` still holds only 1–2 detailed milestones.
- Use the session block below instead of the `docs/plan.md` milestone template. The template is used later, when a milestone moves into `docs/plan.md`.
- The final hand-off only records the plan. It doesn't build anything.

**Asking the owner.** Whenever context or a decision is needed, ask through `/interview-me`: one multiple-choice question at a time, and a summary to confirm after each topic. Never fill a gap with a guess.

**Definitions**
- Session = one Claude Code coding session, as much work as fits in one 5-hour usage window. Planning chats, interviews and the owner's playtests are not sessions; show them as gates.
- S1 = the first session of Milestone 3.
- Calibration: a typical milestone (2 or 2b) took 3 or more sessions. Size generously and give each estimate a confidence level.
- ★ on the map = a key feature that needs the most thought (not necessarily early).

**Stage 3 format**
- One phase per reply. Split any phase with more than about 15 sessions across two replies. Wait for the owner to say "next".
- Write each phase's sessions once, inside a single markdown code block titled "Phase N" that he can copy into `docs/longplan.md`. Put "Based on: docs version N" once at the top of the block. Don't repeat the sessions outside the block. Outside the block, only the self-check and any questions.
- Use this block for every session (about 12 lines max):
  ```
  S<#>: <milestone, step> (Phase N; "current" or "forecast")
  Goal: one sentence.
  Tasks: numbered, each with "Done when".
  Tests: which CLAUDE.md tests, plus any new check.
  Ends with: commit, merge with my OK, my playtest, or a decision.
  Needs checking / risks: one or two lines.
  ```
- Mark the first phase "current" and every later phase "forecast": it will be re-planned after playtests.

**Rules for the whole plan**
- The public release stays early. Most of the map is post-release updates. Ask the owner before moving any map item ahead of the release.
- Every session keeps the hard rules: no build step, BB namespace, works from `file://`, fictional names. It also keeps old saves working and the CLAUDE.md tests passing. If an item needs a rule change, put a decision gate before it.
- One coding session at a time. Big milestones end with one review agent. After any balance change, re-check earlier calibration (runs per game, WAR, workload, form rates, 2b targets).
- Every milestone starts by checking the plan against the code. Add a re-plan checkpoint (a planning chat, not a session) every 15–20 sessions and at each phase gate.
- Don't invent facts about the code. Label every decision as the owner's choice or Claude's default.

**Self-check, reported in 3–6 lines with every reply**
- Every fact matches the project files or what the owner said; anything else is marked "needs checking". No default is presented as the owner's choice. Nothing breaks a hard rule without a gate before it.
- Each Stage 3 reply: session numbers continue from the last reply with no gaps, and the phase's sessions match its count in the overview (if not, say why and give the new total).

**Final hand-off (after the last phase).** Write one message the owner can paste into a new Claude Code session. That session should, without building anything:
1. Create `docs/longplan.md` from the phase blocks he pastes (possibly over several messages; wait for "done").
2. Add `docs/longplan.md` to the version-tracked files: the list in CLAUDE.md (and change "those six files" to seven) and the comment under the Docs version line in `docs/plan.md`.
3. Update the Roadmap in `docs/plan.md` to the phase-level order.
4. Bump the Docs version, and remind him to add `docs/longplan.md` to the project's synced files.

Claude's default, flagged to the owner and not yet answered: add one header block to paste first (the overview table, the decisions in section 1 and the parking lot), so they live in `docs/longplan.md`.

---

## 1. Decisions from the interview (Nov 15, 2026)

All of these are the **owner's choices** unless marked as Claude's default.

### What the unclear spots on the map mean
- The note "Add Fog. CPU automation. Competition. Key Feature." covers free agency and trades, not the draft. Fog = hidden information, like fog of war.
- "CPU automation" means both: CPU teams bid, sign, extend and trade on their own, and there is an auto mode for the owner's own front office.
- Prospects follow MLB's 6-year control, 3-year arbitration and contracts (Milestone 3).
- Player development is for big-league players as well as prospects. The owner wants one development system that both he and the CPU clubs use. The specifics are open.
- "needs reconsideration" covers both "relievers overvalued" and "prospects undervalued".
- "→ RPM" belongs to Pitch Grade.
- "model MLB" belongs to Budget: the soft cap and luxury tax are modeled on MLB. "rework stealing" is its own note on Manual Play.
- "website mal." means both: Claude's site struggling while building graphics, and the game page struggling while running them.
- "Ovr." means: add a team overall rating, and rework player overall so it lines up with WAR.

### The marks
- [prioritized] = first in line after the release. The two items are the ability–performance correlation and a solution to the graphics cost.
- [to be developed] = a whole area still to be designed and built, with its own interview first.
- [to be reviewed] = not decided yet.
- [to be less prioritized] = late in the plan.
- "to be added" = will be built, no special priority.

### New features and parked ones
- Owner-manager system: parked, with a decision point after the release.
- Coaches: built together with the player development system.
- "Postseason. Rewards. Difficulties." asks for two new things: rewards for winning, and a franchise difficulty that changes the management side. No change is asked to the postseason itself.
- Team and player history: both a made-up past at league creation and history that builds up as seasons are played.
- Clutch is added as an ability for hitters and pitchers. No other ability is added or deleted. This overrides the blueprint's "Not chosen: more or finer abilities" for clutch only.
- Map: U.S. only. Korea and Japan are parked.
- Teams move to real U.S. cities with invented nicknames. This changes the fictional-names rule, so a decision point sits right before that work. Real MLB team names stay off-limits.
- Multiplayer: parked, with a decision point after the main plan.
- W2 (more postseason effects): parked.
- The PROBLEM box is about graphics only. No extra speed or save-size checks are asked for the league sim.

### Before the release
- Milestone 2b task 8 (calibration re-check, WAR and contract refit) opens S1. Task 9 (season checks, docs, README, review) is folded into Milestone 3's docs and review.
- The screen restructure covers navigation and tabs, and team management. Popups, Back and the offseason flow are not part of it (the popup problems stay on the QoL list).
- The new page look ("Design Game Pages. More aesthetic look.") is built together with the restructure, before the release, after a design interview. The shared style changes on every page; only navigation and team management get new layouts. Other screens get new layouts after the release.
- The two rare roster bugs behind the flaky `franchisetest` are fixed before the release.
- The release milestone adds a save version, an upgrade step, and Export save and Import save buttons.
- After the release: the browser test suite, the line-by-line code review, and first-time help.
- Order: Milestone 3, bug fixes, restructure with new look, QoL pass, publish. (Where the bug fixes sit is Claude's default.)

### After the release
- After the [prioritized] block the player side comes first: pitching, stat pages, the development system with coaches, then injuries. The front office follows: budgets, trades, free agency, minors, draft.
- Updates go live first and get fixed fast: finished work goes straight to the live link, the owner playtests there, and problems are fixed in the next session.
- Graphics: option B, "tools first". Claude builds small editor pages with live preview and export; the owner tunes the look by hand at no usage cost; Claude wires in what he exports. It stays 2D and changes no rule.
- The editor tools are built right after the prioritized block. The wiring stays at the end of the plan.
- Playing by hand (stealing rework, profiles in a game, balk/HBP/bunt) comes right after injuries.
- The whole batting-average spread is done in M11, with the ability rebalance.
- Kept as Claude proposed: the test suite and code review come after the prioritized block, and Teams come before Budgets.

### Not asked, because the rules already answer it (the owner agreed)
- "base on MLB & MiLB" and the Statcast / Baseball Reference study are models and outside studies. Player names stay fictional and the game never fetches data. Whether to run the "possible study" is settled at that block's own interview.

### Still unknown (each settled at its own interview, not guessed)
- "unique mechanisms" under Pitching
- the circled "long" under Injuries
- what the stealing rework changes
- "fun modes, arcade"
- where the owner saw relievers overvalued
- how budgets connect with team history and profile
- what the fog hides
- whether to run the "possible study"
- whether balk, HBP and bunt get built ("consider applying")

---

## 2. The mind map, transcribed

Labels: **Built**, **Planned** (where), **New**, **Conflicts** (with what). "(code)" means the docs don't say it and it was confirmed in the source. Corrected with the owner's answers from section 1.

**FRONT OFFICE (Financials. Moves.)**, joined to GAME SYSTEM
- Drafting. Scouting. [to be developed]
  - Drafting: **Built**, basic (5 rounds, 210 prospects) / **Planned** (W4e)
  - Scouting: **Built** in part, as draft scouting ranges (code) / **Planned** (Later list: scouting)
  - base on MLB & MiLB: a modelling note; no real names or data in the game
  - connect with minor leagues: **Planned** (W4d, W4e)
- Free Agency: **Built**, basic (4 rounds, CPU teams bid) / **Planned** (W4c)
  - Add Fog. CPU automation. Competition. Key Feature. (tied by an arrow to the line joining Trades and Free Agency): **New**
  - FA is too easy rn.: **Planned** (W4c). A free agent signs the moment an offer reaches his asking price, and a refusal tells the price that works (code)
  - Prospects (b4 first free agency): apply the 6-year MLB system, 3-year arbitration and contracts, model MLB: **Planned** (Milestone 3)
    - [scouting / player development / drafting]: **Planned** (Later: scouting; W5b; W4e)
- ★ Trades [to be developed]: **Built**, basic (the owner proposes, the CPU decides; deadline) / **Planned** (W4b)
  - Auto-system between CPU teams as well: **Built**, basic, in season and in the offseason (code) / **Planned** (W4b)
  - Player Value Calculation → needs calibration: **Built** (`BB.trades.value`) / **Planned** (M3 task 5; W4b)
    - connect with WAR: **New** (trade value doesn't use WAR today (code))
    - relievers overvalued, prospects undervalued (needs reconsideration): **New**. Trade value already cuts relievers to 60% (code), so where they look overvalued is still to ask
- Budget, with "(soft cap)" and "model MLB": **Built**, basic (3 fixed budgets by market size; a signing can't pass the budget (code)) / **Planned** (W4a)
  - multiple Luxury Tax penalties: **Planned** (W4a)
  - diversify (market size) team financial levels: **Planned** (W4a)
  - Connect with Teams. History. Profile.: **New**
- possible owner-manager system model → to be reviewed: **New**, parked
- possible coaches feature → to be reviewed: **New**, built with player development

**GAME SYSTEM**
- consider applying special rules. Balk. HBP. Bunt.: **New** (none is in the code)
- Statistics, with a line on to Player Abilities
  - age curve: **Built** / **Planned** (W5b)
  - slump, breakout: **Built** (Milestone 2)
  - overuse: **Built** in part (fatigue, rest rules, pace guard) / **Planned** (W5b)
  - Player Ability system
    - Ovr. (circled), joined to "Team" and "WAR – Player": player overall and WAR **Built**; team overall and the overall rework are **New**
    - Pitching → unique mechanisms, deep stats: **Planned** (W1)
      - Pitch Types → add brk/offspeed pitches: **Planned** (W1); 7 types **Built**
      - Pitch Grade → RPM, chase, whiff: grades **Built** (20–80 per pitch on the profile (code)); RPM is **New** (no spin in the code)
      - → rework fastball: **Planned** (W1)
    - Hitting – deep stat base. possible statcast/baseball reference study: **Planned** (W5a; Later list)
  - Player Abilities
    - con/pow/eye(discipline)/spd/arm/fld/clutch: six **Built**; clutch **New**
    - stuff/velo/control/stmna/clutch/pitches: four ratings and the pitch set **Built**; clutch **New**
    - → define. possibly add/delete: settled: add clutch only
    - → correlate. apply.: **Built** in part (1b and 2b measured what 10 rating points are worth)
    - → don't lopside importance of certain abilities: **New** as a rule. Known cases: Power moves AVG more than Contact; Control barely moves walks
    - ↓ Player Development, "CPU teams do this too.": **Built**, basic (offseason growth for all 30 teams) / **Planned** (W5b)
      - Player Development Roadmap (no certain order) → ADD COACH feature: coach **New**
        - Player Training System ★ [to be developed]: **Planned** (W5b)
        - Minor leagues → connect with DRAFT. SCOUT.: **Planned** (W4d, W4e)
        - Prospect Development ↱ prospect value: **Planned** (W5b; Later list)
        - ⊕ to be added: an open slot
      - INJURIES [to be developed]: **Built**, basic (code). More depth is **New**
        - correlation with player abilities: **New**
        - [long / short], "long" circled → tommy john.: **Built** in part
        - overuse (esp. bullpen): **Built** in part / **New**
        - (slightly rare) recurring issues. ex. back. hamstring: **New**
        - ↓ cap reliever innings through injury risk. → CPU teams consider injury risk: **New**
  - ★ [prioritized] Ability–Performance Correlation: **Built** in part / **Planned** (2b task 8)
    - ↓ ★ establish deeper stats (ex. hard hit rate. launch angle. rpm. movement. whiff%.) [to be developed] → possible study. establish clearly.: **Planned** (W5a; Later list)
- Season Simulation / Baseball Statistics: **Built**
  - realism, (outliers) star players, [to be less prioritized]: **Planned** (Later: archetypes, batting-average spread, baseball study)
  - ★ deeper statistics (notes from sabermetrics): **Planned** (W5a; Later)
    - presentation → League Simulation Mode: **Planned** (W5a)
- Manual Play (play by hand): **Built**
  - rework stealing: stealing **Built**; a rework is **New**
  - needs to view opponent player profile: **New** (no profile link in the game screen (code))
  - better fielding graphics, Player Graphics, Player Motions, Ball Graphics & Movement, Camera Placement: **Planned** (W3)
  - Stadium Graphics → Connect with Team Profile: **Planned** (W3); a stadium per team is **New**

**GAME GRAPHICS**, "to be added": **Planned** (W3)
- PROBLEM ★: too much resources need / too much data; lag, usage limits, website mal., resources wasted
- [prioritized] Issue of limits of Claude & plan. Need solution ★ until then put down for later.
- Let's work on Game Visuals outside of Manual Play. → Design Game Pages. → More aesthetic look. /interview-me: **New**

**GAME STRUCTURE**
- League Simulation Mode: **Built**
- Modes: Single **Built**; Multi (slower pace, fantasy baseball system, maybe manual play) parked
- fun modes. arcade. etc: **New**, not scheduled
- Postseason. Rewards. Difficulties.: Postseason **Built**; rewards **New**; franchise difficulty **Built** in part (the CPU's trade demands already rise with difficulty (code)) / **New**
- Game Manual: **Built**, basic / **Planned** (First-time polish)
- Logical, Concise Page configuration → [to be reviewed]: the screen restructure
- League/Team Configuration, Team Selection Page: **Built**
  - → Map Based Visuals (U.S./KR/JP) ↓ focus on U.S. model MLB: **New**
  - ⇊ establish Teams. PROFILE. Logos. History. Financials. Vary much.: team page **Built**, basic; logos and team history **New**; financials **Planned** (W4a)
    - History ↘ consider player history: **New**

Marks counted: ★ ×7 (Trades; Ability–Performance Correlation; establish deeper stats; deeper statistics; Player Training System; PROBLEM; Need solution), [prioritized] ×2, [to be developed] ×5, [to be reviewed] ×2, [to be less prioritized] ×1, "to be added" ×2.

---

## 3. The overview (as agreed, with the six answers applied)

- **Total: about 139 coding sessions**, likely range 120–165. Adding every low and every high estimate gives 109–185.
- **10 phases.** Phase 1 is current; the rest are forecasts.
- **The public release lands after S17** (range S12–S23).
- Gates are not sessions: planning chats, interviews, playtests, publishing. A re-plan checkpoint sits at every phase gate, plus one after S64 and one before M33.
- After the release, each milestone is merged to `main` with the owner's OK and is live at once. The owner playtests the live page; fixes open the next session.

### Phases

| Phase | Sessions | Milestones | Goal | Gates |
|---|---|---|---|---|
| 1. Team control (current) | S1–S5 (5) | M3 | Control, arbitration and extensions on a re-checked WAR scale | Owner playtest; merge with his OK |
| 2. Road to the release | S6–S17 (12) | M4–M7 | A game ready for friends | Design interview before M5; the owner picks the look inside M5; he closes the QoL list before M6; release playtest, then the public release |
| 3. First update and the prioritized block | S18–S35 (18) | M8–M12 | First-time help, a proven answer to the graphics cost, abilities that each matter the right amount | Commit-or-switch decision after M9; interview before M10; target tables approved in M10, M11 and M12 |
| 4. Tools and safety net | S36–S44 (9) | M13–M15 | Graphics editor tools, browser checks for every screen, reviewed logic | None beyond playtests |
| 5. Pitching and stats | S45–S55 (11) | M16, M17 | A deeper pitching model and clear stat pages | Interview before each |
| 6. Development, injuries and playing by hand | S56–S75 (20) | M18–M20 | One development system, real injuries, better games by hand | Interview before each; decision on balk, HBP and bunt before M20; checkpoint after S64 |
| 7. Teams and money | S76–S89 (14) | M21–M23 | Real cities, map, logos, history, revenue budgets and luxury tax | Decision on the fictional-names rule before M21; interviews |
| 8. Trades and free agency | S90–S106 (17) | M24–M26 | Hidden information, competing CPU teams, deep trading, hard free agency | Interviews; targets approved in M25 and M26 |
| 9. Minors, draft and scouting | S107–S120 (14) | M27, M28 | AAA with games, lower levels, deeper draft, scouting | Interview before each |
| 10. Structure, realism and graphics wiring | S121–S139 (19) | M29–M33 | Franchise difficulty, rewards, remaining layouts, archetypes, the new graphics | Archetype list approved in M32; checkpoint before M33; final playtest; parking-lot decisions |

### Milestones in build order

"Yours" is the owner's choice; "mine" is Claude's default. Sessions show the estimate, the range and Claude's confidence.

| # | Milestone | Goal | From the map | After | Sessions | S-numbers | Choice |
|---|---|---|---|---|---|---|---|
| M3 | Team control | Control, arbitration, extensions; opens with 2b task 8 | Prospects: 6-year system | none | 5 (4–6) medium | S1–S5 | Yours |
| M4 | Repeatable tests, roster bugs | Same test result every run; two rare bugs fixed | not on the map | M3 | 2 (1–3) low | S6–S7 | Yours; place mine |
| M5 | New look and restructure | Shared style everywhere; new navigation and team management | Page configuration; Design Game Pages | M4 | 6 (5–8) low | S8–S13 | Yours |
| M6 | QoL pass | The QoL list fixed in one pass | QoL list | M5 | 2 (1–3) medium | S14–S15 | Yours |
| M7 | Release | Save version, upgrade step, backup buttons; live on GitHub Pages | project goal | M6 | 2 (1–3) medium | S16–S17 | Yours |
| M8 | First update | First-time help; fixes from friends' feedback | Game Manual | release | 2 (2–3) medium | S18–S19 | Yours; fixes mine |
| M9 | Graphics cost proof | The first editor tool and one slice built with it, cost and phone speed measured | PROBLEM; Need solution | option B picked | 2 (1–3) low | S20–S21 | Yours; method mine |
| M10 | Ability study, deeper stats | Measure each ability; track batted-ball and swing data | Ability–Performance; deeper stats; study | M8 | 3 (3–4) medium | S22–S24 | Yours |
| M11 | Ability rebalance, batting spread, clutch | No ability counts too much or too little; the 2b batting targets; clutch added | Player Abilities; clutch | M10 | 7 (6–9) low | S25–S31 | Yours |
| M12 | Overall rework | Player overall lines up with WAR; team overall | Ovr.; WAR; Player Value | M11 | 4 (3–5) low | S32–S35 | Yours |
| M13 | Graphics editor tools | Look, stadium and camera editors with export | Game Graphics | M9 | 4 (3–5) low | S36–S39 | Yours |
| M14 | Browser test suite | Every screen checked at both sizes | not on the map | M5 | 2 (2–3) medium | S40–S41 | Yours |
| M15 | Code review | Helper-written logic read line by line | not on the map | M14 | 3 (3–4) medium | S42–S44 | Yours |
| M16 | Pitching | New pitches, reworked fastball, grades with spin, chase, whiff | Pitching; Pitch Types; Pitch Grade | M11, M12 | 7 (6–9) low | S45–S51 | Yours |
| M17 | Stat pages | Clear pages with rate, advanced and batted-ball stats | deeper statistics; presentation | M10, M16 | 4 (3–5) medium | S52–S55 | Yours |
| M18 | Development system | One growth model, training, coaches, all players and clubs | Player Development; Training ★; COACH | M12 | 9 (7–11) low | S56–S64 | Yours |
| M19 | Injuries | Long and short injuries, overuse, recurrences, CPU risk | INJURIES | M18 | 5 (4–6) low | S65–S69 | Yours |
| M20 | Playing by hand | Stealing rework, profiles in a game, special rules if approved | Manual Play; special rules | M19; decision | 6 (4–8) low | S70–S75 | Yours |
| M21 | Teams | Real U.S. cities, map picker, logos, profiles | Team Selection; Map; establish Teams | rule decision | 5 (4–7) low | S76–S80 | Yours |
| M22 | History | A made-up past; history that builds up | History; player history | M21 | 4 (3–5) medium | S81–S84 | Yours; place mine |
| M23 | Budgets | Revenue budgets, wider markets, luxury tax, Finances screen | Budget; soft cap; Luxury Tax | M3, M12, M21 | 5 (4–7) low | S85–S89 | Yours |
| M24 | Fog | Other clubs' players seen as ranges | Add Fog | M23 | 3 (3–5) low | S90–S92 | Yours; split mine |
| M25 | Trades ★ | WAR-based values, CPU offers and strategies, picks, cash | Trades; Auto-system; Player Value | M12, M18, M23, M24 | 8 (6–10) low | S93–S100 | Yours |
| M26 | Free agency | Bidding wars, preferences, CPU competition, auto front office | Free Agency; CPU automation | M23, M24 | 6 (5–8) low | S101–S106 | Yours |
| M27 | Minor leagues | AAA with games and development; lower levels as rosters | Minor leagues; Prospect Development | M18, M23 | 8 (6–11) low | S107–S114 | Yours |
| M28 | Draft and scouting | Bonuses, more rounds, rankings, scouting accuracy | Drafting; Scouting | M24, M27 | 6 (5–8) low | S115–S120 | Yours |
| M29 | Franchise difficulty | Difficulty that changes the management side | Difficulties | M23–M28 | 2 (2–3) medium | S121–S122 | Yours; place mine |
| M30 | Rewards | Trophies and achievements | Rewards | M22 | 3 (2–4) low | S123–S125 | Yours; place mine |
| M31 | Remaining layouts | New layouts for screens not yet redesigned | Design Game Pages | M5 | 3 (2–4) medium | S126–S128 | Yours; place mine |
| M32 | Realism | 25 archetypes, star outliers, baseball study | realism; outliers | M11, M12, M18 | 4 (3–6) low | S129–S132 | Yours |
| M33 | Graphics wiring | Fielding, players, motion, ball, cameras, stadiums | Game Graphics; Manual Play graphics | M13, M20, M21 | 7 (5–9) low | S133–S139 | Yours |

Soft spot in the order: M25 trades picks and minor-leaguers before M27 and M28 deepen them, so it works on today's 5-round draft and reserves.

### Graphics: the three options shown, and the pick
- **A: sharper 2D in small slices.** Claude does all of it, one slice per session against an approved checklist. About 16 sessions. No rule change.
- **B: tools first, the owner tunes. Picked.** Editor pages for poses and motion, player and stadium look, and cameras, each with live preview and export. About 11 sessions plus the owner's time. No rule change.
- **C: low-poly 3D with a vendored library (the blueprint's W3).** About 30 sessions, the biggest phone risk, and rule decisions first. Needs checking: whether a current 3D library still loads as a plain script from disk.

M9 proves option B first: one small slice built that way, with the usage it took and the frame rate on the owner's phone written down. Then he commits or switches.

### Parking lot

| Not scheduled | Why |
|---|---|
| Owner-manager system | Owner's choice. Raise it at the checkpoint after budgets (M23) |
| Multiplayer | Owner's choice. Needs a hosted service, which is a rule change |
| Korea and Japan | Owner's choice |
| W2 more postseason effects | Owner's choice |
| Fun modes, arcade | Claude's default: no detail yet, needs its own interview |
| Levels of hot and cold | Claude's default: on the Later list, not on the map |
| App version | On the Later list, as before |
| "+ to be added" (development roadmap) | An open slot with no work in it |

---

## 4. Phase blocks written so far

````markdown
# Phase 1: Team control (S1–S5, 5 sessions, current)
Based on: docs version 26
Milestone: M3, team control, arbitration and extensions. Its plan is in docs/plan.md (written against docs version 19).
Owner's choices (Nov 15, 2026): Milestone 2b task 8 opens S1; 2b task 9 is folded into M3's docs and review.
Every session: keep the hard rules, keep old saves loading, commit and push after each task, keep "Stopped at" in docs/plan.md current, and bump the Docs version in any commit that changes a synced doc.

S1: M3, owed calibration re-check and plan check (Phase 1; current)
Goal: Put WAR and the contract expectation on the post-2b balance, and settle Milestone 3's plan against the code.
Tasks:
1. Compare the plan's "Based on" (19) with the current docs version and list any stale line. Done when: reported to the owner.
2. 2b task 8: measure 12 seasons (node tools/measure.js 2 11,12,13, run twice) for bullpen workload, WAR, the 1b standouts and the form rates. Done when: a table shows each number against its window in DESIGN.md.
3. Refit the WAR settings (WAR in depth.js) and expectedWar (offseason.js) if they moved. Done when: over 6 or more seasons the WAR total is about 1,000 (900–1,100), hitters about 57%, MVPs about 8–10.
4. M3 task 1: check draftee and generated contracts, the veterans' history, the minimum salary, the asking price, re-signing and free agency, dead money, trade values, and today's rule that players 24 or under are renewed automatically. Done when: the report is sent and every mismatch is settled.
Tests: simtest 300 medium (4.3–4.6; 4.48 after 2b), seasontest, franchisetest 2 11 (re-run once on a failure: known flaky), measure.
Ends with: commit and a report. The owner decides any mismatch before S2.
Needs checking / risks: starters at 28% K averaged 2.2 per league against a 1–2 target. A WAR refit can change award results and contract asks.

S2: M3, service time and control in the offseason (Phase 1; current)
Goal: Every player has service time, and the offseason handles pre-arbitration, arbitration and minor-league free agency by the new rules.
Tasks:
1. M3 task 2: a service-time field that builds by the day on the active roster or big-league injured list (not spring or postseason; reserves and prospects gain none). Done when: franchisetest checks that a full season on the active roster is 1 year and reserves gain none.
2. Estimates for existing players and old saves, from career records and age. Done when: oldsavetest loads a pre-M3 save with estimates and plays on, and a printed spread shows no rush of players reaching free agency in one winter.
3. M3 task 3: renewals at the minimum salary, automatic arbitration salaries (about 40% / 60% / 80% of free-agent value), tender or non-tender, re-signing only at 6 or more years, replacing the age-24 renewal rule. Done when: franchisetest prints arbitration cases and non-tenders per season, and checks that nobody under 6 years reaches free agency except by non-tender, release or minor-league free agency.
4. Minor-league free agency after 7 seasons in the organization. Done when: an 8-season run prints minor-league free agents.
Tests: seasontest, franchisetest 2 11 (also MANUAL=1), an 8-season franchisetest run, oldsavetest. simtest should not move (no physics change).
Ends with: commit.
Needs checking / risks: how to count "seasons in the organization" for players who already exist. Cheap young players lower payrolls.

S3: M3, extensions, CPU behavior and trade values (Phase 1; current)
Goal: Extensions work for the owner and the CPU, and trade values count years of control.
Tasks:
1. M3 task 4: an extension offer-and-accept function for any player on the owner's team until he reaches free agency. Done when: a Node test shows acceptance at the asking price, refusal below it, and a lower ask from a controlled player than from a free agent.
2. CPU teams extend selectively and non-tender weak arbitration players. Done when: tests show some CPU extensions every season.
3. M3 task 5: trade values count years of control and the cheap salary, replacing today's bonus for players 25 or under. Done when: a test values a cheap controlled player above a same-rated player on an expiring deal.
4. Measure 8 seasons before and after: total payrolls, free-agent pool size, arbitration salaries. Done when: the numbers are in the report, with a warning to the owner if payrolls fall sharply or free agency empties.
Tests: seasontest, franchisetest 2 11 (also MANUAL=1), the 8-season run.
Ends with: commit and a report on payrolls and the free-agent pool.
Needs checking / risks: CPU extensions could empty free agency. Big breakouts raise arbitration salaries. Dead money and the CPU spending cap interact with cheaper rosters.

S4: M3, screens (Phase 1; current)
Goal: The owner can see service time and status, offer an extension at any time, and tender or non-tender in the offseason.
Tasks:
1. M3 task 6: the profile shows service time and status (pre-arbitration, arbitration year 1–3, free agent after 6 years) and an "Offer extension" button with its offer popup. Done when: it works at 1280×800 and 390×844 with no overflow and no console errors.
2. M3 task 7: a tender or non-tender screen inside the re-signing step, showing each arbitration salary. Done when: a click-through from the end of the postseason to Opening Day works with real buttons.
3. A new browser check, tools/e2e/control-check.js, for the profile status, the extension offer and the tender screen at both sizes from file://. Done when: it passes.
Tests: control-check.js, form-check.js, play-check.js, plus seasontest and franchisetest 2 11.
Ends with: commit.
Needs checking / risks: the known popup problems (Escape closes every popup; an offer popup can stay open) must not get worse; M6 fixes them. These screens are restyled in M5.

S5: M3, docs, owed 2b task 9, review and hand-over (Phase 1; current)
Goal: Close Milestone 3 and Milestone 2b's owed work, reviewed and documented, ready for the owner's playtest.
Tasks:
1. 2b task 9: final bands in tools/checks.js; the re-check results in DESIGN.md; README.md's simtest numbers (still from before 2b). Done when: committed.
2. M3 task 8: DESIGN.md (team control section), ARCHITECTURE.md (player fields, new functions), README.md, docs/plan.md status, Docs version bump. Done when: committed, and the owner is reminded to click Sync now.
3. One independent review agent on the whole M3 diff and the WAR refit. Done when: every finding is fixed or reported.
4. Full test pass, including oldsavetest on a pre-M3 save. Done when: all pass, or a flaky failure is re-run and explained.
Tests: simtest, seasontest, franchisetest 2 11 (also MANUAL=1), the 8-season run, oldsavetest, all three browser checks.
Ends with: merge to main with the owner's OK, then the owner's playtest.
Needs checking / risks: review findings could need a sixth session (range 4–6).

GATE after S5 (not sessions): the owner's playtest (sim 2–3 seasons, check young players' status, tender or non-tender someone, offer an extension during the season). Then a re-plan checkpoint in a planning chat.
````

````markdown
# Phase 2: Road to the release (S6–S17, 12 sessions, forecast)
Based on: docs version 26
Milestones: M4 repeatable tests and roster bugs (S6–S7), M5 new look and restructure (S8–S13), M6 QoL pass (S14–S15), M7 release (S16–S17).
Owner's choices (Nov 15, 2026): order M3, bug fixes, restructure with new look, QoL pass, publish; the look is built with the restructure after a design interview; only navigation and team management get new layouts; popups and Back stay on the QoL list. Where the bug fixes sit is Claude's default.
Every session: keep the hard rules, keep old saves loading, commit and push after each task, keep "Stopped at" in docs/plan.md current, bump the Docs version in any commit that changes a synced doc. Each milestone opens with a plan check against the code.

S6: M4, seeded randomness and the bug hunt (Phase 2; forecast)
Goal: franchisetest gives the same result on identical runs, and the two rare roster bugs are caught on a known seed.
Tasks:
1. Plan check: M4 against the Known gaps in docs/plan.md and the post-M3 code. Done when: reported.
2. Route one seeded rng from the league into the unseeded calls (form.js, season.js springDays/regularDays, engine.js and depth.js defaults) when a test sets a seed; the browser game stays random. Done when: two runs of franchisetest 2 11 print identical output.
3. Run 200+ seeds and record every failing seed and day. Done when: a table lists each failure with its seed.
Tests: simtest 300 medium (should not move), seasontest, franchisetest 2 11, oldsavetest.
Ends with: commit and a report of the failing seeds.
Needs checking / risks: whether the bugs still appear once randomness is seeded; a missed Math.random call.

S7: M4, fix the roster bugs, invariants, docs (Phase 2; forecast)
Goal: The two roster bugs are fixed and guarded, and franchisetest passes every run.
Tasks:
1. Fix "a CPU team starts spring with a lineup of 8" and "a free agent is also on a roster", using S6's seeds. Done when: those seeds pass.
2. Daily invariants in franchisetest (9 healthy roster players in each lineup; no player both free agent and rostered). Done when: they fail on the old code's seed and pass now.
3. Report the other flaky checks (lasting-changes rate, "CPU refuses junk"); any band change only with the owner's OK. Done when: settled.
4. 100+ runs over many seeds; Known gaps, ARCHITECTURE.md "Testing", Docs version bump. Done when: 100 clean runs, committed.
Tests: all Node tests, the 100-run loop, MANUAL=1, form-check.js and play-check.js.
Ends with: merge to main with the owner's OK.
Needs checking / risks: a fix in roster code can shift workload or WAR; re-check them.

GATE before S8 (not a session): the design interview (look, mood, colors, navigation wishes, phone first or desktop first).

S8: M5, plan check, inventory and style samples (Phase 2; forecast)
Goal: The owner picks a look and approves a navigation map.
Tasks:
1. Plan check and an inventory of every screen and popup in js/ui/ and the css files. Done when: the list is in the report.
2. A proposed navigation map (top tabs, sub-tabs, League hub, where each screen lives, where Back goes). Done when: sent to the owner.
3. 2–3 style samples as static pages that open from file:// (home, roster and a table each), at both sizes. Done when: screenshots and pages are sent.
Tests: none beyond opening the samples; no game code changes.
Ends with: a decision: the owner picks a sample and approves (or changes) the map.
Needs checking / risks: the sample pages are throwaway; agree where they live before committing them.

S9: M5, the shared style (Phase 2; forecast)
Goal: Every page uses the picked look: colors, type, buttons, cards, tables, forms.
Tasks:
1. Style tokens (colors, spacing, type) in one place in css/, the old values replaced. Done when: no screen keeps an old color or font by mistake.
2. Every screen and popup checked at 1280×800 and 390×844. Done when: screenshots show no overflow and no console errors.
Tests: form-check.js, play-check.js, control-check.js; seasontest (no logic change expected).
Ends with: commit and screenshots for the owner.
Needs checking / risks: the game views draw on canvas with their own colors; leave them alone unless the owner asks.

S10: M5, navigation and tabs (Phase 2; forecast)
Goal: The approved navigation map is built, and Back works the same everywhere.
Tasks:
1. Top tabs, sub-tabs and the League hub per the map. Done when: every screen is reachable in the planned number of clicks at both sizes.
2. Back follows the map on every screen (popups excepted: M6). Done when: a scripted walk visits every screen and returns home with Back.
Tests: a new tools/e2e/nav-check.js at both sizes from file://, plus the three existing browser checks.
Ends with: commit.
Needs checking / risks: offseason steps must keep their own flow (not part of the restructure).

S11: M5, team management layouts, part 1 (Phase 2; forecast)
Goal: New layouts for Roster, Lineup and Pitching, on desktop and phone.
Tasks:
1. Roster: key facts (status, contract, service time, form) findable at a glance. Done when: checked at both sizes.
2. Lineup and Pitching: editing works by tap and by mouse. Done when: lineup and rotation changes save and show in the next game.
Tests: nav-check.js, play-check.js, seasontest.
Ends with: commit and screenshots.
Needs checking / risks: "some information is hard to find" (QoL list) is judged by the owner, not by Claude.

S12: M5, team management layouts, part 2 (Phase 2; forecast)
Goal: New layouts for Moves, Stats and Payroll, with M3's control and extension items in place.
Tasks:
1. Moves and Stats. Done when: checked at both sizes.
2. Payroll with service time, arbitration years and the extension button. Done when: control-check.js passes on the new layout.
Tests: control-check.js, nav-check.js, play-check.js, franchisetest 2 11.
Ends with: commit and screenshots.
Needs checking / risks: wide stat tables on a phone.

S13: M5, browser checks, polish, review (Phase 2; forecast)
Goal: Close M5 tested, reviewed and documented.
Tasks:
1. Polish from the owner's notes on S9–S12 screenshots. Done when: each note is fixed or answered.
2. Browser checks updated to the new structure. Done when: all four pass at both sizes from file://.
3. One review agent on the M5 diff. Done when: every finding is fixed or reported.
4. DESIGN.md (look, navigation), ARCHITECTURE.md (ui files), README.md, Docs version bump. Done when: committed; Sync now reminder.
Tests: all Node tests and all browser checks.
Ends with: merge to main with the owner's OK, then the owner's playtest of the new look.
Needs checking / risks: polish can spill into a seventh session (range 5–8).

GATE before S14 (not a session): the owner closes the QoL list, including the new team-management options still to describe.

S14: M6, popups and Back (Phase 2; forecast)
Goal: Popups stack and close one at a time, and never outlive their screen.
Tasks:
1. One popup stack: Escape and Back close the top popup only. Done when: a test opens two popups and closes them in order.
2. Popups close when the screen changes underneath them. Done when: the offer popup case is fixed and tested.
Tests: a new tools/e2e/popup-check.js at both sizes, plus nav-check.js and control-check.js.
Ends with: commit.
Needs checking / risks: popups opened from game screens (box score, profile) have their own close paths.

S15: M6, the rest of the QoL list (Phase 2; forecast)
Goal: Every QoL item is fixed or answered.
Tasks:
1. The new team-management options the owner described. Done when: each works at both sizes.
2. The other items from the closed list. Done when: each is ticked in docs/plan.md.
3. Docs and Docs version bump. Done when: committed; Sync now reminder.
Tests: all Node tests and all browser checks.
Ends with: merge to main with the owner's OK.
Needs checking / risks: the size is unknown until the list is closed (range 1–3).

S16: M7, save version, upgrade step, backups (Phase 2; forecast)
Goal: Saves carry a version, old saves upgrade on load, and the owner can export and import a save.
Tasks:
1. A save version on the league and one upgrade step on load (db.js), covering the M3 fields. Done when: oldsavetest loads saves from before M2 and before M3 and plays on.
2. Export save (downloads a JSON file) and Import save (file picker, checked, asks before overwriting). Done when: a browser check exports, clears, imports and plays a day, from file:// and from a local server.
3. A bad or newer-version file is refused with a plain message. Done when: tested.
Tests: oldsavetest, a new tools/e2e/save-check.js, all Node tests.
Ends with: commit.
Needs checking / risks: download and file reading from file:// on phones; a large save's export time.

S17: M7, publish (Phase 2; forecast)
Goal: The game is live on GitHub Pages and checked there.
Tasks:
1. A version label in the game and a "Play online" link in README.md. Done when: committed.
2. GitHub Pages switched on for main (the owner may have to do it in the repo settings: needs checking). Done when: the live link opens.
3. A full test pass on the live page at both sizes, and on the owner's phone. Done when: no console errors.
4. A release tag; stale branches deleted with the owner's OK; docs and Docs version bump. Done when: committed; Sync now reminder.
Tests: all Node tests; all browser checks against the live URL.
Ends with: the owner's release playtest, then the release (friends get the link).
Needs checking / risks: once Pages serves main, every merge goes live (the owner's choice for after the release). Keep report/pitch-test (needed in M16).

GATE after S17 (not sessions): the release playtest, the public release, then a re-plan checkpoint in a planning chat.
````

````markdown
# Phase 3, part 1: First update and the prioritized block (S18–S24 of S18–S35, forecast)
Based on: docs version 26
Milestones in this part: M8 first update (S18–S19), M9 graphics cost proof (S20–S21), M10 ability study and deeper stats (S22–S24). Part 2 holds M11 and M12 (S25–S35).
Owner's choices (Nov 15, 2026): after the release, first-time help comes first; the [prioritized] block is the ability–performance correlation and a solution to the graphics cost; graphics use option B, "tools first", proven in M9 before committing; updates go live on merge and fixes open the next session.
Every session: keep the hard rules, keep old saves loading (through M7's upgrade step), commit and push after each task, keep "Stopped at" in docs/plan.md current, bump the Docs version in any commit that changes a synced doc. Each milestone opens with a plan check against the code. Merges to main go live at once.

GATE before S18 (not a session): a short interview on friends' first feedback (the owner gathers it) and what first-time help should cover.

S18: M8, feedback fixes and how to play (Phase 3; forecast)
Goal: Fix what friends hit first, and rewrite how to play for the new navigation.
Tasks:
1. Plan check, and a list of the feedback items with a size for each. Done when: the owner confirms which to fix now and which go to the backlog.
2. Fix the confirmed items. Done when: each has a test or a checked screenshot at both sizes.
3. Rewrite the "How to play" section (today a details block in index.html) for the M5 navigation. Done when: every screen it names exists under that name.
Tests: all Node tests and all browser checks.
Ends with: merge to main with the owner's OK (goes live).
Needs checking / risks: the size depends on the feedback (range 2–3 for M8).

S19: M8, first-run guide and glossary (Phase 3; forecast)
Goal: A new player knows where to start, and every stat and term has a plain definition.
Tasks:
1. A first-run guide (a few short steps over Home and team management) that can be skipped and replayed. Done when: it shows once on a fresh save and never blocks a screen at 390×844.
2. A glossary (ratings, stats, form, service time, arbitration) reachable from help. Done when: every term on the profile and stats screens has an entry.
3. DESIGN.md, README.md, Docs version bump. Done when: committed; Sync now reminder.
Tests: a new tools/e2e/help-check.js (fresh save, guide, skip, glossary) at both sizes; all browser checks.
Ends with: merge to main with the owner's OK, then the owner's look at the guide.
Needs checking / risks: where the "seen the guide" flag is kept (settings in storage.js, not the league save: Claude's default).

S20: M9, the pose and motion editor (Phase 3; forecast)
Goal: The owner can change a motion by hand with live preview, at no usage cost, and export it.
Tasks:
1. Plan check: the rig's data (body types, stances, the windup parameter sets in rig.js, keyframed poses) and tools/poses.html, the existing read-only pose sheet. Done when: the editable set is listed for the owner.
2. tools/editor/motion.html: pick a motion, scrub time, drag or slide the channels, see the rig move, from file://. Done when: the owner can open it from disk and change a windup.
3. Export as a small .js data file the game loads with a script tag (no fetching), and the rig reads it over its built-in values. Done when: an edited windup shows in a game with no other code change.
Tests: a Node test that the exported file loads and keeps every channel in range; play-check.js; simtest (no physics change).
Ends with: commit and a short how-to for the owner.
Needs checking / risks: the windup timing ties into the pitch release; an edit must not change when the ball leaves the hand in play.

S21: M9, one slice wired in and measured (Phase 3; forecast)
Goal: Prove option B on one slice and write down what it cost.
Tasks:
1. Load the motion file the owner exported with the editor between sessions (his time sits outside the plan: owner's choice, Nov 20, 2026). Done when: the file loads and passes the S20 range test.
2. Claude wires it in, checks both views, and fixes anything the editor can't express. Done when: play-check.js passes and the owner approves the look.
3. Write down this session's usage, the editor sessions' usage, and the frame rate on the owner's phone before and after. Done when: the numbers are in docs/plan.md.
Tests: play-check.js, form-check.js, simtest.
Ends with: a decision: commit to option B (M13 next in its slot) or switch to option A or C, at a re-plan checkpoint.
Needs checking / risks: how to read the phone frame rate (a small on-screen counter behind a setting: Claude's default).

GATE before S22 (not a session): the interview on clutch, the deeper-stats list, whether to run the "possible study", and where the owner saw relievers overvalued.

S22: M10, plan check, ability measures and targets (Phase 3; forecast)
Goal: Know what every rating is worth today, and agree what each should be worth.
Tasks:
1. Plan check. Done when: reported.
2. Extend tools/measure.js from seven fitted ratings (Stuff, Velocity, Control, Contact, Power, Speed, Eye) to all ten (add Arm, Fielding, Stamina), each against its outcomes and against WAR. Done when: one table shows "10 points are worth" for every rating.
3. The study, if the owner chose it: published league-wide rates written down as targets, with no data in the game. Done when: the sources are listed.
4. Proposed target table for M11. Done when: the owner approves it (gate).
Tests: measure.js on 12 seasons (2 x 6 seeds), seasontest.
Ends with: a decision: the approved targets.
Needs checking / risks: Fielding and Arm may need new measures (runs saved), since WAR's fielding part may not track them closely.

S23: M10, batted-ball and swing data (Phase 3; forecast)
Goal: Every player-season keeps exit speed, launch angle, hard-hit, swing, whiff and chase.
Tasks:
1. Count them where the sim already produces them (sim.js returns exit speed and angle per ball in play). Done when: a season's league totals look sane against the 2b numbers.
2. Store season totals compactly on the player's stat line; old saves read as missing, not zero. Done when: the save grows less than an agreed amount (measured), and oldsavetest passes.
Tests: seasontest, franchisetest 2 11, oldsavetest, simtest (should not move).
Ends with: commit.
Needs checking / risks: played games and simmed games must count the same way.

S24: M10, the new stats on profiles (Phase 3; forecast)
Goal: The owner sees the new numbers simply, and M10 is closed.
Tasks:
1. A short batted-ball and swing line on the profile, hitters and pitchers, with glossary entries. Done when: checked at both sizes.
2. DESIGN.md (the measures and targets), ARCHITECTURE.md (stat fields), Docs version bump. Done when: committed; Sync now reminder.
Tests: all Node tests, form-check.js, help-check.js.
Ends with: merge to main with the owner's OK.
Needs checking / risks: full stat pages wait for M17; keep this to one line per player.
````

````markdown
# Phase 3, part 2: First update and the prioritized block (S25–S35 of S18–S35, forecast)
Based on: docs version 26
Milestones in this part: M11 ability rebalance, batting spread and clutch (S25–S31), M12 overall rework (S32–S35).
Owner's choices: no ability counts too much or too little (the map's "don't lopside"); Contact comes before Power for batting average; the 2b batting targets (league AVG about .260 with a wider spread, 5–10 .300 hitters per league, batting champion about .330–.350, regulars under .240 outnumber .300 hitters); the whole batting-average spread is done in M11; clutch is added for hitters and pitchers and no other ability is added or removed; player overall lines up with WAR, and a team overall is added.
Every session: keep the hard rules, keep old saves loading (through M7's upgrade step), commit and push after each task, keep "Stopped at" in docs/plan.md current, bump the Docs version in any commit that changes a synced doc. After each balance change, re-check runs per game (4.3–4.6), strikeouts about 21%, doubles, workload and WAR. Merges to main go live at once.

S25: M11, plan check, Control and walks (Phase 3; forecast)
Goal: Control moves walks by the amount M10's approved table asks, with Eye on the hitter's side.
Tasks:
1. Plan check against M10's targets and the code. Done when: reported.
2. Change how Control and Eye set balls and strikes, in the shared physics (every game type). Done when: measure.js shows the target walk spread for Control and Eye, league walk rate in its window.
Tests: simtest 300 medium, measure.js 2 11,12,13, seasontest.
Ends with: commit and a before/after table.
Needs checking / risks: more strikes in the zone can raise hits and runs; strikeouts must stay near 21%.

S26: M11, Contact ahead of Power, hitters' strikeouts (Phase 3; forecast)
Goal: Contact moves batting average more than Power, and hitters' strikeout rates spread by Contact.
Tasks:
1. Rework how Contact and Power set contact quality and hits on balls in play. Done when: measure.js shows Contact's AVG effect above Power's (today it is the reverse).
2. Hitters' strikeout rate spread by Contact and Eye. Done when: it meets the approved spread.
Tests: simtest, measure.js 12 seasons, seasontest.
Ends with: commit and a before/after table.
Needs checking / risks: Power must keep home runs and slugging in their windows.

S27: M11, the batting-average spread (Phase 3; forecast)
Goal: Meet Milestone 2b's batting targets.
Tasks:
1. Tune the spread (rating spread in generation and the physics from S26) to the targets listed above. Done when: over 12 seasons, 5–10 .300 hitters per league, the champion about .330–.350, and regulars under .240 outnumber .300 hitters.
2. Check the effect of form on the spread (FORM=0 against form on). Done when: reported.
Tests: simtest, measure.js 12 seasons, seasontest, franchisetest 2 11.
Ends with: commit and a report; the owner may move the league AVG target if needed (his earlier choice).
Needs checking / risks: changing the generated rating spread changes existing saves only slowly; existing players keep their ratings.

S28: M11, Speed, Fielding, Arm and Stamina (Phase 3; forecast)
Goal: The other ratings each count by the approved amount.
Tasks:
1. Measure each against M10's targets. Done when: a table shows each against its target.
2. Fix any that are lopsided, one at a time. Done when: each is in its window, or the owner accepts it.
Tests: simtest, measure.js 12 seasons, seasontest, franchisetest 2 11.
Ends with: commit and a table.
Needs checking / risks: Stamina feeds workload; re-check Milestone 1's bullpen windows.

S29: M11, clutch as a rating (Phase 3; forecast)
Goal: Hitters and pitchers have a clutch rating that matters a little in high-pressure spots.
Tasks:
1. A pressure measure for each plate appearance (inning, score, runners), since the game has none today (relievers are weighted only by saves). Done when: a test shows late, close spots score highest.
2. Clutch: generated for new players, estimated for existing ones and old saves, changed by growth, with a small effect in pressure spots. Done when: measure.js shows the effect in its approved window, and oldsavetest passes.
Tests: simtest, seasontest, franchisetest 2 11, oldsavetest.
Ends with: commit.
Needs checking / risks: the size of the effect (the interview decides it); a hidden or shown rating is the owner's call at the M10 interview.

S30: M11, clutch on the screens, CPU use, tuning (Phase 3; forecast)
Goal: The owner sees clutch, and the CPU uses it.
Tasks:
1. Clutch on the profile and in lineup and bullpen views; a glossary entry. Done when: checked at both sizes.
2. CPU managers use it a little for closers and late pinch hitters. Done when: a test shows a higher-clutch closer chosen when other ratings are equal.
3. Tune from a 12-season run. Done when: calibration windows still hold.
Tests: form-check.js, play-check.js, seasontest, measure.js.
Ends with: commit.
Needs checking / risks: clutch must not slip into the overall before M12 decides it.

S31: M11, full calibration re-check and review (Phase 3; forecast)
Goal: Close M11 with every earlier window re-checked.
Tasks:
1. Re-check Milestone 1, 1b, 2 and 2b windows (runs, strikeouts, doubles, home runs, workload, WAR, standouts, form rates). Done when: one table, every number in its window or reported.
2. New bands in tools/checks.js. Done when: seasontest and franchisetest print all checks passed.
3. One review agent on the M11 diff; DESIGN.md, ARCHITECTURE.md, README.md, Docs version bump. Done when: committed; Sync now reminder.
Tests: all Node tests (franchisetest also MANUAL=1), all browser checks.
Ends with: merge to main with the owner's OK, then the owner's playtest of the new balance.
Needs checking / risks: M11 is the riskiest milestone in the phase (7 sessions, range 6–9, low confidence).

S32: M12, plan check and overall weights from WAR (Phase 3; forecast)
Goal: A proposed overall that tracks WAR by position and role.
Tasks:
1. Plan check. Today the overall is a weighted sum of ratings per position (WEIGHTS in league.js), used across depth, offseason, trades and screens. Done when: every use is listed.
2. Fit weights to WAR per 600 plate appearances or per role's innings, by position and SP/RP, over 12 seasons. Done when: a table shows how well old and new overalls predict WAR.
3. A proposal: the weights, the scale (20–99 stays) and potential on the same scale. Done when: the owner approves it (gate).
Tests: measure.js 12 seasons.
Ends with: a decision: the approved weights.
Needs checking / risks: relievers' WAR is small; the "relievers overvalued" answer from the M10 interview may change their scale.

S33: M12, the new overall (Phase 3; forecast)
Goal: The approved overall is in the game, for new players and old saves.
Tasks:
1. The new weights in league.js, with potential on the same scale. Done when: Node tests show new overalls match the proposal's table.
2. Old saves recomputed by the upgrade step. Done when: oldsavetest passes and an old save's overalls match a new league's.
Tests: seasontest, franchisetest 2 11, oldsavetest.
Ends with: commit.
Needs checking / risks: depth charts and auto-manage pick by overall; lineups may change.

S34: M12, refit everything priced by overall (Phase 3; forecast)
Goal: Salaries, asks, arbitration, trade values and draft reads fit the new overall.
Tasks:
1. Refit salaries, asking prices, expectedWar (offseason.js), M3's arbitration values, trade values (trades.js) and draft reads. Done when: a table shows payrolls and the free-agent pool within 10% of the pre-M12 numbers (Claude's default band).
Tests: seasontest, franchisetest 2 11 (also MANUAL=1), an 8-season run.
Ends with: commit and a payroll report.
Needs checking / risks: trade exploits after a value change; re-run the trade checks in franchisetest.

S35: M12, team overall and close (Phase 3; forecast)
Goal: A team overall on the screens, and M12 closed.
Tasks:
1. A team overall (lineup, rotation, bullpen, bench) checked against win totals over 12 seasons. Done when: it ranks teams about as their records do.
2. Shown on standings, team pages and the new-franchise screen. Done when: checked at both sizes.
3. One review agent; DESIGN.md, ARCHITECTURE.md, Docs version bump. Done when: committed; Sync now reminder.
Tests: all Node tests and all browser checks.
Ends with: merge to main with the owner's OK, then his playtest.

GATE after S35 (not sessions): the owner's playtest, then a re-plan checkpoint in a planning chat (phase gate).
````

---

## 5. Session sketches for the remaining phases

**Claude's working notes.** One line per session, behind the session counts in section 3. The owner has not seen these in detail. Each becomes a full session block in Stage 3, and every one is a forecast.

**M4 (S6–S7)**
- S6: make the unseeded randomness seedable for tests (simulated games, form and the schedule builder, per the Known gaps in docs/plan.md), so `franchisetest` repeats exactly; hunt the two bugs with many seeded runs.
- S7: fix both bugs (a CPU team starting spring with a lineup of 8; a free agent also listed on a roster); add the invariants to `franchisetest`; 100 or more clean runs; docs.

**M5 (S8–S13)**, after a design interview
- S8: plan check, screen inventory, a proposed navigation map, and 2–3 style samples as static pages. The owner picks one (gate).
- S9: the shared style (colors, type, buttons, cards, tables, forms) on every page; every screen checked at both sizes.
- S10: navigation and tabs restructure (top tabs, sub-tabs, League hub), with Back behaving consistently.
- S11–S12: new team-management layouts (roster, lineup, pitching, moves, stats, payroll), desktop and phone.
- S13: browser checks updated to the new structure, polish from the owner's feedback, review agent, docs.

**M6 (S14–S15)**, after the owner closes the QoL list
- S14: popups and Back (Escape closes one popup at a time; an offer popup closes when the screen changes).
- S15: the remaining list items, including the new team-management options the owner still has to describe; tests; docs.

**M7 (S16–S17)**
- S16: save version and upgrade step on load; Export save and Import save buttons; the old-save test extended.
- S17: publish on GitHub Pages (needs checking: whether the owner has to switch Pages on in the repo settings himself); a version label in the game; a full test pass on the live page at both sizes; a release tag; stale branches deleted with the owner's OK; docs.
- Gate: the owner's release playtest, then the release.

**M8 (S18–S19)**, after a short interview
- S18: fixes from friends' first feedback; how-to-play rewritten for the new navigation.
- S19: a first-run guide and a glossary; docs.

**M9 (S20–S21)**
- S20: the pose and motion editor page, exporting the data the rig reads.
- S21: the owner reworks one motion with it; Claude wires it in; the usage and the phone frame rate are written down. Gate: commit to option B or switch.

**M10 (S22–S24)**, after an interview (clutch, the deeper-stats list, study or not)
- S22: plan check; `measure.js` extended to all ten ratings; the optional study; proposed targets, approved by the owner (gate).
- S23: batted-ball data (exit speed, launch angle, hard-hit) and swing data (swing, whiff, chase) tracked per player-season, kept compact, old saves fine.
- S24: the new stats shown simply on profiles; tests; docs.

**M11 (S25–S31)**
- S25: Control and walks, with Eye.
- S26: Contact ahead of Power for batting average; hitters' strikeout spread.
- S27: the batting-average spread against Milestone 2b's targets (in docs/plan.md).
- S28: Speed, Fielding, Arm and Stamina checked, and fixed where lopsided.
- S29: clutch as a rating: generation, growth, its effect in high-leverage spots, old saves.
- S30: clutch on the screens, CPU use, tuning.
- S31: full calibration re-check (Milestone 1, 1b, 2 and 2b windows), `checks.js`, docs, review agent.

**M12 (S32–S35)**
- S32: overall weights fitted to WAR by position and role; a proposal the owner approves (gate).
- S33: the new overall in `league.js`, with potential on the same scale; old saves recomputed by the upgrade step.
- S34: refit salaries, asking prices, `expectedWar`, arbitration values, trade values and draft reads.
- S35: team overall (formula and screens); payroll, free-agent pool and trade re-checks; docs; review agent.

**M13 (S36–S39)**
- S36: player look editor (body, uniform parts, colors).
- S37: stadium editor.
- S38: camera editor, previewing a recorded play.
- S39: export and import pipeline, a how-to for the owner, a test that exported data loads from `file://`.

**M14 (S40–S41)**
- S40: a shared harness and scripts for the home, schedule, standings, leaders and league screens.
- S41: team management, profile, box score, the offseason click-through, new franchise; one command runs them all.

**M15 (S42–S44)**
- S42: `depth.js`.
- S43: `offseason.js` and `trades.js`.
- S44: `postseason.js` and the screen files not rebuilt in M5. The rig, effects and view files wait for M33.

**M16 (S45–S51)**, after an interview
- S45: plan check; bring in `tools/pitchtest.js` from the `report/pitch-test` branch; a baseline by pitch type; a proposal the owner approves (gate).
- S46: the pitch model (movement and spin drive whiff, chase and contact); the fastball rework; home runs re-calibrated.
- S47: new pitch types, old saves.
- S48: pitcher-specific pitch mix; grades that include Stuff.
- S49: per-pitch stats on the profile.
- S50: batting against and throwing the new pitches by hand.
- S51: calibration re-check, docs, review agent.

**M17 (S52–S55)**, after an interview
- S52: rate and advanced stats (K%, BB%, ISO, BABIP, K/BB, HR/9, OPS+, wRC+, ERA+, FIP).
- S53: stat page layouts and a sortable league-wide stats screen.
- S54: comparisons, batted-ball and pitch views, a glossary.
- S55: phone layouts, browser checks, docs, review.

**M18 (S56–S64)**, after the largest interview in the plan
- S56: plan check; a long-run harness (30 seasons: talent level steady, age curves per rating); a proposal (gate).
- S57: one growth model replacing today's offseason growth and absorbing form's lasting changes and spring breakouts; old saves.
- S58: long-run calibration.
- S59: training focus and intensity.
- S60: coaches.
- S61: CPU clubs train and use coaches by the same rules.
- S62: screens.
- S63: an auto-training option, phone layouts, browser checks.
- S64: calibration re-check, docs, review agent. Re-plan checkpoint.

**M19 (S65–S69)**, after an interview
- S65: plan check; a baseline of injured-list days; a proposal (gate).
- S66: the injury model (body parts, long and short, recurrences, elbow surgery recovery).
- S67: overuse raising risk over a season, relievers above all; CPU clubs weighing risk.
- S68: links to abilities and training; screens.
- S69: workload re-check against Milestone 1's windows, old saves, docs, review.

**M20 (S70–S75)**, after an interview and the decision on balk, HBP and bunt
- S70: plan check; player profiles for both teams during a played game.
- S71: the stealing rework.
- S72: stealing calibration, and simmed games matching.
- S73: HBP, if approved.
- S74: bunt and balk, if approved.
- S75: matching played and simmed games; calibration re-check; docs; review.

**M21 (S76–S80)**, after the decision on the fictional-names rule and an interview
- S76: team data (30 real U.S. cities, invented names), divisions, what happens to existing saves, the rule text in the docs.
- S77: the U.S. map team picker.
- S78: logos generated in code.
- S79: the team profile page.
- S80: polish, phone, browser checks, docs, review.

**M22 (S81–S84)**
- S81: a made-up past at league creation.
- S82: history that builds up.
- S83: screens.
- S84: a 10-season test, docs, review.

**M23 (S85–S89)**, after an interview
- S85: plan check; payrolls measured; a revenue model proposal (gate).
- S86: revenue and yearly budgets, wider markets.
- S87: the luxury tax modeled on MLB.
- S88: the Finances screen.
- S89: multi-season calibration, old saves, docs, review.

**M24 (S90–S92)**, after an interview
- S90: seen-versus-true values for other clubs' players.
- S91: applied across the screens; CPU clubs act on their own reads.
- S92: old saves, browser checks, docs.

**M25 (S93–S100)**, after the ★ interview
- S93: plan check; how well today's value predicts future WAR; a proposal (gate).
- S94: the new value, with exploit tests.
- S95: club strategies; CPU-to-CPU trades all year.
- S96: picks, cash and minor-leaguers as assets.
- S97: CPU offers to the owner.
- S98: the trade screen, with fog.
- S99: multi-season exploit tests.
- S100: old saves, docs, review agent.

**M26 (S101–S106)**, after an interview
- S101: plan check; today's market measured; a bidding design (gate).
- S102: bidding wars and player preferences.
- S103: CPU clubs signing and extending all year.
- S104: the free-agent screen.
- S105: the auto mode for the owner's front office.
- S106: calibration, old saves, docs, review.

**M27 (S107–S114)**, after an interview
- S107: plan check; AAA season options measured (sim time and save size, as the blueprint asks); a proposal (gate).
- S108: organization levels; old saves.
- S109: AAA schedule, games and stats.
- S110: development at AAA and the lower levels.
- S111: call-ups, send-downs, CPU management.
- S112: screens.
- S113: ties to minor-league free agency, trades, draft and injuries.
- S114: calibration, docs, review agent.

**M28 (S115–S120)**, after an interview
- S115: plan check; a proposal (gate).
- S116: more rounds and signing bonuses.
- S117: prospect rankings.
- S118: the scouting system.
- S119: hidden busts at creation.
- S120: calibration, old saves, docs, review.

**M29 (S121–S122)**
- S121: one franchise difficulty setting across trades, free agency, budgets and CPU skill.
- S122: tests per level, screens, docs.

**M30 (S123–S125)**, after an interview
- S123: trophies and a trophy room.
- S124: achievements.
- S125: screens, old saves, docs.

**M31 (S126–S128)**
- S126–S127: new layouts for the screens not yet redesigned.
- S128: main menu and exhibition setup, browser checks, docs.

**M32 (S129–S132)**
- S129: the study and a target table; the owner approves the archetype list and targets (gate).
- S130: 25 archetypes in player generation and for existing players.
- S131: star outliers tuned.
- S132: calibration re-check, docs, review. Re-plan checkpoint before M33.

**M33 (S133–S139)**
- S133: plan check; the rig, effects and view files reviewed; the owner's player look wired in.
- S134: motions.
- S135: fielding plays in the field view.
- S136: ball flight and impact effects.
- S137: cameras.
- S138: team stadiums tied to team profiles.
- S139: phone speed check, the known presentation gaps, docs, review agent.
- Final gate: playtest, then the parking-lot decisions.

---

## 6. Facts checked in the code (Nov 15, 2026)

So the next session doesn't have to re-derive them. All are from `main` at docs version 26.

**Version check and owed work**
- `docs/plan.md` shows Milestone 2b closed at task 5 and merged. The 25 archetypes and the batting-average spread were not built (Later list).
- Milestone 2b tasks 8–9 are owed. Milestone 3's plan is in `docs/plan.md`.
- No branch has a `claude/` folder, so the owner's planning notes are not in the repo.
- `franchisetest` failed 5 of 99 identical runs (Known gaps in `docs/plan.md`).
- An unmerged branch, `report/pitch-test`, holds `tools/pitchtest.js` and a report. Findings: the four-seam fastball is the most hittable pitch; Control barely changes walks; pitch grades count nowhere outside play.

**Front office**
- Draft: 5 rounds, 210 prospects; scouting ranges on the draft screen (`offseason.js` `enterDraft`). Round 1 contracts are 4 years at $2.5M (top 5 picks) or $1.5M; later rounds 3 years at $0.75M.
- Free agency: 4 rounds; CPU teams make up to 2 offers a round. The owner's offer is accepted at once when it reaches the asking price, and a refusal names the price that works (`offseason.js` `offer`).
- Re-signing: players 24 or under, or with prospect status, are renewed automatically for 2–3 years (`offseason.js` `enterResign`).
- CPU-to-CPU trades: a 40% weekly chance before the deadline (`trades.js`), and 2–4 at the end of free agency.
- Trade value (`trades.js` `value`): an ability curve from overall, relievers at 60%, a bonus for players 25 or under, contract surplus, an injury discount, team need. WAR is not used. The CPU's margin is 1.0 / 1.08 / 1.2 on easy / medium / hard.
- Budgets: $115M / $150M / $195M by market tier (`league.js`). A free-agent signing can't pass the budget. The CPU spends up to 60–80% of budget. The minimum salary is $0.75M.

**Players**
- Growth (`offseason.js` `develop`): toward potential up to age 27, decline from 31, a weight per rating, potential equal to overall from 29.
- Injuries (`depth.js`): day-to-day, 10-, 15- and 60-day IL, out for the season. Hitters' chance rises with fatigue and age; pitchers' with pitches thrown, more past their stamina. Healing changes no rating. There is no recurrence.
- Not in the code: HBP, balk, bunt, clutch, spin or RPM, a team overall.
- Pitch grades (20–80) show on the profile only.

**Screens and graphics**
- The game screen has no link to player profiles (`main.js`); team pages do.
- One stadium drawing serves every team (`render-bat.js`).
- 30 teams with invented cities (`league.js`): Coast League and Heartland League, divisions North, Central, South.
- The new-franchise screen lists teams by league and division with market size.
- Team sub-tabs: Roster, Lineup, Pitching, Moves, Stats, Payroll.
- Sizes: the rig, both view files and the effects file total about 3,200 lines. `depth`, `postseason`, `offseason` and `trades` total about 3,000.
