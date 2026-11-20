# Hitting ratings redesign: interview summary (Nov 20, 2026)

The owner's answers to an interview about replacing Contact, Power and Eye. It started from another AI's proposal (7 hitting ratings), reviewed against three rules: each rating has a unique job, ratings are worth roughly equal WAR per point (non-linear curves allowed), and each rating ties to sabermetric stats that track performance over the long run. Nothing here is built yet; it goes through the usual milestone process.

## Owner's decisions
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

## Claude's inferences (not decisions)
- Large milestone: new contact model, generation, recalibration of runs, K%, WAR, contracts and form, save conversion, pitching.
- Equal-value check: +10 points at 40, 60 and 80 across test profiles; target within about ±20% *(default)*.
- With roughly equal value, overall can be close to a plain mean of the hitting ratings.

## Still open
- What the Library feature is.
- Pitching ratings (next interview).
- Exact numbers: curve breakpoints, synergy cap, generation correlation.
- How Speed and fielding fit the value budget.
