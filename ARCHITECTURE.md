# Diamond Dash architecture

A browser game with no build step. Every file is a plain script that attaches to the global `BB` namespace and loads from `index.html` in a fixed order. The game must keep working when opened straight from disk (`file://`), so: no ES modules, no web workers, no fetch of local files.

Logic files never touch the DOM, so Node can run them for tests (they attach to `globalThis`): `util`, `data`, `sim`, `game`, `league`, `engine`, `season`, `depth`, `postseason`, `offseason`, `trades`.

## Files and owners

| File | Owner | What it does |
|------|-------|--------------|
| `js/util.js` | core | math, RNG helpers, `U.fmtDate` |
| `js/data.js` | core | difficulty table, pitch types, exhibition teams, `makeRoster` (exhibition only) |
| `js/sim.js` | core | contact model, batted-ball flight, fielding, throws, baserunning |
| `js/game.js` | core | one game's rules and state, CPU decisions (pitch choice, swings, steals, bullpen) |
| `js/league.js` | core | 30 teams, player generation, ratings, ratings→sim adapters, contracts, schedule |
| `js/engine.js` | core | builds a game from league teams, headless game sim, box scores, decisions (W/L/S) |
| `js/season.js` | core | calendar, day advance, sim-to, recording results, standings, leaders, phases, hooks |
| `js/db.js` | core | save/load the franchise (IndexedDB, falls back to localStorage) |
| `js/depth.js` | depth agent | injuries, rest and fatigue, rotation/bullpen usage, CPU roster moves, All-Star game, awards |
| `js/postseason.js` | depth agent | 12-team bracket, series, clinching, champion |
| `js/offseason.js` | depth agent | retirements, progression, contracts/re-signing, free agency, draft, spring training |
| `js/trades.js` | depth agent | trade values, evaluating offers, executing trades, CPU-to-CPU trades |
| `js/ui/ui.js` | core | franchise UI framework: root, router, header, tabs, modal, toast, progress, helpers |
| `js/ui/screens-core.js` | UI agent | home (next game), schedule/results, standings, leaders, roster/lineup/rotation, team stats, news |
| `js/ui/profile.js` | UI agent | player profile modal |
| `js/ui/boxscore.js` | UI agent | box score view |
| `js/ui/screens-season.js` | depth agent | postseason bracket, All-Star, awards, injury report |
| `js/ui/screens-offseason.js` | depth agent | offseason flow: awards recap, retirements, progression report, re-sign, draft, free agency, trades, spring training cuts |
| `js/storage.js` | core | exhibition settings and records (localStorage) |
| `js/audio.js` | core | sound |
| `js/rig.js` | animation agent | skeleton player rigs and animations |
| `js/render-bat.js` | animation agent | behind-the-batter view |
| `js/render-field.js` | animation agent | top-down field view |
| `js/fx.js` | animation agent | presentation: reactions, follow cam, replays, postseason dressing |
| `js/main.js` | shared (small hooks only) | game loop, playable game, HUD, exhibition menu |
| `css/style.css` | core | base and exhibition styles |
| `css/ui.css` | core | franchise framework styles |
| `css/ui-core.css` | UI agent | core screen styles |
| `css/ui-offseason.css` | depth agent | season and offseason screen styles |
| `css/fx.css` | animation agent | presentation overlays |

Every file in this table already exists, at least as a stub, and `index.html` already loads them all in this order: util, data, sim, game, league, engine, season, depth, postseason, offseason, trades, db, storage, audio, rig, render-bat, render-field, fx, ui/ui, ui/screens-core, ui/profile, ui/boxscore, ui/screens-season, ui/screens-offseason, main. **Don't add or reorder script tags.** Put new code in the files you own. When you must touch a shared file (`main.js`, `game.js`, `index.html`), keep it to small hook calls and say so in your report.

## The league (saved as one object)

