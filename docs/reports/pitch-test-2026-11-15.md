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

*(pending: filled in after the simulation runs)*
