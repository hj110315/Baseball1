# Handoff: ratings redesign, merging into main

For a new Claude Code chat. Written Nov 20, 2026 by session `ccr-a97b9715-fnzb96`.

## What happened
The owner reviewed another AI's hitting-rating proposal and was interviewed on a full redesign of player ratings (hitting, pitching, fielding, running) plus a Library screen. **Nothing is built.** The only output is a design record.

- Branch: `ccr-a97b9715-fnzb96` (based on `main` at `8355bdb`).
- Files: `docs/ratings-interview.md` (decisions, Claude's inferences, open items) and this handoff. Neither is one of the six synced files, so the docs version was not bumped.

## Your job
Work out with the owner how these decisions get into `main` and the roadmap. Do not push to `main` without the owner's OK. Another chat was working at the same time (branch `claude/dreamy-einstein-rbk72v`, writing `docs/longplan-draft.md`); check it has finished, or its latest state, before you change shared docs.

## Steps
1. Read `docs/ratings-interview.md`, then the CLAUDE.md reading list.
2. Fetch `main` and check what changed since `8355bdb`, especially `docs/longplan-draft.md`, `docs/plan.md` and the docs version (26 at handoff).
3. Reconcile with the long plan. Known overlaps:
   - **M8 glossary** (S19) is close to the Library's reference part. Merge or replace?
   - **M10/M11** (S22 on) measure what 10 points of each current rating are worth and retarget them. The redesign replaces those ratings; M10's measuring tools still apply.
   - **M11 clutch rating** was not part of this interview. Keep, drop or fold in? Ask the owner.
   - **"Ovr." rework** (player overall lining up with WAR) matches the inference that overall becomes a near-mean of equal-value ratings.
   - **M26 per-pitch spin and movement** (S-number near line 818 of the draft) overlaps the arsenal grades and shapes.
   - **M32 archetypes and star outliers** overlap "stars are mostly specialists" and the steep-past-85 curve. The redesign may make the 25-archetype list mostly emerge from rating mixes.
4. Report the mismatches to the owner, then propose how to split the redesign into milestones (Claude's suggestion: contact model with hitting and pitching first, then defense and running, then the Library). The owner decides.
5. Once the owner agrees, update `DESIGN.md` (new section, decisions and *(default)* labels kept apart), `docs/plan.md` (roadmap entries, docs version +1, date, note) and possibly the long plan. Remind the owner to click **Sync now**. If `docs/ratings-interview.md` should be in the planning project, it must be added once.
6. Merge: this branch has only doc commits on top of `8355bdb`, so it should merge cleanly. With the owner's OK, merge into `main` and push.

## Facts checked in code (Nov 20)
- Hitting today: Contact, Power, Eye, Speed. A CPU swing is one Gaussian timing error (`game.js` `cpuSwing`); Contact scales its spread; `sim.js` `contact()` turns it into miss, foul or in play, quality, EV, launch and spray. Eye only lowers out-of-zone chase.
- The player's own batting is timing only (`main.js` `resolveContact`); aiming exists only for pitching.
- Pitching today: Velocity, Control, Stamina, Stuff, plus an arsenal with per-pitch `q` (0.9–1.1, scaled by Stuff). Seven fixed pitch types in `data.js`.
- Defense: Fielding (one value, scaled by position) and Arm (`league.js` around line 516).
- Overall weights: `WEIGHTS` in `league.js`; offense helper weights Contact .38, Power .34, Eye .18, Speed .10.

## Not yet decided
Exact numbers (curves, synergy cap, generation correlation), Library layout, roadmap placement, clutch.
