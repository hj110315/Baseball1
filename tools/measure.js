// Season measurements for calibration: reliever and starter workloads, days
// pitched in a row, the WAR total and its split, WAR leaders and the awards.
// Run: node tools/measure.js [seasons=2] [seed=11]
// Prints a report per season. It checks nothing; seasontest and franchisetest
// hold the pass/fail checks.
'use strict';
const path = require('path');
for (const f of ['util', 'data', 'sim', 'game', 'league', 'engine', 'season', 'depth', 'postseason', 'offseason', 'trades', 'db']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const BB = globalThis.BB;
const S = BB.season;
const D = BB.depth;
const O = BB.offseason;

const SEASONS = Math.max(1, +(process.argv[2] || 2));
const SEED = +(process.argv[3] || 11);
D.rng = BB.U.seeded(SEED * 7 + 1);

const dayNum = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000);
const ip = (outs) => Math.floor(outs / 3) + '.' + (outs % 3);
const f1 = (x) => x.toFixed(1);
const pad = (s, n) => String(s).padEnd(n);

// Regular-season appearances by pitcher: { pid: [day numbers] } and games
// where a team's box score has no pitcher.
let appear = {};
let noPitcher = 0;
S.hooks.afterGame.push((L, gm, box) => {
  if (gm.type !== 'regular') return;
  const d = dayNum(gm.date);
  box.pit.forEach((side) => {
    if (!side.length) noPitcher++;
    side.forEach((line, k) => {
      if (!line.pid || k === 0) return; // relief appearances only
      (appear[line.pid] = appear[line.pid] || []).push(d);
    });
  });
});

function streaks(days) {
  // Returns { three: appearances on a 3rd (or later) straight day, max: longest run of days }.
  const set = new Set(days);
  let three = 0;
  let max = 0;
  for (const d of set) {
    if (set.has(d - 1) && set.has(d - 2)) three++;
    if (!set.has(d - 1)) {
      let n = 1;
      while (set.has(d + n)) n++;
      if (n > max) max = n;
    }
  }
  return { three, max };
}

