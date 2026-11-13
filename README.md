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
- **Pitching:** pick a pitch (`1` Fastball, `2` Curve, `3` Change-up), then tap where in the zone to throw it. The dotted ring shows how far the pitch can miss. It grows with harder difficulty and as your pitcher tires. Mixing speeds fools the CPU: a change-up right after a fastball makes hitters swing early.
- **Stealing:** with a runner on base and the next base open, tap **STEAL** (or press `S`) before the pitch.
- **Tagging up:** after a catch in the outfield you choose whether the lead runner tags up (`Y` to send, `N` to hold).
- Fielding and the rest of the baserunning are automatic. Tap the field view or press `Space` to speed it up.
- `P` or `Esc` pauses and `M` mutes.

| Difficulty | Pitch speed | Timing window | Hints | CPU hitters |
|------------|-------------|---------------|-------|-------------|
| Easy       | Slow        | Wide          | Pitch type, plus a ring where the pitch will cross | Chase a lot |
| Medium     | Medium      | Medium        | Pitch type at release | Average |
| Hard       | Fast        | Tight         | None until after the pitch | Patient, more power |

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
js/render-field.js    top-down field view that animates a play
js/audio.js           sound effects (Web Audio) and umpire calls (speech synthesis)
js/storage.js         settings and records (localStorage)
js/main.js            game loop, state machine, input and HUD
tools/simtest.js      headless stats check for the simulation
```

`sim.js` and `game.js` don't touch the DOM, so the simulation can be checked in Node:

```
node tools/simtest.js 400 medium
```

This plays 400 CPU-vs-CPU games and prints league stats (AVG, K%, HR%, runs per game, outcomes by ball type). Use it after changing the physics, fielding or contact numbers. On Medium it currently gives about 4.3 runs per team per game, a .280 average, 19% strikeouts and 3% home runs.

To tune a difficulty, edit the `DIFFICULTIES` table at the top of `js/data.js`. `windows` is your swing timing window in milliseconds, `cpuSigma` is the CPU batter's timing error, and `playerControl` / `cpuCommand` set how far pitches miss their target.

See `DESIGN.md` for the design decisions behind the game.
