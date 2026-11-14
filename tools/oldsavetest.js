// Old-save check: loads a franchise saved by an earlier version (a JSON file
// of the league), plays on through the rest of the season, the postseason,
// the offseason and the next Opening Day, and checks that in-season form
// (form.js) starts neutral and then works.
// Run: node tools/oldsavetest.js path/to/save.json
'use strict';
const path = require('path');
const fs = require('fs');
for (const f of ['util', 'data', 'sim', 'game', 'league', 'engine', 'season', 'depth', 'postseason', 'offseason', 'trades', 'form', 'db']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const BB = globalThis.BB;
const S = BB.season;
let failures = 0;
const assert = (c, msg) => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!c) failures++;
};
(async () => {
  const L = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const players = Object.values(L.players);
  console.log(`loaded ${L.year} ${L.phase}, day ${L.day}, ${players.length} players`);
  assert(players.every((p) => !p.form && !p.notes) && !L.formFit, 'the save has no form fields (made before Milestone 2)');
  assert(players.every((p) => BB.form.value(p) === 0 && BB.form.status(L, p) === null), 'everyone loads with neutral form and no icon');
  await S.simUntil(L, { to: 'month' }, { includeUser: true });
  const hot = players.filter((p) => BB.form.status(L, p) === 'hot').length;
  const cold = players.filter((p) => BB.form.status(L, p) === 'cold').length;
  assert(hot > 0 && cold > 0, `a month later some players are hot (${hot}) and some cold (${cold})`);
  // Play one user game in quick mode, as from the Home screen.
  const t = S.today(L);
  if (t.userGame) {
    const r = S.startUserGame(L, t.userGame.id, 'quick');
    if (!r.done) S.finishUserGame(L, t.userGame.id, r.g);
    assert(L.games[t.userGame.id].status === 'final', 'a user game plays and records');
  }
  while (L.phase === 'regular') {
    await S.simUntil(L, { to: 'endPhase' }, { includeUser: true });
    if (S.phaseDone(L)) S.advancePhase(L);
  }
  const notes = Object.values(L.players).reduce((a, p) => a + (p.notes || []).length, 0);
  assert(notes > 0, `lasting changes leave profile notes (${notes})`);
  // Postseason, offseason (auto-deciding for the user), spring, Opening Day.
  const O = BB.offseason;
  const year = L.year;
  let guard = 0;
  while (L.phase === 'postseason' && guard++ < 50) {
    if (S.phaseDone(L)) S.advancePhase(L);
    else await S.simUntil(L, { to: 'endPhase' }, { includeUser: true });
  }
  while (L.phase === 'offseason' && L.offStep !== 'done' && guard++ < 100) {
    O.autoUser(L);
    O.advance(L);
  }
  if (L.phase === 'offseason') S.advancePhase(L);
  while (L.phase === 'spring' && !S.phaseDone(L) && guard++ < 150) await S.simUntil(L, { to: 'endPhase' }, { includeUser: true });
  if (L.phase === 'spring') {
    O.setOpeningDay(L, O.suggestRoster(L, S.userTeam(L)));
    S.advancePhase(L);
  }
  console.log(`now ${L.year} ${L.phase} (from ${year})`);
  assert(L.phase === 'regular' && L.formOpening && L.formOpening.year === L.year, `the next Opening Day (${L.year}) sets form from spring results (${L.formOpening && L.formOpening.hot} hot, ${L.formOpening && L.formOpening.cold} cold)`);
  JSON.parse(JSON.stringify(L));
  assert(true, 'the league still saves (JSON round trip)');
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
