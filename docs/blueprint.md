# Diamond Dash: blueprint for later work

Longer-range plans from the planning chats, kept here so `docs/plan.md` stays short. Nothing in this file is built yet. Each area still needs its own milestone in `docs/plan.md`, and most need an interview first.

**Based on:** docs version 7 (the Nov 14, 2026 hand-off called it "docs version 1"; see "Checked against the code" at the end).

Items are the **owner's choices** unless marked otherwise.

---

## W5: player development and stats

- Clearer stat pages: same stats, better layout, sorting and comparisons.
- Add modern stats, rate stats first. Claude's default list: K%, BB%, ISO, BABIP, K/BB, HR/9.
- Each ability grows and declines on its own curve.
- Training: a focus and an intensity per player. Harder training means faster growth but more fatigue and injury risk.
- Training works all year, gradually. It must not be overpowered.
- The 29 CPU teams develop their own players.
- Maybe: archetypes used only to generate players, never shown in the game, exactly 25.
- Not chosen: more or finer abilities.

**Claude's inferences**
- One growth model must cover training, form-based lasting changes, spring breakouts and offseason growth.
- Intensity ties into the existing injury and fatigue system.
- CPU teams use the same rules with no hidden bonus.

**Unknown**
- How growth is shown.
- What is hardest to read on today's stat pages.

---

## W4: front office

- Owner: nothing is unclear today. More complexity is more fun.
- Trading, draft, minor leagues, minor-league development and free agency should matter more.
- **Budgets:** not fixed and strict. Each year's budget follows revenue. Market sizes run from small to big and shape the budget whatever the results. Luxury tax with rising rates plus a draft-pick penalty, but mild. A Finances screen: revenue breakdown, payroll, tax, next year's projection.
- **Trading** (a key feature): CPU offers to the owner, contender and rebuilder strategies, picks, cash and minor-leaguers as assets, smarter values.
- **Free agency:** bidding wars, player preferences, real money pressure.
- **Minor leagues:** three or more levels. Only AAA has games, stats and development. Lower levels are roster formats only for now.
- Owner's idea, to confirm by measuring: a short AAA season, for example 60 games.
- **Draft:** signing bonuses, more rounds, prospect rankings. Some may wait.
- Not chosen: roster roles (platoons, bullpen roles), in-game strategy, a draft lottery, contract counteroffers.

**Claude's inferences**
- The budget model comes first. It replaces the CPU spending cap (60–80% of budget in the code today).
- Markets need a wider spread than today's 3 tiers.
- AAA development uses W5's growth model.
- Measure AAA's sim time and save size.

**Unknown**
- Number and names of lower levels.
- Number of draft rounds.

---

## W3: visuals (lower priority)

- Improve all three: player motion, field and stadium, ball and impact effects.
- Replace the silhouettes with real characters in a 3D look. This overrides the silhouette decision in `DESIGN.md`.
- Use a vendored 3D library. The owner approved this exception to "no dependencies" and "don't add script tags".
- During plays: broadcast angles plus switchable presets (the owner picked the "free camera + presets" option). Batting and pitching keep today's view.

**Before any work, report these conflicts** (all need checking):
- ES modules from `file://`
- assets must be embedded, not fetched
- phone performance
- pitch timing must not change
- rig, render and fx files get rewritten
- logic files and Node tests stay untouched
- characters stay original
- the library's license ships with the game

**Not decided**
- Whether "works from disk" may be dropped.
- A 2D fallback.
- The art style.
- What "free camera" means.

---

## Checked against the code (Nov 14, 2026, coding session)

- The hand-off was written against docs version 1. The docs were at version 7 when this file was added. Versions 2–7 added: the version rule for `CLAUDE.md`, the Roadmap placeholder, releasing players, released players staying on the payroll, one payroll total for the whole organization, and the GitHub sync note.
- **W4 budgets:** today's budgets are $115M, $150M and $195M for the three market tiers. Opening payrolls (whole organization) average about $60–67M, so budgets are about 2× to 3.4× payroll. The CPU spending cap is 60%, 70% or 80% of budget by market tier (older docs said 50–80%).
- **W4 releasing players** already exists (docs versions 4–6): released players stay on the payroll until their contracts end. A budget model has to keep that rule.
- **W4 "bullpen roles" not chosen:** Milestone 1 adds simple automatic bullpen roles (closer, setup, middle relief) for the CPU manager. They are not a user-facing roster feature.
- **W5 rate stats:** `BB.season.calc` already returns K/9 and BB/9. The rest of the default list is not computed yet.
