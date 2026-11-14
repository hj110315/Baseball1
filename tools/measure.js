// Season measurements for calibration: the league batting line, strikeout
// and hitting leaders, reliever and starter workloads, days pitched in a
// row, the WAR total and its split, WAR leaders and the awards.
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

// Regular-season relief work by pitcher: { pid: [day numbers] }, relief outs,
// and games where a team's box score has no pitcher.
let appear = {};
let reliefOuts = {};
let noPitcher = 0;
S.hooks.afterGame.push((L, gm, box) => {
  if (gm.type !== 'regular') return;
  const d = dayNum(gm.date);
  box.pit.forEach((side) => {
    if (!side.length) noPitcher++;
    side.forEach((line, k) => {
      if (!line.pid || k === 0) return; // relief appearances only
      (appear[line.pid] = appear[line.pid] || []).push(d);
      reliefOuts[line.pid] = (reliefOuts[line.pid] || 0) + line.outs;
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

// League batting line and the leaders by strikeout rate, average and slugging.
// Qualified: 162 IP with half the games as starts; 502 PA.
function balance(L, rows, games) {
  const f3 = (x) => x.toFixed(3).replace(/^0/, '');
  const pct = (x) => (100 * x).toFixed(1) + '%';
  const tot = { ab: 0, h: 0, d: 0, t: 0, hr: 0, pa: 0, k: 0, bb: 0 };
  for (const x of rows) for (const key in tot) tot[key] += x.s.bat[key];
  const avg = tot.h / tot.ab;
  const slg = (tot.h + tot.d + 2 * tot.t + 3 * tot.hr) / tot.ab;
  console.log(`league line: AVG ${f3(avg)}, OBP ${f3((tot.h + tot.bb) / tot.pa)}, SLG ${f3(slg)}, ISO ${f3(slg - avg)}; K% ${pct(tot.k / tot.pa)}, BB% ${pct(tot.bb / tot.pa)}, HR% ${pct(tot.hr / tot.pa)}`);
  console.log(`  per team-game: ${(tot.h / games).toFixed(2)} H, ${(tot.d / games).toFixed(2)} 2B, ${(tot.t / games).toFixed(2)} 3B, ${(tot.hr / games).toFixed(2)} HR, ${((tot.d + tot.t + tot.hr) / games).toFixed(2)} extra-base hits (${pct((tot.d + tot.t + tot.hr) / tot.h)} of hits), ${(tot.k / games).toFixed(2)} K`);
  const sp = [];
  const hit = [];
  for (const x of rows) {
    const s = x.s;
    const lg = x.t ? x.t.league : -1;
    if (lg < 0) continue;
    const q = s.pit;
    const bf = s.vsL.pa + s.vsR.pa; // pitchers: batters faced, by batter hand
    if (D.isPitcher(x.p) && q.outs >= 486 && q.gs >= q.g * 0.5 && bf) sp.push({ x, lg, kPct: q.k / bf, k9: (q.k * 27) / q.outs, era: (q.er * 27) / q.outs });
    if (!D.isPitcher(x.p) && s.bat.pa >= 502) {
      const c = S.calc(s);
      hit.push({ x, lg, avg: c.avg, slg: c.slg, ops: c.ops });
    }
  }
  const mean = (a, f) => a.reduce((t, y) => t + f(y), 0) / Math.max(1, a.length);
  const sd = (a, f) => Math.sqrt(mean(a, (y) => (f(y) - mean(a, f)) ** 2));
  console.log(`  qualified starters: ${sp.length}, K% average ${pct(mean(sp, (y) => y.kPct))} (spread ${pct(sd(sp, (y) => y.kPct))}), K/9 average ${mean(sp, (y) => y.k9).toFixed(1)}; qualified hitters: ${hit.length}, AVG average ${f3(mean(hit, (y) => y.avg))} (spread ${f3(sd(hit, (y) => y.avg))}), SLG average ${f3(mean(hit, (y) => y.slg))} (spread ${f3(sd(hit, (y) => y.slg))})`);
  console.log(`  .300 hitters ${hit.filter((y) => y.avg >= 0.3).length}, .600 SLG ${hit.filter((y) => y.slg >= 0.6).length}, 1.000 OPS ${hit.filter((y) => y.ops >= 1).length}, 40 HR ${hit.filter((y) => y.x.s.bat.hr >= 40).length}; starters at 28% K or more ${sp.filter((y) => y.kPct >= 0.28).length}, at 25% or more ${sp.filter((y) => y.kPct >= 0.25).length}, 200 K ${sp.filter((y) => y.x.s.pit.k >= 200).length}`);
  const per = (a, f) => [0, 1].map((lg) => `${LEAGUE_SHORT[lg]} ${a.filter((y) => y.lg === lg && f(y)).length}`).join(', ');
  console.log(`  standouts per league: starters at 28% K or more: ${per(sp, (y) => y.kPct >= 0.28)}; hitters slugging .600 or more: ${per(hit, (y) => y.slg >= 0.6)}`);
  const pl = (y) => `${pad(y.x.p.name, 14)} ${pad(y.x.t.abbr, 4)} ${pad(LEAGUE_SHORT[y.lg], 9)} ovr ${y.x.p.ovr}`;
  console.log('  top 5 starters by K%:');
  sp.sort((a, b) => b.kPct - a.kPct).slice(0, 5).forEach((y) => console.log(`    ${pl(y)}  K% ${pct(y.kPct)}  ${y.x.s.pit.k} K in ${ip(y.x.s.pit.outs)} IP (${y.k9.toFixed(1)} per 9), ${y.era.toFixed(2)} ERA, Stuff ${y.x.p.r.stf}`));
  console.log('  top 5 hitters by AVG:');
  hit.sort((a, b) => b.avg - a.avg).slice(0, 5).forEach((y) => console.log(`    ${pl(y)}  ${f3(y.avg)} AVG, ${f3(y.slg)} SLG, ${y.x.s.bat.hr} HR, ${y.x.s.bat.d} 2B`));
  console.log('  top 5 hitters by SLG:');
  hit.sort((a, b) => b.slg - a.slg).slice(0, 5).forEach((y) => console.log(`    ${pl(y)}  ${f3(y.slg)} SLG, ${f3(y.avg)} AVG, ${y.x.s.bat.hr} HR, ${y.x.s.bat.d} 2B, OPS ${y.ops.toFixed(3)}`));
}
const LEAGUE_SHORT = ['Coast', 'Heartland'];

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
  const wins = L.teams.map((t) => t.rec.w).sort((a, b) => b - a);
  console.log(`team wins: best ${wins[0]}, ${wins[1]}, ${wins[2]}; worst ${wins[29]}, ${wins[28]}; teams with 100 or more: ${wins.filter((w) => w >= 100).length}`);
  console.log(`runs per team-game ${(runs / games).toFixed(2)}; team box scores without a pitcher: ${noPitcher}`);
  balance(L, rows, games);

  // Relievers: under half of their games as starts.
  const rel = rows.filter((x) => isP(x.p) && x.s.pit.g > 0 && x.s.pit.gs < x.s.pit.g * 0.5);
  const sp = rows.filter((x) => isP(x.p) && x.s.pit.g > 0 && x.s.pit.gs >= x.s.pit.g * 0.5);
  const byIp = rel.slice().sort((a, b) => b.s.pit.outs - a.s.pit.outs);
  const byG = rel.slice().sort((a, b) => b.s.pit.g - a.s.pit.g);
  const line = (x) => `${pad(x.p.name, 16)} ${pad(x.t ? x.t.abbr : '-', 4)} ovr ${x.p.ovr}  ${pad(ip(x.s.pit.outs), 6)} IP  ${pad(x.s.pit.g, 3)} G  ${pad(x.s.pit.gs, 2)} GS  ${pad(x.s.pit.sv, 2)} SV  WAR ${f1(x.war)}`;
  console.log(`relievers: ${rel.length}; over 80 IP: ${rel.filter((x) => x.s.pit.outs > 240).length}, over 95 IP: ${rel.filter((x) => x.s.pit.outs > 285).length}, over 75 G: ${rel.filter((x) => x.s.pit.g > 75).length}`);
  // Relief work only (a swingman's starts don't count here).
  const ro = Object.keys(reliefOuts).map((pid) => ({ p: L.players[pid], outs: reliefOuts[pid], g: appear[pid].length })).filter((x) => x.p);
  ro.sort((a, b) => b.outs - a.outs);
  const maxG = ro.reduce((m, x) => Math.max(m, x.g), 0);
  console.log(`  in relief only: over 80 IP: ${ro.filter((x) => x.outs > 240).length}, over 95 IP: ${ro.filter((x) => x.outs > 285).length}, over 75 G: ${ro.filter((x) => x.g > 75).length}; most ${ro.slice(0, 3).map((x) => `${x.p.name} ${ip(x.outs)} IP/${x.g} G`).join(', ')}; most games ${maxG}`);
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
    reliefOuts = {};
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