```js
league = {
  version: 1,
  year: 2027,                 // season label
  phase: 'spring' | 'regular' | 'postseason' | 'offseason',
  offStep: null | string,     // offseason sub-step, owned by offseason.js
  day: 0,                     // index into days (the next day to be played)
  days: [{ date: '2027-03-01', phase: 'spring'|'regular'|'postseason', games: [gid], event: null|'allstar'|'off' }],
  games: { [gid]: Game },     // this season's games (spring, regular, All-Star, postseason)
  userTeamId: 'HAW',
  difficulty: 'easy'|'medium'|'hard',   // only for games the user plays
  teams: [Team],              // 30, see BB.league.TEAMS for ids and divisions
  players: { [pid]: Player }, // everyone: rostered, reserves, free agents, draft prospects (retired players are removed)
  nextPid: 1, nextGid: 1,
  news: [{ date, text, kind, teamId }],      // newest first, capped at 300
  history: [{ year, champion, runnerUp, awards, records }],
  awards: null | object,      // current season, set by depth.js
  allStar: null | object,     // set by depth.js
  post: null | object,        // bracket, set by postseason.js
  draft: null | object,       // set by offseason.js
  freeAgents: [pid],
  settings: { autoManage: true },          // CPU handles your lineup and depth chart unless you edit them
}

Team = {
  id, city, name, abbr, color, color2, league: 0|1, div: 0|1|2, market: 1|2|3, budget,   // budget in $M
  roster: [pid],              // active, max 26 (13 position players + 13 pitchers)
  reserves: [pid],            // minors / prospects, max 14
  il: [pid],                  // injured list (not counted in the 26)
  lineup: [{ pid, pos }],     // 9 batting order spots; pos is the fielding spot or 'DH'
  rotation: [pid],            // 5 starters
  rotIdx: 0,                  // who starts next
  bullpen: [pid],             // relievers
  closer: pid,
  // Payroll: BB.league.payroll(L, team) is the one total (roster + il + reserves + deadMoney); BB.offseason.orgPayroll is the same function.
  deadMoney: [{ pid, name, salary, years }],   // released players still being paid; years tick down at the offseason re-sign step
  rec: { w, l, rs, ra, hw, hl, aw, al, streak, last: [] },  // regular season; last = last 10 as 1/0
  springRec: { w, l },
  manual: false,              // true once the user edits the lineup/depth chart (stops auto-manage)
}

Player = {
  id: 'p12', first, last, name,          // name = 'J. Rivera'
  age, bats: 'L'|'R'|'S', throws: 'L'|'R',
  pos: 'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF'|'DH'|'SP'|'RP',
  num, teamId: 'HAW'|null,
  status: 'active'|'reserve'|'il'|'fa'|'prospect',
  r: { con, pow, eye, spd, fld, arm }    // hitters, 20..99
   | { vel, ctl, sta, stf },             // pitchers, 20..99
  arsenal: [{ key, q }],                 // pitchers: pitch keys from BB.PITCHES, q ~0.85..1.15
  pot: 20..99,                           // potential (ceiling)
  ovr: 20..99,                           // cached overall; refresh with BB.league.refreshOvr(p)
  look: { body, stance, windup, celebrate },   // see "Looks" below
  contract: { years, salary },           // salary in $M per year
  injury: null | { days, desc },
  fatigue: 0..1,                         // position players: playing every day wears them down
  arm: { rest, last, streak },           // pitchers: days since last appearance (1 = yesterday), pitches thrown then, days in a row that appearance made (missing in old saves = 1)
  draft: null | { year, round, pick, teamId },
  rookie: true|false,                    // true during the first big-league season
  stats: { reg: Stat, post: Stat, spring: Stat },
  career: [{ year, teamId, reg: Stat, post: Stat }],    // finished seasons
  log: [LogEntry],                       // this season (capped: 170 for the user's team, 15 otherwise)
}

Stat = {
  bat: { g, gs, pa, ab, r, h, d, t, hr, rbi, bb, k, sb, cs },
  pit: { g, gs, outs, h, r, er, bb, k, hr, w, l, sv, pitches },
  vsL: { pa, ab, h, d, t, hr, bb, k },   // as a batter vs left-handed pitchers (pitchers: vs left-handed batters)
  vsR: { ... same },
  home: { pa, ab, h, d, t, hr, bb, k }, away: { ... same },
}
LogEntry = { gid, date, type, opp: 'HAW', home: true, res: 'W 5-3',
             bat: [ab, h, hr, rbi, bb, k] | null, pit: [outs, h, er, bb, k, dec] | null }   // dec: 'W'|'L'|'S'|''

Game = {
  id: 'g7', type: 'spring'|'regular'|'allstar'|'post', day, date, away: teamId, home: teamId,
  status: 'scheduled'|'final', score: [away, home], innings,
  wp, lp, sv,                // pids or null
  box: null | Box,           // kept for the user's games and the last 3 days of everyone's
  series: null | { id, round, gameNum },   // postseason
}

Box = {
  score: [a, h], hits: [a, h], line: [[runs per inning], [...]], innings,
  bat: [[{ pid, name, pos, ab, r, h, d, t, hr, rbi, bb, k, sb, cs }], [...]],    // [away, home] in batting order
  pit: [[{ pid, name, outs, h, r, er, bb, k, hr, pitches, dec }], [...]],
  wp, lp, sv, log: [string],  // play-by-play text (user games only)
}
```

