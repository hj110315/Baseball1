# Ratings redesign: interview summary (Nov 20, 2026)

The owner's answers to an interview about replacing Contact, Power and Eye. It started from another AI's proposal (7 hitting ratings), reviewed against three rules: each rating has a unique job, ratings are worth roughly equal WAR per point (non-linear curves allowed), and each rating ties to sabermetric stats that track performance over the long run. Nothing here is built yet; it goes through the usual milestone process.

## Hitting: owner's decisions
- **Spatial dimension:** a swing has two errors, *when* (timing, ms) and *where* (bat height vs ball).
- **Six visible hitting ratings, plus Speed:**

| Rating | Job | Main stats |
|---|---|---|
| Contact | Spatial error: whiff vs foul vs in play | Contact%, Z-Contact%, Whiff%, K% |
| Timing | Temporal error: handling velocity, pull/oppo | Whiff% and xwOBA vs 95+ mph, spray mix |
| Launch | Tight launch-angle band and spray control (replaces Bat Control) | Launch-angle spread, sweet-spot%, popup% |
| Raw Power | Bat speed and top exit velocity only; a single value | Max EV, 90th-pct EV, HR/FB, ISO |
| Recognition | Reading the pitch early: less fooled by offspeed and break, fewer chases on strike-looking pitches (absorbs Pitch Adaptation) | Chase on strike-looking pitches, breaking-ball whiff |
| Discipline | Swing/take judgment in and near the zone, by count | BB%, swing-decision run value |

- **Aggressiveness:** a visible tendency (Patient / Balanced / Aggressive), not a 20–99 skill and not part of overall. Roughly value-neutral on its own; pays off or hurts depending on Discipline.
- **Top end:** steep past about 85, the same shape as Stuff. Synergy bonuses capped.
- **Stars:** mostly specialists with real holes; ratings drawn with mild correlation; a rare few elite across the board.
- **Your own batting:** still timing only; ratings roll the spatial error.
- **Pitching:** audited in the same milestone (one recalibration).
- **Old saves:** convert automatically; player value stays about the same.
- **Diagnostics** (squared-up%, strike-looking chase, launch-angle spread, swing-decision run value): an advanced view filed under the **Library** feature. What the Library is has not been found in the repo yet; the owner to confirm.

## Hitting: Claude's inferences (not decisions)
- Large milestone: new contact model, generation, recalibration of runs, K%, WAR, contracts and form, save conversion, pitching.
- Equal-value check: +10 points at 40, 60 and 80 across test profiles; target within about ±20% *(default)*.
- With roughly equal value, overall can be close to a plain mean of the hitting ratings.

## Pitching: owner's decisions
- **Pitcher-wide ratings:**

| Rating | Job | Main stats |
|---|---|---|
| Velocity | Attacks hitter timing: late swings, weaker and opposite-field contact; small K bump (about +1% per 10 points) | Avg EV against, hard-hit%, oppo% |
| Command | Scatter around the target: walks and hitting corners | BB%, edge%, meatball% |
| Deception | Hides pitch type and speed; the mirror of Recognition | Chase%, off-speed whiff relative to grade |
| Stamina | Pitches per outing; role-weighted, outside the equal-value rule (counts for starters, barely for relievers) | Pitches per start, innings |

- **Aim tendency:** Nibbler / Balanced / Attacker; roughly value-neutral, pays off with good Command.
- **Arsenal:** a section in the pitcher profile (not its own screen). Each pitch has a grade (movement/quality) and a shape (ground-ball or fly-ball tilt). Grades carry moderate weight; the pitch type stays the main driver. For balance and overall the arsenal counts as one usage-weighted composite.
- **Put-away pitch:** the best-graded pitch, with the steep-past-85 curve; strikeout aces come from here.
- **Growth:** pitch grades grow and age; a pitcher occasionally learns a new pitch in the offseason (starts low). Pitches are not lost.

## Pitching: Claude's inferences (not decisions)
- Stuff is retired (its whiff job moves to grades and the put-away pitch); Control becomes Command.
- Old saves: Stuff to pitch grades with spread, Control to Command, Deception and aim tendency rolled.
- Star shape: mostly specialists, as for hitters.
- Calibration targets unchanged: about 21% league K, aces 28–33%, 4.3–4.6 runs per team-game.

## Still open
- What the Library feature is.
- Arsenal size; how often a new pitch is learned.
- Exact numbers: curve breakpoints, synergy cap, generation correlation.
- How Speed and fielding fit the value budget.
