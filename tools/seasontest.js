// Headless franchise check: builds a league, plays spring training and a full
// 162-game season, and prints timing and sanity checks.
// Run: node tools/seasontest.js [seed]
'use strict';
const path = require('path');
for (const f of ['util', 'data', 'sim', 'game', 'league', 'engine', 'season', 'depth', 'postseason', 'offseason', 'trades', 'form', 'db']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const BB = globalThis.BB;
const S = BB.season;
const seed = +(process.argv[2] || 7);
// Workload and WAR checks (tools/checks.js).
const checks = require('./checks.js');
const track = checks.tracker(BB);

(async () => {
  let t0 = Date.now();
  const L = S.newFranchise({ userTeamId: 'HAW', difficulty: 'medium', seed });
  console.log(`league built in ${Date.now() - t0} ms: ${L.teams.length} teams, ${Object.keys(L.players).length} players`);
  const sizes = L.teams.map((t) => t.roster.length);
  console.log(`roster sizes ${Math.min(...sizes)}-${Math.max(...sizes)}, lineups ${L.teams.every((t) => t.lineup.length === 9)}, rotations ${L.teams.every((t) => t.rotation.length === 5)}`);

  t0 = Date.now();
  await S.simUntil(L, { to: 'endPhase' }, { includeUser: true });
  console.log(`spring: ${L.days.length} days in ${Date.now() - t0} ms; ${L.teams[0].abbr} ${L.teams[0].springRec.w}-${L.teams[0].springRec.l}`);
  S.advancePhase(L);
  console.log(`phase ${L.phase}: ${L.days.length} days, ${L.days.reduce((a, d) => a + d.games.length, 0)} games`);
  const fo = L.formOpening || { hot: 0, cold: 0 };
  console.log(`Opening Day form (from spring results): ${fo.hot} hot, ${fo.cold} cold`);
  const formOk = fo.hot > 0 && fo.cold > 0;
  const perTeam = {};
  for (const d of L.days) for (const id of d.games) { const g = L.games[id]; perTeam[g.home] = (perTeam[g.home] || 0) + 1; perTeam[g.away] = (perTeam[g.away] || 0) + 1; }
  const gp = Object.values(perTeam);
  console.log(`games per team ${Math.min(...gp)}-${Math.max(...gp)}`);

  // Play the first user game in quick mode to exercise that path.
  const t = S.today(L);
  if (t.userGame) {
    const r = S.startUserGame(L, t.userGame.id, 'quick');
    if (r.done) console.log('quick game: no key moment, finished', r.box.score.join('-'));
    else {
      console.log(`quick game: key moment in inning ${r.g.inning} (${r.g.teams[0].runs}-${r.g.teams[1].runs}); finishing headless`);
      S.finishUserGame(L, t.userGame.id, r.g);
    }
  }
  t0 = Date.now();
  await S.simUntil(L, { to: 'endPhase' }, { includeUser: true });
  const ms = Date.now() - t0;
  console.log(`regular season simmed in ${(ms / 1000).toFixed(1)} s`);
  const st = S.standings(L);
  for (const lg of st) {
    console.log(lg.name);
    for (const d of lg.divisions) console.log('  ' + d.name.padEnd(8) + d.rows.map((r) => `${r.team.abbr} ${r.w}-${r.l}`).join('  '));
  }
  const allW = L.teams.map((t) => t.rec.w + t.rec.l);
  console.log(`team games ${Math.min(...allW)}-${Math.max(...allW)}; best ${Math.max(...L.teams.map((t) => t.rec.w))} wins, worst ${Math.min(...L.teams.map((t) => t.rec.w))}`);
  let runs = 0; let games = 0;
  for (const t of L.teams) { runs += t.rec.rs; games += t.rec.w + t.rec.l; }
  console.log(`runs per team-game ${(runs / games).toFixed(2)}`);
  for (const stat of ['avg', 'hr', 'rbi', 'sb', 'era', 'w', 'k', 'sv']) {
    const top = S.leaders(L, { stat, limit: 1 })[0];
    if (top) console.log(`  leader ${stat.padEnd(4)} ${top.player.name.padEnd(16)} ${top.team.abbr} ${typeof top.value === 'number' && top.value < 1 && stat !== 'era' ? top.value.toFixed(3) : top.value.toFixed ? +top.value.toFixed(2) : top.value}`);
  }
  // League batting line
  let ab = 0, h = 0, hr = 0, pa = 0, k = 0, bb = 0;
  for (const id in L.players) { const s = L.players[id].stats.reg.bat; ab += s.ab; h += s.h; hr += s.hr; pa += s.pa; k += s.k; bb += s.bb; }
  console.log(`league AVG ${(h / ab).toFixed(3)} HR% ${(100 * hr / pa).toFixed(1)} K% ${(100 * k / pa).toFixed(1)} BB% ${(100 * bb / pa).toFixed(1)}`);
  const u = S.userTeam(L);
  const star = u.lineup.map((e) => L.players[e.pid])[2];
  console.log(`user ${u.abbr} ${u.rec.w}-${u.rec.l}; #3 hitter ${star.name} log ${star.log.length} games, vsL PA ${star.stats.reg.vsL.pa}, vsR PA ${star.stats.reg.vsR.pa}`);
  const json = JSON.stringify(L);
  console.log(`save size ${(json.length / 1e6).toFixed(2)} MB`);
  // Workload and WAR checks, before the stats are archived.
  const results = checks.check(BB, L, track);
  for (const r of results) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.text}`);
  results.push({ ok: formOk, text: `some players start the season hot (${fo.hot}) and some cold (${fo.cold})` });
  const notes = {};
  for (const id in L.players) for (const n of L.players[id].notes || []) notes[n.kind] = (notes[n.kind] || 0) + 1;
  console.log(`lasting changes this season: ${JSON.stringify(notes)}`);
  const failed = results.filter((r) => !r.ok).length;
  // Roll into the offseason and the next spring with the stand-in phases.
  S.advancePhase(L);
  while (!S.phaseDone(L)) await S.simUntil(L, { to: 'endPhase' }, { includeUser: true });
  S.advancePhase(L);
  S.advancePhase(L);
  console.log(`now ${L.year} ${L.phase}; career rows for #3 hitter: ${star.career.length}`);
  if (failed) {
    console.log(`\n${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nall checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
// (appended) top hitters' ratings, for tuning