Derived stats (AVG, OBP, SLG, OPS, ERA, WHIP, K/9, IP) come from `BB.season.calc(stat)`. Don't store them.

## Ratings in the simulation

`BB.league` turns ratings into the numbers `game.js` and `sim.js` already use:

60 is an average big-leaguer. `mult(r, slope) = 1 + soft(r - 60) * slope`, where `soft` counts each point past ±12 as half (elite ratings help without breaking the game).
- Batters: `contact = mult(con, 0.0042)`, `power = mult(pow, 0.0045)`, `speed = mult(spd, 0.004)`, `eye = mult(eye, 0.006)` (higher eye = fewer chases).
- Fielders: per-position defense `{ q: mult(fld, 0.0025), arm: mult(arm, 0.0025) }` passed to `BB.sim.makeDefense`.
- Pitchers: `velo = soft(vel-60)*0.09` mph above the difficulty's base fastball (harder throwers are harder to time), `control = 2 - mult(ctl, 0.0045)` (multiplies location error), stamina in pitches (starters `68 + sta*0.32`, relievers `12 + sta*0.3`, less on short rest), and each pitch's `q` scaled by `mult(stf, 0.0022)`.
- League batters' `contact` is also multiplied by `LEAGUE_CONTACT = 1.015` (league.js): the league's run-environment knob, added when the bullpen rules cut scoring.
- Calibration (`node tools/seasontest.js`): about 4.5 runs per team-game, .285 league AVG, best teams ~100 wins, worst ~55-65.

## Looks (for the animation agent)

Every game batter and pitcher object carries `look`:

```js
look = {
  body: 'lean'|'athletic'|'stocky'|'tall',
  stance: 'upright'|'crouch'|'open'|'highHands',          // batting stance
  windup: 'classic'|'overTop'|'sidearm'|'highKick',       // pitching delivery
  celebrate: 'flip'|'point'|'fist'|'admire',              // home run reaction
}
```

League players get a look when they're generated, and exhibition rosters (`BB.makeRoster`) get one too. Code must handle a missing `look` (default `{ body: 'athletic', stance: 'upright', windup: 'classic', celebrate: 'admire' }`).

## One game: `BB.game`

`BB.game.createGame(opts)` accepts either form:
- **Exhibition (old):** `{ innings, difficulty, playerHome, player: { name, abbr, color, roster }, cpu: {...} }`
- **League:** `{ innings, difficulty, away: TeamDef, home: TeamDef, userSide: 'away'|'home'|null, meta }`, where `TeamDef = { id, name, abbr, color, lineup: [GameBatter x9], staff: [GamePitcher], defense }`. `staff[0]` starts, and `defense` maps positions (`P C 1B 2B SS 3B LF CF RF`) to `{ q, arm }`.

