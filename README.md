# Diamond Dash

A full baseball game for the browser. You bat and pitch against a CPU team over 1, 3 or 9 innings. When the ball is put in play, the view switches to a top-down field so you can watch the fielders, runners and throws.

## Play

Open `index.html` in a browser. There's no build step and nothing to install, and it works with touch, mouse or keyboard.

On the setup screen you can name your team, pick its color, choose an opponent, the number of innings, whether you bat first or second, and the difficulty.

## How to play

- **Batting:** tap, click or press `Space` to swing. Timing is everything:
  - Swing **early** to pull the ball (left field for a right-handed batter) and **late** to go the other way.
  - **Perfect** timing gives the hardest contact. A message after each swing tells you whether you were early, late or perfect.
  - Pitches outside the zone are much harder to hit well. Let them go and take your walk.
- **Pitching:** pick a pitch (keys `1`–`5`), then tap where in the zone to throw it. The dotted ring shows how far the pitch can miss. It grows with harder difficulty, with wilder pitchers and as your pitcher tires. Mixing speeds fools the CPU: a change-up or splitter right after a fastball makes hitters swing early.
- **Pitch types:** fastball, sinker, cutter, slider, curveball, change-up and splitter. Each pitcher throws 3–5 of them. Sinkers and splitters get ground balls, cutters jam hitters for weak contact, and sliders and splitters get chases out of the zone.
- **Bullpen:** each team has a starter and four relievers (one is the closer). While you're pitching, tap **BULLPEN** (or press `B`) between pitches to bring in a reliever. The panel shows each pitcher's pitches, velocity, control and energy. A pitcher who comes out can't go back in. The energy bar next to your pitcher's name drops as they throw. Past their stamina, their control gets worse and they lose velocity. The CPU makes its own pitching changes when its pitcher tires or gets hit hard.
- **Stealing:** with a runner on base and the next base open, tap **STEAL** (or press `S`) before the pitch.
- **Tagging up:** after a catch in the outfield you choose whether the lead runner tags up (`Y` to send, `N` to hold).
- Fielding and the rest of the baserunning are automatic. Tap the field view or press `Space` to speed it up.
- `P` or `Esc` pauses and `M` mutes.

| Difficulty | Pitch speed | Timing window | Hints | CPU hitters |
|------------|-------------|---------------|-------|-------------|
| Easy       | Slow        | Wide          | Pitch type, plus a ring where the pitch will cross | Chase a lot |
| Medium     | Medium      | Medium        | Pitch type at release | Average |
| Hard       | Fast        | Tight         | None until after the pitch | Patient, more power |

## Franchise mode

Pick **Franchise** on the main menu to run one of 30 fictional teams across seasons. Your progress saves automatically in the browser.

- **League:** 2 leagues (Coast and Heartland), each with 3 divisions. Rosters are 26 players plus reserves and prospects. Ratings run 20–99, and 60 is an average big-leaguer.
- **Season:** about 15 spring training games, then a 162-game schedule with an All-Star Game. Each game, you choose:
  - **Play** it from the first pitch
  - **Quick play**, which sims to the first key moment (late and close) and hands it to you
  - **Sim** it straight to the box score
  - You can also sim a day, a week, a month, up to a date, or to the end of the season.
- **Postseason:** 12 teams. Wild Card (best of 3), Division Series (best of 5), League Championship Series (best of 7), and the Diamond Series (best of 7). You can play, quick-play or sim each of your games. The top 2 seeds in each league skip the Wild Card round; "Sim to my first game" takes you to your first game.
- **Managing:** set your lineup, rotation, bullpen and closer, or leave Auto-manage on. You can call players up, send them down and make trades until the deadline. Injuries, rest days and fatigue are tracked. Relievers need rest too: nobody pitches three days in a row, and a long outing costs extra days off.
- **Offseason:** a season recap and awards (MVP, Cy Young, Rookie and Reliever of the Year), retirements, player growth (age plus how they played), re-signing your expiring players, a 5-round draft, and free agency. Then spring training starts again: young players can break out, and you set your Opening Day roster.
- **Player profiles:** ratings, season and career stats, a game log, and splits (vs. lefties and righties, home and away).

## Rules

- Extra innings: if the game is tied after the last inning, it continues for up to 3 extra innings and then ends in a tie.
- Walk-offs: the game ends as soon as the home team takes the lead in the last inning or later.
- Mercy rule: only in 9-inning games, a 10-run lead after 7 innings ends the game.
- The designated hitter is used, so pitchers don't bat.

Records are saved in your browser's localStorage. They show up under **Records** on the setup screen and include wins and losses by difficulty, personal bests and your last 10 games. A box score appears after every game.

## Code layout

```
index.html            page, HUD and menus
css/style.css         styling for menus and HUD
js/util.js            math and random helpers
js/data.js            difficulty table, pitch types, teams, roster generator
js/sim.js             contact model, batted-ball flight, fielding, throws and baserunning
js/game.js            rules (count, outs, innings, box score) and CPU decisions
js/render-bat.js      behind-the-batter view
js/rig.js             silhouette player rigs: skeleton, IK, keyframed animations
js/render-field.js    top-down field view that animates a play
js/audio.js           sound effects (Web Audio) and umpire calls (speech synthesis)
js/storage.js         settings and records (localStorage)
js/main.js            game loop, state machine, input and HUD
js/league.js          franchise league: teams, players, ratings, schedule
js/engine.js          league games: lineups, rest, headless sims, box scores
js/season.js          calendar, sims, stats, standings, leaders, phases
js/depth.js           injuries, rest, All-Star Game, awards
js/postseason.js      12-team bracket
js/offseason.js       retirements, growth, contracts, draft, free agency, spring
js/trades.js          trade values, evaluation, CPU trades
js/db.js              franchise save (IndexedDB)
js/fx.js              reactions, follow cam, replays, big-game presentation
js/ui/*.js            franchise screens, player profiles, box scores
tools/seasontest.js   one full simulated season with sanity checks
tools/franchisetest.js  several seasons including postseason and offseason
tools/simtest.js      headless stats check for the simulation
tools/measure.js      workload and WAR numbers for calibration (prints a report, checks nothing)
tools/checks.js       workload and WAR checks shared by seasontest and franchisetest
tools/poses.html      contact sheet of every animation keyframe (serve the repo and open it)
```

`sim.js` and `game.js` don't touch the DOM, so the simulation can be checked in Node:

```
node tools/simtest.js 300 medium
```

This plays 300 CPU-vs-CPU games and prints league stats (AVG, K%, HR%, runs per game, outcomes by ball type). Use it after changing the physics, fielding or contact numbers. On Medium it currently gives about 4.6 runs per team per game (the target is about 4.5), a .286 average, 19% strikeouts and 3.8% home runs.

Pitch types live in the `PITCHES` table in `js/data.js`, and each team's pitching staff is generated by `makeRoster` there.

The players are 2D skeletons. Each pose sets the hip, lean, torso turn, and hand and foot targets, and inverse kinematics places the elbows and knees. Animations are keyframes in `js/rig.js`, played through a smooth spline and blended into each other. To change a motion, edit the pose constants (`P_*` for the pitcher, `B_*` for the batter) and check the result in `tools/poses.html`.

To tune a difficulty, edit the `DIFFICULTIES` table at the top of `js/data.js`. `windows` is your swing timing window in milliseconds, `cpuSigma` is the CPU batter's timing error, and `playerControl` / `cpuCommand` set how far pitches miss their target.

See `DESIGN.md` for the design decisions behind the game.
