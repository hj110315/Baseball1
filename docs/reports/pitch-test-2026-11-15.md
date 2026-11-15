# Pitch test report (2026-11-15)

Report only: no game code or planning docs were changed. Branch `report/pitch-test`, based on `main` at docs version 19.
Purpose (owner's choice): learn how individual pitches shape results today, as input for W1 (pitch types) and Milestone 2b.

How to read this report: **Measured** marks numbers printed by `tools/pitchtest.js`. **Code** marks facts read from the source. **Interpretation** marks my own reading of the numbers, which I haven't verified by changing the code.

---

## Step 1. What the code does

### 1.1 A pitch's hidden quality (q) and type in league games (Code)

Each league pitcher has a stored arsenal, `[{ key, q }]`, set when the player is created (`league.js` `makePlayer`):

- `q = clamp(gauss(1, 0.04), 0.90, 1.10)`, two decimals. It never changes afterward: no aging, development, offseason or trade code touches it.
- The pitch set is one template from `BB.ARSENALS` (`data.js`): 8 starter sets (3 to 5 pitches) and 10 reliever sets (2 to 4 pitches). The first pitch is always fastball-type.

When the pitcher takes the mound (`league.js` `toGamePitcher`), every pitch's q is multiplied by his Stuff:
`game q = stored q × mult(Stuff, 0.0033)`. Stuff 60 gives ×1.00, Stuff 40 about ×0.95, Stuff 80 about ×1.05, and Stuff 90 about ×1.07 (soft cap past ±12). That day's form (Milestone 2) adds rating points to Stuff first. So the **game q** runs about 0.84 to 1.18, while the stored q stays in 0.90 to 1.10.

In a simulated (headless) pitch, game q enters in four places, all in `game.js`:

| Where | Formula | What it does |
|---|---|---|
| CPU pitch choice (`cpuChoosePitch`) | weight = family share ÷ pitches in family × **q²** | Better pitches are thrown a little more often, and q also tilts the fastball/off-speed split. |
| CPU batter's timing (`cpuSwing`) | timing error σ × **q** | **The main lever.** A bigger timing error means more misses, more fouls and weaker contact. q 1.10 makes the error 10% wider. |
| CPU chase (`cpuSwing`) | out-of-zone swing chance + type's `chase` × **q** | Tiny. With `chase` at 0 to 0.12, going from q 0.9 to 1.1 adds at most about 2 points of chase. |
| Contact (`contactFx`) | exit speed × type `evMul` × (1 − (q − 1) × 0.3) | Small. q 1.10 takes 3% off exit speed. |

q does not touch location or command (that comes from Control), the launch angle, or the two-strike `whiff` edge (that comes from Stuff and Velocity at the pitcher level).

In the **playable view** (`main.js`) q also scales the drawn break (`0.75 + 0.25 × q`) and shrinks the human hitter's timing windows (`windows × contact ÷ q`). Simulated games don't use either.

**Pitch type** enters through fixed per-type numbers in `BB.PITCHES` (`data.js`):

| Type | mph vs. fastball | `phiShift` (launch angle) | `evMul` (exit speed) | `chase` | `fool` (speed-change timing) |
|---|---|---|---|---|---|
| Fastball (fb) | 0 | **+2°** | **1.00** | **0** | 1 |
| Sinker (si) | −2 | −7° | 0.98 | 0.02 | 1 |
| Cutter (ct) | −4 | −1° | 0.94 | 0.04 | 1 |
| Slider (sl) | −8 | −2° | 0.97 | 0.10 | 1 |
| Curveball (cv) | −14 | −2° | 0.98 | 0.07 | 0.7 |
| Change-up (ch) | −9 | −3° | 0.97 | 0.08 | 1.5 |
| Splitter (sp) | −7 | −6° | 0.96 | 0.12 | 1.4 |

The type also sets the speed-change timing effect (a pitch slower than the last one makes the CPU hitter early, scaled by `fool`), extra location scatter (`extraSigma`), and where the CPU misses on purpose: fastball-type balls are thrown high and the rest low. A pitch's height adds `8 × height` degrees to launch angle in `sim.contact`, so high misses also lift contact.

Headless games always use **Medium** physics (`engine.runHeadless`). The CPU's base fastball-type share is `cpuFbShare` 0.55 there, and it changes with the count (−0.15 with two strikes, 0.85 at three balls, +0.10 after an off-speed pitch).

### 1.2 The pitch grades the game shows (Code)

- **Where:** only in the player profile modal, under Ratings (`js/ui/profile.js` `ratingBars`), as "Fastball 55 · Slider 60 …" with the note "Pitch grades on the 20-80 scouting scale." The in-game pitch buttons (`main.js` `renderPitchButtons`) show only names. Nothing else (overall, depth charts, trades, WAR) reads q. Pitcher overall uses Velocity, Control, Stamina and Stuff only.
- **Scale:** `grade = 50 + (q − 1) × 250`, rounded to the nearest 5 and clamped to 20-80. So each 0.02 of q is 5 grade points, and q 0.90 to 1.10 maps to 25 to 75. With stored q's spread of 0.04, the grades' spread is about 10 points: about two thirds of pitches grade 40 to 60.
- **Which q:** the **stored** q, without Stuff or form. Two pitchers can both show a "55 slider" while one of those sliders plays about 15 grade points better in games, because that pitcher's Stuff is 20 points higher (for example 70 against 50).
- **Docs mismatch (not fixed, report only):** ARCHITECTURE.md's data model says `arsenal q ~0.85..1.15`. That matches the game q. The stored q is 0.90 to 1.10.

### 1.3 Classification (Code: `BB.PITCHES[key].family`)

| Fastball-type (`'fast'`) | Breaking/off-speed (`'off'`) |
|---|---|
| Fastball (fb), Sinker (si), Cutter (ct) | Slider (sl), Curveball (cv), Change-up (ch), Splitter (sp) |

The game uses the family only for the CPU's pitch mix and for where the CPU misses on purpose (high or low). No arsenal is all one family.

---

## Step 2. Measurements

### How it was measured

- `node tools/pitchtest.js 6 11`: 6 franchise seasons (each one a regular season, postseason and offseason), seed 11. That run logged **3.72 million regular-season pitches**: 2,659 pitcher-seasons, **589 qualified starter-seasons** (162+ IP, at least half their games started) and **1,306 reliever-seasons with 50+ IP** (no starts). Full output: `docs/reports/pitch-test-2026-11-15-output.txt`.
- A check run, `node tools/pitchtest.js 3 23` (3 seasons, a different league), gave the same patterns. Its numbers are within about ±0.01 of AVG and ±0.05 of correlation.
- The script wraps `BB.game` and `BB.sim` functions at run time. It changes no game code.
- Runs are not exactly repeatable: the schedule, form and headless games use `Math.random`, so a rerun moves numbers slightly.
- The same pitchers appear in several seasons, so the pitcher-seasons aren't fully independent.
- Definitions:
  - **grade**: the profile's 20-80 grade, which comes from the stored q.
  - **game q**: stored q × Stuff, with that day's form.
  - **whiff**: misses per swing.
  - **chase**: swings at pitches out of the zone.
  - **K/100, BB/100**: strikeouts and walks per 100 pitches of that kind. Each plate appearance is credited to the pitch that ended it.
  - **hard%**: balls in play at 150+ ft/s (about 102 mph). The sim's exit speeds run high (median 143 ft/s), so this line marks the top third, about MLB's "hard-hit" share. The usual 95 mph line would call 60% of balls hard.
  - **AVG**: hits per at-bat that ended on that pitch.

### 2.1 Pitch quality, per pitch (Measured)

By the **displayed grade**, all pitchers:

| Grade | Pitches | Whiff | Chase | K/100 | BB/100 | Hard% | HR per 100 balls in play | AVG |
|---|---|---|---|---|---|---|---|---|
| 20-35 | 461k | 26.5% | 22.8% | 5.6 | 1.9 | 41% | 7.7 | .305 |
| 40 | 520k | 28.4% | 23.1% | 5.9 | 1.8 | 38% | 7.1 | .288 |
| 45 | 283k | 29.3% | 22.5% | 6.0 | 1.9 | 36% | 6.5 | .281 |
| 50 | 661k | 29.7% | 23.5% | 6.1 | 1.7 | 34% | 6.0 | .273 |
| 55 | 689k | 30.9% | 23.5% | 6.4 | 1.7 | 32% | 5.4 | .263 |
| 60 | 514k | 31.4% | 23.4% | 6.4 | 1.6 | 30% | 4.8 | .257 |
| 65-80 | 592k | 33.4% | 23.7% | 6.8 | 1.7 | 24% | 3.6 | .236 |

By the **game q** the sim actually uses (stored q × Stuff), the spread is wider:

| Game q | Whiff | Hard% | HR per 100 balls in play | AVG |
|---|---|---|---|---|
| under 0.94 | 24.7% | 45% | 9.1 | .326 |
| 0.97-1.00 | 28.6% | 37% | 6.7 | .287 |
| 1.03-1.06 | 32.0% | 29% | 4.6 | .250 |
| 1.06+ | 34.7% | 22% | 3.4 | .228 |

**With Stuff held in a band** (Stuff 55-64, so the grade is the only big difference):

| Grade | Whiff | Hard% | HR per 100 balls in play | AVG |
|---|---|---|---|---|
| 20-40 | 26.7% | 40% | 7.4 | .302 |
| 50 | 28.9% | 35% | 6.2 | .278 |
| 60-80 | 31.4% | 28% | 4.5 | .255 |

The Stuff 40-54 and 65+ bands show the same slope (output file, section 1c).

- **Grade changes walks and chases almost not at all.** BB/100 stays at 1.6-1.9 and chase at 22.5-23.7% in every band.
- **Usage:** a pitcher throws his better pitches slightly more. A 65+ pitch gets 1.07× an even share of its family's pitches, and a 35-or-lower pitch gets 0.93×.

### 2.2 Pitch quality, per pitcher (Measured, qualified starters)

| Average grade of his pitches | Pitchers | K% | BB% | HR/9 | Hard% | AVG | WHIP |
|---|---|---|---|---|---|---|---|
| under 42.5 | 19 | 21.2% | 6.2% | 1.47 | 34% | .264 | 1.29 |
| 42.5-47.5 | 95 | 21.6% | 5.8% | 1.40 | 32% | .260 | 1.25 |
| 47.5-52.5 | 218 | 22.1% | 5.8% | 1.35 | 31% | .256 | 1.23 |
| 52.5-57.5 | 153 | 23.2% | 5.9% | 1.38 | 31% | .257 | 1.24 |
| 57.5+ | 104 | 24.3% | 5.7% | 1.06 | 25% | .238 | 1.13 |

The per-pitcher spread is much narrower than the per-pitch spread: averaging 3 to 5 pitches pulls most pitchers to 45-55.

### 2.3 Pitch types (Measured, all pitchers)

| Type | Share of pitches | Whiff | Chase | Hard% | HR per 100 balls in play | AVG | Mean exit speed | Mean launch angle |
|---|---|---|---|---|---|---|---|---|
| **Fastball** | 35.6% | 28.6% | 18.1% | **43%** | **9.6** | **.315** | 143.1 | **17.1°** |
| Sinker | 11.1% | 28.9% | 20.2% | 34% | 4.0 | .254 | 140.2 | 8.3° |
| Cutter | 11.9% | 29.6% | 22.4% | **16%** | **2.2** | **.231** | **134.5** | 14.2° |
| Slider | 13.4% | 31.8% | 29.7% | 29% | 4.1 | .248 | 138.7 | 11.5° |
| Curveball | 10.7% | 31.4% | 26.4% | 33% | 5.0 | .260 | 140.1 | 11.5° |
| Change-up | 14.1% | 32.2% | 27.6% | 29% | 3.7 | .245 | 138.6 | 10.6° |
| Splitter | 3.2% | 31.8% | 31.5% | 26% | 2.7 | .227 | 137.8 | 7.5° |

By family: fastball-type pitches are 58.5% of all pitches, with 28.8% whiff and .287 AVG. Breaking/off-speed pitches have 31.8% whiff and .249 AVG.

Even a **top-graded four-seam fastball (65-80) gives up .275 and 6.5 HR per 100 balls in play**. That's worse than an average slider (.248, 4.1). A 20-35 fastball gives up .362 and 12.9.

Walks land on fastball-type pitches (BB/100 2.6 against 0.5) only because the CPU throws 85% fastball-type at three balls. That's how walks get credited, not an effect of quality.

### 2.4 Arsenal size and mix (Measured)

**Size, qualified starters:**

| Pitches | Pitchers | K% | HR/9 | WHIP |
|---|---|---|---|---|
| 3 | 113 | 24.1% | 1.55 | 1.26 |
| 4 | 392 | 22.3% | 1.27 | 1.21 |
| 5 | 84 | 22.3% | 1.22 | 1.21 |

**Size, relievers with 50+ IP:**

| Pitches | Pitchers | K% | HR/9 | WHIP |
|---|---|---|---|---|
| 2 | 318 | 21.2% | 1.62 | 1.31 |
| 3 | 800 | 21.2% | 1.40 | 1.27 |
| 4 | 177 | 19.6% | 2.03 | 1.44 |

**Thrown mix:** every pitcher throws about the same share of fastball-type pitches: 51% to 66%, median 58%. Split into thirds (breaking-heavier, middle, fastball-heavier), the groups show no difference: starters' WHIP is about 1.22 in all three and relievers' about 1.30.

**Four-seam fastball share, which is what actually separates arsenals:**

| Four-seamer share of pitches | Starters: pitchers | Starters: HR/9 | Starters: WHIP | Relievers: pitchers | Relievers: HR/9 | Relievers: WHIP |
|---|---|---|---|---|---|---|
| none (sinker and/or cutter instead) | 114 | 0.96 | 1.17 | 603 | 0.94 | 1.17 |
| under 35% (fb plus another fastball-type pitch) | 271 | 1.28 | 1.21 | 33 | 1.85 | 1.46 |
| 50%+ (fb is his only fastball-type pitch) | 204 | 1.56 | 1.26 | 669 | 2.07 | 1.42 |

All rows come from section 2e of the output file. One reliever falls in a 35-50% group, not shown. The best starter set, `si/ct/cv/ch`, posts a 1.17 WHIP and 0.96 HR/9. The worst are `fb/cv/ch` and `fb/sl/ch/cv`, at 1.27 WHIP and about 1.6 HR/9.

### 2.5 WHIP correlations (Measured)

r is the Pearson correlation across pitcher-seasons. A negative r means a higher value goes with a lower (better) WHIP. "Ratings held" is the partial correlation with Stuff, Velocity and Control regressed out of both sides.

| Measure | Starters: r with WHIP | Starters: ratings held | Relievers: r with WHIP | Relievers: ratings held |
|---|---|---|---|---|
| Average grade, all his pitches | −0.26 | −0.26 | −0.30 | −0.33 |
| Average grade, weighted by usage | −0.25 | −0.28 | −0.32 | −0.35 |
| Average fastball-type grade | −0.17 | −0.25 | −0.27 | −0.29 |
| Average breaking/off-speed grade | −0.20 | −0.13 | −0.20 | −0.22 |
| Stuff | −0.40 | −0.35 (other two held) | −0.49 | −0.44 |
| Velocity | −0.17 | −0.03 | −0.24 | −0.13 |
| Control | −0.20 | −0.08 | −0.18 | −0.01 |

The same thing as a group view: WHIP compared with what the pitcher's Stuff, Velocity and Control predict.

| Average grade | Starters | Relievers |
|---|---|---|
| under 42.5 | +0.07 | +0.16 |
| 47.5-52.5 | +0.00 | +0.02 |
| 57.5+ | −0.09 | −0.11 |

**By rating band, qualified starters (WHIP):**

| Band | Stuff | Velocity | Control |
|---|---|---|---|
| under 50 | 1.39 | 1.28 | 1.28 |
| 50-56 | 1.32 | 1.23 | 1.23 |
| 57-63 | 1.28 | 1.23 | 1.23 |
| 64-70 | 1.21 | 1.22 | 1.23 |
| 71+ | 1.17 | 1.19 | 1.19 |

Walk rate (BB%) by Control band is **6.1%, 6.1%, 5.9%, 5.8%, 5.6%**.

---

## Step 3. What it means

### What matters a lot

1. **Pitch quality, pitch by pitch (Measured).** From the bottom to the top grade band, a pitch's batting average against drops from .305 to .236. Whiffs rise from 26.5% to 33.4%, and home runs per ball in play roughly halve. The pattern holds with Stuff held in a band. Through the code, it works almost entirely through the CPU hitter's timing error (σ × q). *(Interpretation: this is what the grade "means" today: harder to time. Not better location, not more chases.)*
2. **Four-seam fastball against every other pitch type (Measured).** The four-seamer is the most-thrown pitch (36%) and by far the most hittable: .315 AVG and 9.6 HR per 100 balls in play. The cutter is .231 and 2.2. Starters with no four-seamer allow 0.96 HR/9; starters for whom it is the only fastball-type pitch allow 1.56. For relievers that gap is 0.94 against 2.07 HR/9, and WHIP 1.17 against 1.42. **This is bigger than any pitch-grade effect at the pitcher level.** *(Interpretation, from the code: the fastball is the only pitch with no exit-speed cut (`evMul` 1.00, the cutter's is 0.94) and the only one with an upward launch shift (+2°). The fastball family also misses high, which lifts contact. Together that gives a 17° mean launch angle at the highest exit speed, the home run zone. Not verified by changing the numbers.)*
3. **Stuff (Measured).** It has the strongest link to WHIP (r −0.40 starters, −0.49 relievers) and to K% (r +0.73 starters). That makes sense: Stuff raises every pitch's q and also the two-strike `whiff` edge.

### What matters a bit

4. **A pitcher's average grade (Measured).** r ≈ −0.26 to −0.33 with WHIP, and about the same with ratings held, so it is a real effect separate from Stuff. Its size: a starter whose pitches average 57.5+ runs about 0.09 WHIP better than his ratings predict. The overall spread is modest because averaging 3 to 5 pitches flattens it.
5. **Fastball-type grade against breaking grade (Measured).** With ratings held, the fastball-type grade matters more (starters −0.25 against −0.13). *(Interpretation: fastball-type pitches are 58% of everything thrown, and many arsenals have only one, so that one grade covers more than half the pitches.)*

### What barely matters

6. **Arsenal size (Measured).** Starters with 4 or 5 pitches post the same WHIP (1.21), and 3-pitch starters are 1.26. Relievers with 4 pitches are the *worst* (1.44). *(Interpretation, from the code: no code rewards having more pitches. The differences come from which templates have a four-seamer as their only fastball-type pitch: all 3-pitch starter sets and the 4-pitch reliever set `fb/sl/cv/sp`.)*
7. **Pitch mix (Measured).** Everyone throws 51-66% fastball-type pitches, and the thirds show no difference. *(Code: the CPU's mix depends on the count, not the pitcher. A pitcher's makeup only splits the share within each family. So "fastball-heavy or breaking-heavy pitcher" isn't a real trait today.)*
8. **Grade and walks or chases (Measured).** Flat. In the code the chase term is `chase × q`, which is too small to show.
9. **Velocity and Control, other ratings held (Measured).** Partial r with WHIP is −0.03 and −0.08 for starters.

### Looks broken or surprising

- **Control barely affects walks (Measured).** Starters' BB% goes only from 6.1% (Control under 50) to 5.6% (71+). League BB% is flat at about 5.8% for everyone. *(Interpretation, from the code: Control scales location error by 0.75 to 1.25, but at Medium the CPU's base miss (`cpuCommand` 0.24) is small next to where it aims (on purpose 1.2 to 1.8 off the plate, or inside it). So the pitcher's chosen target decides most balls and strikes, and command decides little.)* This isn't about pitches, but it matters for W1 if pitch types are meant to differ in command.
- **The four-seam fastball is the game's worst pitch,** even when it's graded well (2.3 above). A design check for W1: in real baseball, the four-seamer is usually a pitcher's best whiff pitch at the top of the zone.
- **The cutter is the game's best pitch by contact quality:** hard contact 16% against 26-43% for every other type, and AVG .231. That comes from its 0.94 exit-speed multiplier alone.
- **The shown grade leaves out Stuff (Code).** Two "55" sliders can play about 15 grade points apart. Owners can't see the q the game uses.
- **The grade affects nothing outside play (Code).** Overall, the trade AI, depth charts and WAR ignore pitch grades, so a pitcher with great pitches and middling Stuff is undervalued everywhere except on the field.
- **Docs mismatch (Code):** ARCHITECTURE.md gives arsenal q as ~0.85-1.15. The stored q is 0.90-1.10 (game q, with Stuff, is about 0.84-1.18).

### Suggested questions for W1 / Milestone 2b (for the owner to decide; nothing was changed)

1. Should the four-seamer stay the most hittable pitch, or should W1 rebalance `evMul` and `phiShift` by type? (Rebalancing would also shift the league's home run rate, which was calibrated with these values.)
2. Should the displayed grade include Stuff (the q the game uses), or keep showing the pitch's own quality?
3. Should pitch grades count toward pitcher overall, trade value or depth decisions?
4. Should arsenal size or a pitcher-specific pitch mix mean something? Today neither does.
5. Should Control get a stronger effect on walks? That's a balance change that goes beyond pitches.