`GameBatter = { pid, name, pos, num, hand, bats, contact, power, speed, eye, look, slot }`. `hand` is the side they bat from in this game; switch hitters (`bats: 'S'`) are refreshed against each new pitcher.
`GamePitcher = { pid, name, pos: 'P', role: 'SP'|'RP'|'CL', num, hand, velo, control, stamina, arsenal, look }`. League relievers also carry `pen: 'CL'|'SU'|'MR'` (today's bullpen role), `rest` (days since they last pitched), `ovr` and `load` (outs pitched this season) for the CPU manager; exhibition pitchers don't, and the code must handle them missing.
`g.paHalf` counts the plate appearances finished in the current half-inning (0 = nobody has batted yet).

`g.meta = { type: 'exhibition'|'spring'|'regular'|'allstar'|'post', gameId, round, gameNum, seriesText, label }` is used for presentation, for example "Diamond Series · Game 7".
`g.playerIdx` is the user's team index (0 away, 1 home), or `-1` when nobody plays (headless).
Pitcher decisions are tracked during the game: `g.decisions = { w, l, sv }` (pids), filled in when the game ends.

## Engine: `BB.engine`

- `teamDef(league, team, { starterPid, forDay })` → TeamDef (lineup with resting players swapped out, today's starter, available bullpen).
- `bullpenFor(league, team, starterPid)` → `[{ p, pen }]`: today's available relievers with their roles, middle relief first and the closer last. `relieverReady(p)` and `restNeeded(pitches)` are the rest rules (see "Bullpen workload" below).
- `createGame(league, game, { userSide })` → `g` (a `BB.game` state, `g.meta` filled in).
- `runHeadless(g, { stopAtInning, rng })` → simulates pitch by pitch with CPU decisions for both sides. Stops when the game ends or at the top of `stopAtInning` (at a half-inning boundary, ready for interactive play). Returns `g`.
- `finishHeadless(g)` → simulates the rest of a game already in progress, from a pitch boundary.
- `isKeyMoment(g)` → true from the 7th inning on when the score is within 3 runs (or in extra innings).
- `box(g)` → Box.
- `simGame(league, game)` → Box (createGame + runHeadless + box).

## Season: `BB.season`

- `newFranchise({ userTeamId, difficulty, teamName?, color?, seed? })` → league (phase 'spring', calendar built).
- `today(league)` → `{ day, date, phase, event, games: [Game], userGame: Game|null }`.
- `simDay(league, { includeUser: true })` → sims every unplayed game today, records them, runs day hooks, and moves to the next day. Returns `{ results: [Game] }`.
- `simUntil(league, target, { onProgress(frac, label), shouldStop() })` → Promise. Targets: `{ to: 'nextUserGame' | 'day' | 'week' | 'month' | 'allstar' | 'endRegular' | 'endPhase' | 'date', date }`. Yields to the browser between days and stops early before a user game when `stopAtUserGame` is set.
- `startUserGame(league, gameId, mode)` → `{ g }` ready to play. Mode `'play'` starts from the first pitch. Mode `'quick'` sims to the first key moment; if none comes, the game is finished and recorded and the result is `{ done: true, box }`.
- `finishUserGame(league, gameId, g)` → records a game the user played (or simmed to the end) and moves on to the next day if every game today is done.
- `recordGame(league, game, box)` updates team records, player stats, splits and logs, then runs `hooks.afterGame`.
- `standings(league)` → `[{ name, divisions: [{ name, rows }], wildcard: rows }]`. A row is `{ team, w, l, pct, gb, wcgb, rs, ra, diff, home, away, last10, streak, clinch }`.
- `leaders(league, { stat, phase: 'reg', lg: 0|1|null, limit, qualified: true })` → `[{ player, team, value }]`. Stats include avg, hr, rbi, ops, sb, r, h, era, w, k, sv, whip.
- `calc(stat)` → derived numbers (avg, obp, slg, ops, era, whip, k9, ip text).
- `teamOf(league, pid)`, `player(league, pid)`, `team(league, id)`, `userTeam(league)`.
- `advancePhase(league)` → runs the current phase's `end` and the next phase's `start`. Phase handlers live in `BB.season.phases = { spring, regular, postseason, offseason }`, each `{ start(league), end(league), done(league) }`. The core has simple versions; depth agent files replace `postseason` and `offseason` and extend `spring`.
- `hooks = { afterGame: [], afterDay: [], beforeDay: [] }`. Depth code pushes functions `(league, ...)` here.
- `addNews(league, text, kind, teamId)`.

## Persistence: `BB.db`

`BB.db.save(league)` and `BB.db.load()` return Promises; `BB.db.clear()` deletes the save. The franchise is saved after every day and every user game.

## UI framework: `BB.ui` (js/ui/ui.js)

The franchise screens live in `#franchise`, a full-screen page above the canvas. The playable game reuses the existing canvas and HUD.

- `BB.ui.register(id, { title, tab, render(el, params) })`. `tab` puts the screen in the top nav: 'Home', 'Schedule', 'Standings', 'Leaders', 'Team', 'League'.
- `BB.ui.go(id, params)`, `BB.ui.back()`, `BB.ui.refresh()`.
- `BB.ui.league()` returns the loaded league; `BB.ui.save()` saves it (debounced).
- `BB.ui.modal({ title, body, wide, onClose })` returns `{ el, close }`. `body` can be an HTML string or a node.
- `BB.ui.toast(text)`, `BB.ui.confirm(text) → Promise<bool>`.
- `BB.ui.progress.show(label)`, `.update(frac, label)`, `.hide()`, `.cancelled()`.
- Helpers: `BB.ui.esc(s)`, `BB.ui.teamChip(team)`, `BB.ui.playerLink(p)` (opens the profile), `BB.ui.table({ cols, rows, sortable })`, `BB.ui.fmt.avg(x)` / `.era(x)` / `.ip(outs)` / `.pct(x)` / `.money(m)` / `.date(iso)`.
- `BB.ui.openPlayer(pid)`, `BB.ui.openBox(gid)`: the UI agent implements these in profile.js and boxscore.js.
- `BB.ui.playGame(gameId, mode)`: the UI agent implements it. It hands the game to the playable view; when that game ends, it records the result and returns to the hub.

## Playable game hooks in main.js

- `window.DD.playLeagueGame(g, { onDone(g), allowSimToEnd: true })` starts the playable view with an existing game state (at the first pitch or a half-inning boundary) and calls `onDone` instead of showing the exhibition game-over screen. The UI agent adds it.
- Presentation hooks for the animation agent go through `BB.fx` (see fx.js). main.js only calls `BB.fx.*` at a few points.

## Testing

- `node tools/simtest.js 300 medium`: gameplay-physics stats check (about 4.6 runs per team per game; the target is about 4.5).
- `node tools/seasontest.js`: generates a league, sims a full season, and prints timing and stat sanity checks.
- `node tools/franchisetest.js`: depth agent; full multi-season loop including postseason and offseason.
- Browser checks use Playwright against `python3 -m http.server`. Use a different port per agent (core 8765, UI 8766, depth 8767, animation 8768).

## Core implementation notes (read these before building on the core)

- **Custom game types:** `BB.season.customGames[type] = { create(L, game, { userSide }) → g, sim(L, game) → { g, box }, record(L, game, box, g) → true if fully handled }`. Use this for the All-Star Game: its teams aren't league teams. Build TeamDefs yourself with `BB.league.toGameBatter`, `toGamePitcher` and `fieldDef`, then call `BB.game.createGame({ away, home, userSide, meta })`.
- A game counts as the user's when `game.home`/`game.away` is the user's team, or when `game.meta.userPlays` is true. `game.meta.userSide` ('away'|'home') then says which side the user controls. `game.meta` is copied into `g.meta`, so set `label`, `round`, `gameNum`, `seriesText` and `clinch` there for the presentation layer.
- **Recording** sets `game.status`, score, decisions and box, updates regular-season team records (`rec`) or spring records (`springRec`), and moves the rotation pointer. Postseason series bookkeeping is up to postseason.js (use `hooks.afterGame`). Stats go to `p.stats.reg` / `.post` / `.spring` by game type. All-Star games record no stats unless a custom handler does it.
- **Rest:** every pitcher who appears goes through `BB.league.markPitched(p, pitches)`: `arm.rest = 0`, `arm.last = pitches`, and `arm.streak` counts days in a row. At the end of each day every player's `arm.rest` goes up by 1 (max 9). Starters need `rest >= 4` to start. Relievers follow the bullpen workload rules below.
- **Bullpen workload** (engine.js `bullpenFor`, game.js `cpuPitchingChange` and `pickReliever`; decisions in DESIGN.md):
  - Ready today: not on a third straight day (`rest === 1 && streak >= 2`), and `rest >= restNeeded(last)` (1, 2, 3 or 4 for outings up to 20, 35, 50 or more pitches). With fewer than 3 ready arms, the least-tired others are added, never one on a third straight day.
  - Roles today, from the ready arms ranked by rating (minus 8 for an arm that pitched yesterday): the team's closer if he's ready, else the top arm, is `CL`; the next two are `SU`; the rest `MR`.
  - `cpuPitchingChange(g, force)` changes pitchers when the current one is tired or shelled (as before), and between innings (`g.paHalf === 0`): the closer starts a save inning (last inning or later, lead 0–3); a setup man starts the two innings before it in a close game (lead −1 to 3), one inning each; and with 5 or more arms left a starter at 85% of his stamina doesn't start the 7th (65% for the 8th and 9th). A starter with a shutout and pitches left stays in.
  - `pickReliever(avail, want, close)` picks within the wanted role (falling back to the next role): freshest first in a close game, then the higher rating; otherwise any arm with a day off, fewest season outs (`load`) first. Position-player `fatigue` isn't changed by the core: depth.js owns it (raise it for games played, lower it on rest days). The engine rests a regular whose fatigue is above 0.85.
- **Depth charts:** `BB.league.autoManage(L, team, force)` runs for every team at the start of each day. For a team with `manual: true` (the user edited their lineup or depth chart), it only repairs what's broken (injured or missing players). `BB.season.ensureRoster` calls up reserves when a team is short of healthy hitters (fewer than 10) or pitchers (fewer than 11). Moving injured players onto `team.il` and back is up to depth.js.
- **Days:** `startDay` (once per day: `ensureRoster`, `autoManage`, `hooks.beforeDay`), then games, then `endDay` (`hooks.afterDay`, rest, prune old boxes, `L.day++`). `simUntil` stops before a day with an unplayed user game unless `includeUser: true`, and stops at the end of the phase. The UI then calls `BB.season.advancePhase(L)` when the user chooses to continue.
- **Postseason queries** (`BB.post`): `userStatus(L)` → `{ state: 'out'|'bye'|'alive'|'eliminated'|'champion', text, series, seed }` (`'bye'` also covers the days between rounds), `nextUserGame(L)`, and `userAlive(L)` → true while the user's team is still playing. The screens use `userAlive` to make multi-day sims stop at the user's postseason games (`simUntil` with `includeUser: false`) and to ask before simming to the end.
- **Phase order:** spring → regular → postseason → offseason → spring. Each phase handler has `start/end/done`. The core's postseason and offseason handlers are placeholders (best record wins; the offseason archives stats, ages everyone by a year and starts the next year). `BB.season.archiveSeason(L)` moves stats into careers and clears them.
- **Game engine extras:** `BB.game.cpuPitchingChange(g, force)` (force also manages the user's staff during simulated stretches), `g.decisions = { w, l, sv }` (pitcher objects) once the game ends, `g.meta`, ghost runner in regular and spring extra innings, and no innings cap in league games.
- **UI framework extras:** `BB.ui.show(league, screen, params)`, `BB.ui.hide()`, `BB.ui.exit()` (calls `BB.ui.onExit`, which main.js should set to return to the main menu), `BB.ui.runSim(target, { includeUser, label })` (progress overlay, save, refresh), and `BB.ui.rating(v)` (colored rating). Click delegation: `[data-pid]` opens a player, `[data-gid]` opens a box score, `[data-team]` goes to the `teamPage` screen if one is registered, and `[data-go="screenId"]` with optional `data-params='{"k":1}'` navigates. Add `data-nolink` to stop that. Tables come from `BB.ui.table(...)` and return an element.
- **Ratings scale:** 60 is an average big-leaguer (see "Ratings in the simulation"). Generated lineups average about 60–62, rotations about 62, bullpens about 58.