function report(L) {
  const isP = D.isPitcher;
  const rows = [];
  for (const id in L.players) {
    const p = L.players[id];
    const s = p.stats.reg;
    if (!s.bat.pa && !s.pit.outs) continue;
    rows.push({ p, s, war: D.value(L, p), t: p.teamId ? S.team(L, p.teamId) : null });
  }
  let runs = 0;
  let games = 0;
  for (const t of L.teams) {
    runs += t.rec.rs;
    games += t.rec.w + t.rec.l;
  }
  console.log(`\n== ${L.year} regular season ==`);
  console.log(`runs per team-game ${(runs / games).toFixed(2)}; team box scores without a pitcher: ${noPitcher}`);

  // Relievers: under half of their games as starts.
  const rel = rows.filter((x) => isP(x.p) && x.s.pit.g > 0 && x.s.pit.gs < x.s.pit.g * 0.5);
  const sp = rows.filter((x) => isP(x.p) && x.s.pit.g > 0 && x.s.pit.gs >= x.s.pit.g * 0.5);
  const byIp = rel.slice().sort((a, b) => b.s.pit.outs - a.s.pit.outs);
  const byG = rel.slice().sort((a, b) => b.s.pit.g - a.s.pit.g);
  const line = (x) => `${pad(x.p.name, 16)} ${pad(x.t ? x.t.abbr : '-', 4)} ovr ${x.p.ovr}  ${pad(ip(x.s.pit.outs), 6)} IP  ${pad(x.s.pit.g, 3)} G  ${pad(x.s.pit.gs, 2)} GS  ${pad(x.s.pit.sv, 2)} SV  WAR ${f1(x.war)}`;
  console.log(`relievers: ${rel.length}; over 80 IP: ${rel.filter((x) => x.s.pit.outs > 240).length}, over 95 IP: ${rel.filter((x) => x.s.pit.outs > 285).length}, over 75 G: ${rel.filter((x) => x.s.pit.g > 75).length}`);
  console.log('  most innings:');
  byIp.slice(0, 8).forEach((x) => console.log('    ' + line(x)));
  console.log('  most games:');
  byG.slice(0, 5).forEach((x) => console.log('    ' + line(x)));
  // Workload by bullpen slot (1 = the team's best reliever by rating).
  const slots = [];
  for (const t of L.teams) {
    const pen = rel.filter((x) => x.t === t && x.s.pit.g >= 15).sort((a, b) => b.p.ovr - a.p.ovr);
    pen.slice(0, 8).forEach((x, i) => {
      const o = (slots[i] = slots[i] || { outs: 0, g: 0, n: 0 });
      o.outs += x.s.pit.outs;
      o.g += x.s.pit.g;
      o.n++;
    });
  }
  console.log('  average by bullpen slot (best to worst rating): ' + slots.map((o, i) => `#${i + 1} ${f1(o.outs / 3 / o.n)} IP/${Math.round(o.g / o.n)} G`).join(', '));
  // Days in a row.
  let three = 0;
  let pitchers3 = 0;
  let longest = 0;
  for (const pid in appear) {
    const st = streaks(appear[pid]);
    three += st.three;
    if (st.three) pitchers3++;
    if (st.max > longest) longest = st.max;
  }
  console.log(`  relief appearances on a 3rd straight day (or later): ${three} by ${pitchers3} pitchers; longest run ${longest} days`);

  // Starters.
  const spIp = sp.slice().sort((a, b) => b.s.pit.outs - a.s.pit.outs);
  console.log(`starters: top ${spIp.slice(0, 3).map((x) => `${x.p.name} ${ip(x.s.pit.outs)} IP/${x.s.pit.gs} GS`).join(', ')}; over 210 IP: ${sp.filter((x) => x.s.pit.outs > 630).length}`);
  const full = sp.filter((x) => x.s.pit.gs >= 28);
  if (full.length) console.log(`  starters with 28+ starts: ${full.length}, average ${f1(full.reduce((a, x) => a + x.s.pit.outs, 0) / 3 / full.length)} IP, ${f1(full.reduce((a, x) => a + x.s.pit.outs / 3 / x.s.pit.gs, 0) / full.length)} IP per start`);

  // WAR.
  const hit = rows.filter((x) => !isP(x.p));
  const pit = rows.filter((x) => isP(x.p));
  const sum = (a) => a.reduce((t, x) => t + x.war, 0);
  const total = sum(rows);
  console.log(`WAR total ${f1(total)}: hitters ${f1(sum(hit))} (${Math.round((100 * sum(hit)) / total)}%), pitchers ${f1(sum(pit))} (${Math.round((100 * sum(pit)) / total)}%); starters ${f1(sum(sp))}, relievers ${f1(sum(rel))}`);
  const top = rows.slice().sort((a, b) => b.war - a.war);
  console.log('  top 10:');
  top.slice(0, 10).forEach((x) => console.log(`    ${pad(x.p.name, 16)} ${pad(x.p.pos, 3)} ${pad(x.t ? x.t.abbr : '-', 4)} ovr ${x.p.ovr} age ${x.p.age}  WAR ${pad(f1(x.war), 5)} ${D.statLine(x.p)}`));
  console.log(`  players at 8+: ${top.filter((x) => x.war >= 8).length}, at 11+: ${top.filter((x) => x.war >= 11).length}; best pitcher ${f1(pit.reduce((m, x) => Math.max(m, x.war), 0))}, best reliever ${f1(rel.reduce((m, x) => Math.max(m, x.war), 0))}`);

  // Awards.
  const aw = L.awards || D.computeAwards(L, { dry: true });
  for (const lg of aw.leagues) {
    for (const [label, a] of [['MVP', lg.mvp], ['Cy Young', lg.cy], ['Rookie', lg.roy], ['Reliever', lg.rel]]) {
      if (!a) continue;
      const p = L.players[a.pid];
      const q = p.stats.reg.pit;
      const extra = isP(p) ? `${ip(q.outs)} IP, ${q.g} G, ${q.gs} GS` : `${p.stats.reg.bat.pa} PA, OPS ${S.calc(p.stats.reg).ops.toFixed(3)}`;
      console.log(`  ${pad(lg.name.split(' ')[0], 10)} ${pad(label, 9)} ${pad(a.name, 16)} ${pad(a.pos, 3)} ovr ${p.ovr} age ${p.age}  WAR ${pad(a.war, 5)} ${a.line} (${extra})`);
    }
  }
  // Rookies against everyone else, to tell a formula problem from strong rookies.
  const reg = hit.filter((x) => x.s.bat.pa >= 400);
  const rk = reg.filter((x) => x.p.rookie);
  const avg = (a, f) => (a.length ? a.reduce((t, x) => t + f(x), 0) / a.length : 0);
  console.log(`  hitters with 400+ PA: ${reg.length} (avg ovr ${f1(avg(reg, (x) => x.p.ovr))}, avg WAR ${f1(avg(reg, (x) => x.war))}); rookies among them: ${rk.length} (avg ovr ${f1(avg(rk, (x) => x.p.ovr))}, avg WAR ${f1(avg(rk, (x) => x.war))})`);
  const rkAll = rows.filter((x) => x.p.rookie).sort((a, b) => b.war - a.war);
  console.log(`  rookies with stats: ${rkAll.length}; best: ${rkAll.slice(0, 4).map((x) => `${x.p.name} ${x.p.pos} ovr ${x.p.ovr} age ${x.p.age} WAR ${f1(x.war)}`).join('; ')}`);
}

(async () => {
  const L = S.newFranchise({ userTeamId: 'LAK', difficulty: 'medium', seed: SEED });
  for (let season = 0; season < SEASONS; season++) {
    while (!S.phaseDone(L)) S.simDay(L);
    O.setOpeningDay(L, O.suggestRoster(L, S.userTeam(L)));
    S.advancePhase(L);
    appear = {};
    noPitcher = 0;
    while (!S.phaseDone(L)) S.simDay(L);
    report(L);
    S.advancePhase(L);
    let guard = 0;
    while (!S.phaseDone(L) && guard++ < 80) S.simDay(L);
    S.advancePhase(L);
    let steps = 0;
    while (L.offStep !== 'done' && steps++ < 30) {
      if (L.offStep === 'draft') O.simDraft(L, {});
      O.autoUser(L);
      O.advance(L);
    }
    S.advancePhase(L);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
