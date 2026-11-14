# Diamond Dash: milestone plan

Planning happens in the claude.ai project; building happens in Claude Code sessions on this repo. This file is the hand-off between the two.

**How to use it**
- Keep only 1–2 milestones under "Current milestones". Bigger plans go stale fast.
- A coding session builds the milestone in order, ticks off tasks, and updates the status lines, then moves finished milestones to "Done".
- Label every decision as either **owner's choice** or **Claude's default**.
- When a milestone is finished, update `DESIGN.md` (decisions) and `ARCHITECTURE.md` (APIs and modules) too.

---

## Current milestones

*(None yet. Copy the template below.)*

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

**Next steps**
- Owner playtest: a full game and a few franchise days, played by hand. Nobody has done this yet.
- A permanent browser test suite in `tools/e2e/`.
- A line-by-line review of the agent-written modules (see `CLAUDE.md`).
- Switch GitHub's default branch to `main` (the owner does this in Settings) and delete stale branches.

**Known gaps**
- Clinch and elimination marks can show a few days late.
- Draft prospects show by name only (their true ratings are hidden).
- After the final out, the celebration mob disappears once the box score opens.
- Escape closes all stacked popups at once.
- In games the owner plays, their own pitcher is never pulled automatically (by design, as in exhibition).
- Team budgets are about 3× typical payrolls, so CPU spending is capped at 50–80% of budget.
- An offer popup can stay open if the screen changes underneath it.
- The batter's home run trot in the bat view is only a few steps.
- The sim marks most grounders as "dives", so replays use a stricter test of their own.

## Done

*(Finished milestones move here, with the date and a one-line summary.)*
