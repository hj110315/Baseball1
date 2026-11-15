// Season measurements for calibration: the league batting line, strikeout
// and hitting leaders, reliever and starter workloads, days pitched in a
// row, the WAR total and its split, WAR leaders and the awards.
// Run: node tools/measure.js [seasons=2] [seed=11]
//   seed can be a list (11,12,13): each seed is its own league.
//   BRIEF=1  only the Milestone 2b lines per season, then the summary
//   FORM=0   switch in-season form off (to see how much form moves the numbers)
//   PHYS='{...}' / TUNE='{...}'  try physics (BB.sim.PHYS) or league (BB.league.TUNE) settings
// Prints a report per season, then a Milestone 2b summary over all seasons
// (batting-average spread, extra-base hits, strikeouts by Stuff, contact
// quality by Velocity). It checks nothing; seasontest and franchisetest hold
// the pass/fail checks.
'use strict';
const path = require('path');
for (const f of ['util', 'data', 'sim', 'game', 'league', 'engine', 'season', 'depth', 'postseason', 'offseason', 'trades', 'form', 'db']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const BB = globalThis.BB;
const S = BB.season;
const D = BB.depth;
const O = BB.offseason;

const SEASONS = Math.max(1, +(process.argv[2] || 2));
const SEEDS = String(process.argv[3] || 11).split(',').map(Number);
const BRIEF = process.env.BRIEF === '1';
if (process.env.FORM === '0') BB.form.F.cap = 0; // form pinned at neutral
// Calibration: try settings without editing the code, for example
//   PHYS='{"chasePer":0.02}' TUNE='{"power":1.02}' BRIEF=1 node tools/measure.js 1 11,12
if (process.env.PHYS) Object.assign(BB.sim.PHYS, JSON.parse(process.env.PHYS));
if (process.env.TUNE) Object.assign(BB.league.TUNE, JSON.parse(process.env.TUNE));
const say = (...a) => { if (!BRIEF) console.log(...a); };

// Contact quality by pitcher: every fair ball put in play in a regular-season
// game, with its exit velocity (the sim works in ft/s; 100 mph = 146.7 ft/s,
// which about 40% of balls in play reach).
const HARD = 146.7;
let contactBy = {}; // pid -> { n, ev, hard }
let cur = { pid: null, type: null };
const cpuSwing0 = BB.game.cpuSwing;
BB.game.cpuSwing = function (g, pitch, rng) {
  cur = { pid: BB.game.fieldingTeam(g).pitcher.pid, type: g.meta && g.meta.type };
  return cpuSwing0(g, pitch, rng);
};
const contact0 = BB.sim.contact;
BB.sim.contact = function () {
  const r = contact0.apply(this, arguments);
  if (r.kind === 'inplay' && Math.abs(r.theta) <= 45 && cur.type === 'regular' && cur.pid) {
    const c = (contactBy[cur.pid] = contactBy[cur.pid] || { n: 0, ev: 0, hard: 0 });
    c.n++;
    c.ev += r.ev;
    if (r.ev >= HARD) c.hard++;
  }
  return r;
};

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
  say(`league line: AVG ${f3(avg)}, OBP ${f3((tot.h + tot.bb) / tot.pa)}, SLG ${f3(slg)}, ISO ${f3(slg - avg)}; K% ${pct(tot.k / tot.pa)}, BB% ${pct(tot.bb / tot.pa)}, HR% ${pct(tot.hr / tot.pa)}`);
  say(`  per team-game: ${(tot.h / games).toFixed(2)} H, ${(tot.d / games).toFixed(2)} 2B, ${(tot.t / games).toFixed(2)} 3B, ${(tot.hr / games).toFixed(2)} HR, ${((tot.d + tot.t + tot.hr) / games).toFixed(2)} extra-base hits (${pct((tot.d + tot.t + tot.hr) / tot.h)} of hits), ${(tot.k / games).toFixed(2)} K`);
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
  say(`  qualified starters: ${sp.length}, K% average ${pct(mean(sp, (y) => y.kPct))} (spread ${pct(sd(sp, (y) => y.kPct))}), K/9 average ${mean(sp, (y) => y.k9).toFixed(1)}; qualified hitters: ${hit.length}, AVG average ${f3(mean(hit, (y) => y.avg))} (spread ${f3(sd(hit, (y) => y.avg))}), SLG average ${f3(mean(hit, (y) => y.slg))} (spread ${f3(sd(hit, (y) => y.slg))})`);
  say(`  .300 hitters ${hit.filter((y) => y.avg >= 0.3).length}, .600 SLG ${hit.filter((y) => y.slg >= 0.6).length}, 1.000 OPS ${hit.filter((y) => y.ops >= 1).length}, 40 HR ${hit.filter((y) => y.x.s.bat.hr >= 40).length}; starters at 28% K or more ${sp.filter((y) => y.kPct >= 0.28).length}, at 25% or more ${sp.filter((y) => y.kPct >= 0.25).length}, 200 K ${sp.filter((y) => y.x.s.pit.k >= 200).length}`);
  const per = (a, f) => [0, 1].map((lg) => `${LEAGUE_SHORT[lg]} ${a.filter((y) => y.lg === lg && f(y)).length}`).join(', ');
  say(`  standouts per league: starters at 28% K or more: ${per(sp, (y) => y.kPct >= 0.28)}; hitters slugging .600 or more: ${per(hit, (y) => y.slg >= 0.6)}`);
  const pl = (y) => `${pad(y.x.p.name, 14)} ${pad(y.x.t.abbr, 4)} ${pad(LEAGUE_SHORT[y.lg], 9)} ovr ${y.x.p.ovr}`;
  say('  top 5 starters by K%:');
  sp.sort((a, b) => b.kPct - a.kPct).slice(0, 5).forEach((y) => say(`    ${pl(y)}  K% ${pct(y.kPct)}  ${y.x.s.pit.k} K in ${ip(y.x.s.pit.outs)} IP (${y.k9.toFixed(1)} per 9), ${y.era.toFixed(2)} ERA, Stuff ${y.x.p.r.stf}`));
  say('  top 5 hitters by AVG:');
  hit.sort((a, b) => b.avg - a.avg).slice(0, 5).forEach((y) => say(`    ${pl(y)}  ${f3(y.avg)} AVG, ${f3(y.slg)} SLG, ${y.x.s.bat.hr} HR, ${y.x.s.bat.d} 2B, Contact ${y.x.p.r.con}, Power ${y.x.p.r.pow}`));
  say('  top 5 hitters by SLG:');
  hit.sort((a, b) => b.slg - a.slg).slice(0, 5).forEach((y) => say(`    ${pl(y)}  ${f3(y.slg)} SLG, ${f3(y.avg)} AVG, ${y.x.s.bat.hr} HR, ${y.x.s.bat.d} 2B, OPS ${y.ops.toFixed(3)}`));
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
  say(`\n== ${L.year} regular season ==`);
  const wins = L.teams.map((t) => t.rec.w).sort((a, b) => b - a);
  say(`team wins: best ${wins[0]}, ${wins[1]}, ${wins[2]}; worst ${wins[29]}, ${wins[28]}; teams with 100 or more: ${wins.filter((w) => w >= 100).length}`);
  say(`runs per team-game ${(runs / games).toFixed(2)}; team box scores without a pitcher: ${noPitcher}`);
  balance(L, rows, games);

  // Relievers: under half of their games as starts.
  const rel = rows.filter((x) => isP(x.p) && x.s.pit.g > 0 && x.s.pit.gs < x.s.pit.g * 0.5);
  const sp = rows.filter((x) => isP(x.p) && x.s.pit.g > 0 && x.s.pit.gs >= x.s.pit.g * 0.5);
  const byIp = rel.slice().sort((a, b) => b.s.pit.outs - a.s.pit.outs);
  const byG = rel.slice().sort((a, b) => b.s.pit.g - a.s.pit.g);
  const line = (x) => `${pad(x.p.name, 16)} ${pad(x.t ? x.t.abbr : '-', 4)} ovr ${x.p.ovr}  ${pad(ip(x.s.pit.outs), 6)} IP  ${pad(x.s.pit.g, 3)} G  ${pad(x.s.pit.gs, 2)} GS  ${pad(x.s.pit.sv, 2)} SV  WAR ${f1(x.war)}`;
  say(`relievers: ${rel.length}; over 80 IP: ${rel.filter((x) => x.s.pit.outs > 240).length}, over 95 IP: ${rel.filter((x) => x.s.pit.outs > 285).length}, over 75 G: ${rel.filter((x) => x.s.pit.g > 75).length}`);
  // Relief work only (a swingman's starts don't count here).
  const ro = Object.keys(reliefOuts).map((pid) => ({ p: L.players[pid], outs: reliefOuts[pid], g: appear[pid].length })).filter((x) => x.p);
  ro.sort((a, b) => b.outs - a.outs);
  const maxG = ro.reduce((m, x) => Math.max(m, x.g), 0);
  say(`  in relief only: over 80 IP: ${ro.filter((x) => x.outs > 240).length}, over 95 IP: ${ro.filter((x) => x.outs > 285).length}, over 75 G: ${ro.filter((x) => x.g > 75).length}; most ${ro.slice(0, 3).map((x) => `${x.p.name} ${ip(x.outs)} IP/${x.g} G`).join(', ')}; most games ${maxG}`);
  say('  most innings:');
  byIp.slice(0, 8).forEach((x) => say('    ' + line(x)));
  say('  most games:');
  byG.slice(0, 5).forEach((x) => say('    ' + line(x)));
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
  say('  average by bullpen slot (best to worst rating): ' + slots.map((o, i) => `#${i + 1} ${f1(o.outs / 3 / o.n)} IP/${Math.round(o.g / o.n)} G`).join(', '));
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
  say(`  relief appearances on a 3rd straight day (or later): ${three} by ${pitchers3} pitchers; longest run ${longest} days`);

  // Starters.
  const spIp = sp.slice().sort((a, b) => b.s.pit.outs - a.s.pit.outs);
  say(`starters: top ${spIp.slice(0, 3).map((x) => `${x.p.name} ${ip(x.s.pit.outs)} IP/${x.s.pit.gs} GS`).join(', ')}; over 210 IP: ${sp.filter((x) => x.s.pit.outs > 630).length}`);
  const full = sp.filter((x) => x.s.pit.gs >= 28);
  if (full.length) say(`  starters with 28+ starts: ${full.length}, average ${f1(full.reduce((a, x) => a + x.s.pit.outs, 0) / 3 / full.length)} IP, ${f1(full.reduce((a, x) => a + x.s.pit.outs / 3 / x.s.pit.gs, 0) / full.length)} IP per start`);

  // WAR.
  const hit = rows.filter((x) => !isP(x.p));
  const pit = rows.filter((x) => isP(x.p));
  const sum = (a) => a.reduce((t, x) => t + x.war, 0);
  const total = sum(rows);
  say(`WAR total ${f1(total)}: hitters ${f1(sum(hit))} (${Math.round((100 * sum(hit)) / total)}%), pitchers ${f1(sum(pit))} (${Math.round((100 * sum(pit)) / total)}%); starters ${f1(sum(sp))}, relievers ${f1(sum(rel))}`);
  const top = rows.slice().sort((a, b) => b.war - a.war);
  say('  top 10:');
  top.slice(0, 10).forEach((x) => say(`    ${pad(x.p.name, 16)} ${pad(x.p.pos, 3)} ${pad(x.t ? x.t.abbr : '-', 4)} ovr ${x.p.ovr} age ${x.p.age}  WAR ${pad(f1(x.war), 5)} ${D.statLine(x.p)}`));
  say(`  players at 8+: ${top.filter((x) => x.war >= 8).length}, at 11+: ${top.filter((x) => x.war >= 11).length}; best pitcher ${f1(pit.reduce((m, x) => Math.max(m, x.war), 0))}, best reliever ${f1(rel.reduce((m, x) => Math.max(m, x.war), 0))}`);

  // Awards.
  const aw = L.awards || D.computeAwards(L, { dry: true });
  for (const lg of aw.leagues) {
    for (const [label, a] of [['MVP', lg.mvp], ['Cy Young', lg.cy], ['Rookie', lg.roy], ['Reliever', lg.rel]]) {
      if (!a) continue;
      const p = L.players[a.pid];
      const q = p.stats.reg.pit;
      const extra = isP(p) ? `${ip(q.outs)} IP, ${q.g} G, ${q.gs} GS` : `${p.stats.reg.bat.pa} PA, OPS ${S.calc(p.stats.reg).ops.toFixed(3)}`;
      say(`  ${pad(lg.name.split(' ')[0], 10)} ${pad(label, 9)} ${pad(a.name, 16)} ${pad(a.pos, 3)} ovr ${p.ovr} age ${p.age}  WAR ${pad(a.war, 5)} ${a.line} (${extra})`);
    }
  }
  // Rookies against everyone else, to tell a formula problem from strong rookies.
  const reg = hit.filter((x) => x.s.bat.pa >= 400);
  const rk = reg.filter((x) => x.p.rookie);
  const avg = (a, f) => (a.length ? a.reduce((t, x) => t + f(x), 0) / a.length : 0);
  say(`  hitters with 400+ PA: ${reg.length} (avg ovr ${f1(avg(reg, (x) => x.p.ovr))}, avg WAR ${f1(avg(reg, (x) => x.war))}); rookies among them: ${rk.length} (avg ovr ${f1(avg(rk, (x) => x.p.ovr))}, avg WAR ${f1(avg(rk, (x) => x.war))})`);
  const rkAll = rows.filter((x) => x.p.rookie).sort((a, b) => b.war - a.war);
  say(`  rookies with stats: ${rkAll.length}; best: ${rkAll.slice(0, 4).map((x) => `${x.p.name} ${x.p.pos} ovr ${x.p.ovr} age ${x.p.age} WAR ${f1(x.war)}`).join('; ')}`);
}

// ---------------------------------------------------------------------------
// Milestone 2b numbers: the batting-average spread, extra-base hits,
// strikeouts by Stuff and contact quality by Velocity. One line per season;
// the rating bands pool every season of the run.
// ---------------------------------------------------------------------------
const BANDS = [[20, 49], [50, 59], [60, 69], [70, 79], [80, 99]];
const bandOf = (r) => BANDS.findIndex((b) => r >= b[0] && r <= b[1]);
const newBand = () => ({ n: 0, bf: 0, k: 0, bip: 0, ev: 0, hard: 0 });
const newHit = () => ({ n: 0, ab: 0, h: 0, pa: 0, k: 0, hr: 0, d: 0 });
const pool = { seasons: [], con: BANDS.map(newHit), pow: BANDS.map(newHit), stf: BANDS.map(newBand), vel: BANDS.map(newBand), mix: { 'high Stuff, low Velocity': newBand(), 'low Stuff, high Velocity': newBand() }, pit: [], hit: [] };
const p3 = (x) => x.toFixed(3).replace(/^0/, '');
const pc = (x) => (100 * x).toFixed(1) + '%';
const meanOf = (a) => a.reduce((t, y) => t + y, 0) / Math.max(1, a.length);
const sdOf = (a) => { const m = meanOf(a); return Math.sqrt(meanOf(a.map((y) => (y - m) ** 2))); };

function report2b(L, seed) {
  const isP = D.isPitcher;
  const tot = { ab: 0, h: 0, d: 0, t: 0, hr: 0, pa: 0, k: 0, bb: 0 };
  const hit = [];
  const sp = [];
  for (const id in L.players) {
    const p = L.players[id];
    const s = p.stats.reg;
    for (const key in tot) tot[key] += s.bat[key];
    const t = p.teamId ? S.team(L, p.teamId) : null;
    if (!isP(p) && s.bat.pa >= 502 && t) {
      const c = S.calc(s);
      hit.push({ p, lg: t.league, avg: c.avg, slg: c.slg });
      pool.hit.push({ con: p.r.con, pow: p.r.pow, spd: p.r.spd, eye: p.r.eye, avg: c.avg, slg: c.slg, d: s.bat.d, pa: s.bat.pa, k: s.bat.k / s.bat.pa });
    }
    if (!isP(p) && s.bat.pa >= 200) {
      for (const b of [pool.con[bandOf(p.r.con)], pool.pow[bandOf(p.r.pow)]]) {
        b.n++;
        for (const key of ['ab', 'h', 'pa', 'k', 'hr', 'd']) b[key] += s.bat[key];
      }
    }
    if (!isP(p)) continue;
    const bf = s.vsL.pa + s.vsR.pa;
    if (!bf) continue;
    const c = contactBy[id] || { n: 0, ev: 0, hard: 0 };
    const add = (b) => { b.n++; b.bf += bf; b.k += s.pit.k; b.bip += c.n; b.ev += c.ev; b.hard += c.hard; };
    add(pool.stf[bandOf(p.r.stf)]);
    add(pool.vel[bandOf(p.r.vel)]);
    if (p.r.stf >= 68 && p.r.vel <= 58) add(pool.mix['high Stuff, low Velocity']);
    if (p.r.stf <= 58 && p.r.vel >= 68) add(pool.mix['low Stuff, high Velocity']);
    if (bf >= 150) pool.pit.push({ stf: p.r.stf, vel: p.r.vel, ctl: p.r.ctl, bf, k: s.pit.k / bf, bip: c.n, hard: c.n ? c.hard / c.n : 0 });
    if (t && s.pit.outs >= 486 && s.pit.gs >= s.pit.g * 0.5) sp.push({ lg: t.league, k: s.pit.k / bf });
  }
  let runs = 0;
  let games = 0;
  for (const t of L.teams) {
    runs += t.rec.rs;
    games += t.rec.w + t.rec.l;
  }
  const avgs = hit.map((y) => y.avg).sort((a, b) => a - b);
  const lg = (f) => [0, 1].map(f);
  const row = {
    seed, year: L.year,
    rpg: runs / games, avg: tot.h / tot.ab, kPct: tot.k / tot.pa,
    slg: (tot.h + tot.d + 2 * tot.t + 3 * tot.hr) / tot.ab,
    d: tot.d / games, t: tot.t / games, hr: tot.hr / games,
    n300: lg((i) => hit.filter((y) => y.lg === i && y.avg >= 0.3).length),
    champ: lg((i) => Math.max(...hit.filter((y) => y.lg === i).map((y) => y.avg))),
    slg600: lg((i) => hit.filter((y) => y.lg === i && y.slg >= 0.6).length),
    qN: hit.length, qMean: meanOf(avgs), qSd: sdOf(avgs), qLow: avgs[0], qLow5: meanOf(avgs.slice(0, 5)),
    under240: avgs.filter((a) => a < 0.24).length, under220: avgs.filter((a) => a < 0.22).length,
    hitK: sdOf(hit.map((y) => y.p.stats.reg.bat.k / y.p.stats.reg.bat.pa)),
    champCon: lg((i) => hit.filter((y) => y.lg === i).sort((a, b) => b.avg - a.avg)[0].p.r),
    spN: sp.length, spMean: meanOf(sp.map((y) => y.k)), spSd: sdOf(sp.map((y) => y.k)), spBest: Math.max(...sp.map((y) => y.k)), spLow: Math.min(...sp.map((y) => y.k)),
    sp28: lg((i) => sp.filter((y) => y.lg === i && y.k >= 0.28).length),
  };
  pool.seasons.push(row);
  console.log(`[2b] seed ${seed} ${L.year}: runs ${row.rpg.toFixed(2)}, AVG ${p3(row.avg)}, SLG ${p3(row.slg)}, K ${pc(row.kPct)}; 2B ${row.d.toFixed(2)}, 3B ${row.t.toFixed(2)}, HR ${row.hr.toFixed(2)}; .300 hitters ${row.n300.join('+')}, champions ${row.champ.map(p3).join(' ')}, qualified AVG ${p3(row.qMean)} spread ${p3(row.qSd)}, lowest ${p3(row.qLow)}, under .240: ${row.under240}; starters K% ${pc(row.spMean)} spread ${pc(row.spSd)}, best ${pc(row.spBest)}, at 28%+: ${row.sp28.join('+')}; .600 SLG ${row.slg600.join('+')}`);
}

// Weighted least squares: y = b0 + b1*x1 + b2*x2 (+ ...). Returns the slopes.
function wls(rows, xs, y, w) {
  const n = xs.length + 1;
  const A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  for (const r of rows) {
    const v = [1].concat(xs.map((f) => f(r)));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += w(r) * v[i] * v[j];
      A[i][n] += w(r) * v[i] * y(r);
    }
  }
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
    [A[i], A[piv]] = [A[piv], A[i]];
    if (Math.abs(A[i][i]) < 1e-12) return new Array(n).fill(0);
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = A[k][i] / A[i][i];
      for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j];
    }
  }
  return A.map((r, i) => r[n] / r[i]);
}

function summary2b() {
  const rows = pool.seasons;
  if (!rows.length) return;
  const rng = (f, fmt) => { const v = rows.map(f); return `${fmt(Math.min(...v))} to ${fmt(Math.max(...v))} (average ${fmt(meanOf(v))})`; };
  const f2 = (x) => x.toFixed(2);
  const i0 = (x) => String(Math.round(x * 10) / 10);
  console.log(`\n== Milestone 2b summary: ${rows.length} seasons (seeds ${SEEDS.join(', ')}; form ${process.env.FORM === '0' ? 'off' : 'on'}) ==`);
  console.log(`runs per team-game        ${rng((r) => r.rpg, f2)}`);
  console.log(`league AVG                ${rng((r) => r.avg, p3)}`);
  console.log(`league SLG                ${rng((r) => r.slg, p3)}`);
  console.log(`league strikeout rate     ${rng((r) => r.kPct, pc)}`);
  console.log(`doubles per team-game     ${rng((r) => r.d, f2)}`);
  console.log(`triples per team-game     ${rng((r) => r.t, f2)}`);
  console.log(`home runs per team-game   ${rng((r) => r.hr, f2)}`);
  console.log(`.300 hitters per league   ${rng((r) => (r.n300[0] + r.n300[1]) / 2, i0)}; single leagues ${Math.min(...rows.map((r) => Math.min(...r.n300)))} to ${Math.max(...rows.map((r) => Math.max(...r.n300)))}`);
  console.log(`batting champion          ${p3(Math.min(...rows.map((r) => Math.min(...r.champ))))} to ${p3(Math.max(...rows.map((r) => Math.max(...r.champ))))} (average ${p3(meanOf(rows.map((r) => (r.champ[0] + r.champ[1]) / 2)))})`);
  console.log(`qualified hitters         ${rng((r) => r.qN, i0)}; their AVG: mean ${rng((r) => r.qMean, p3)}, spread (SD) ${rng((r) => r.qSd, p3)}`);
  console.log(`lowest qualified AVG      ${rng((r) => r.qLow, p3)}; lowest five ${rng((r) => r.qLow5, p3)}`);
  console.log(`qualified under .240      ${rng((r) => r.under240, i0)}; under .220: ${rng((r) => r.under220, i0)}`);
  console.log(`under .240 against .300+  ${rows.map((r) => `${r.under240} v ${r.n300[0] + r.n300[1]}`).join(', ')} (target: more under .240)`);
  console.log(`qualified hitters' K%     spread (SD) ${rng((r) => r.hitK, pc)}`);
  console.log(`batting champions' ratings: Contact ${rows.map((r) => r.champCon.map((x) => x.con).join('/')).join(', ')}; Power ${rows.map((r) => r.champCon.map((x) => x.pow).join('/')).join(', ')}`);
  console.log(`hitters slugging .600+    per league ${rng((r) => (r.slg600[0] + r.slg600[1]) / 2, i0)}`);
  console.log(`qualified starters K%     mean ${rng((r) => r.spMean, pc)}, spread (SD) ${rng((r) => r.spSd, pc)}`);
  console.log(`best / lowest starter K%  ${rng((r) => r.spBest, pc)} / ${rng((r) => r.spLow, pc)}`);
  console.log(`starters at 28% K or more per league ${rng((r) => (r.sp28[0] + r.sp28[1]) / 2, i0)}; single leagues ${Math.min(...rows.map((r) => Math.min(...r.sp28)))} to ${Math.max(...rows.map((r) => Math.max(...r.sp28)))}`);
  const mph = (x) => (x * 0.6818).toFixed(1);
  const band = (label, b) => console.log(`  ${pad(label, 26)} ${pad(b.n, 5)} pitcher-seasons  K% ${pad(b.bf ? pc(b.k / b.bf) : '-', 6)}  hard-hit ${pad(b.bip ? pc(b.hard / b.bip) : '-', 6)}  exit velocity ${b.bip ? mph(b.ev / b.bip) : '-'} mph`);
  console.log('by Stuff rating (all pitchers, weighted by batters faced; hard-hit = 100 mph or more off the bat):');
  BANDS.forEach((b, i) => band(`Stuff ${b[0]}-${b[1]}`, pool.stf[i]));
  console.log('by Velocity rating:');
  BANDS.forEach((b, i) => band(`Velocity ${b[0]}-${b[1]}`, pool.vel[i]));
  console.log('mixed profiles (68 or more in one, 58 or less in the other):');
  for (const k in pool.mix) band(k, pool.mix[k]);
  const hband = (label, b) => console.log(`  ${pad(label, 26)} ${pad(b.n, 5)} hitter-seasons   AVG ${b.ab ? p3(b.h / b.ab) : '-'}  K% ${pad(b.pa ? pc(b.k / b.pa) : '-', 6)}  HR per 600 PA ${b.pa ? ((600 * b.hr) / b.pa).toFixed(1) : '-'}  2B per 600 PA ${b.pa ? ((600 * b.d) / b.pa).toFixed(1) : '-'}`);
  console.log('hitters with 200+ PA, by Contact rating:');
  BANDS.forEach((b, i) => hband(`Contact ${b[0]}-${b[1]}`, pool.con[i]));
  console.log('by Power rating:');
  BANDS.forEach((b, i) => hband(`Power ${b[0]}-${b[1]}`, pool.pow[i]));
  // What 10 rating points are worth, holding the other ratings fixed.
  const kFit = wls(pool.pit, [(r) => r.stf - 60, (r) => r.vel - 60, (r) => r.ctl - 60], (r) => r.k, (r) => r.bf);
  const hFit = wls(pool.pit.filter((r) => r.bip), [(r) => r.stf - 60, (r) => r.vel - 60, (r) => r.ctl - 60], (r) => r.hard, (r) => r.bip);
  const pts = (x) => (x >= 0 ? '+' : '') + (1000 * x).toFixed(1);
  console.log(`10 points of rating are worth (pitchers with 150+ batters faced, other ratings held fixed):`);
  console.log(`  strikeout rate: Stuff ${pts(kFit[1])} points, Velocity ${pts(kFit[2])}, Control ${pts(kFit[3])}`);
  console.log(`  hard-hit rate:  Stuff ${pts(hFit[1])} points, Velocity ${pts(hFit[2])}, Control ${pts(hFit[3])}`);
  const aFit = wls(pool.hit, [(r) => r.con - 60, (r) => r.pow - 60, (r) => r.spd - 60, (r) => r.eye - 60], (r) => r.avg, (r) => r.pa);
  const a3 = (x) => (x >= 0 ? '+' : '') + (10000 * x).toFixed(1);
  console.log(`  batting average (qualified hitters; in points of AVG, .001 each): Contact ${a3(aFit[1])}, Power ${a3(aFit[2])}, Speed ${a3(aFit[3])}, Eye ${a3(aFit[4])}`);
  const hk = wls(pool.hit, [(r) => r.con - 60, (r) => r.pow - 60, (r) => r.spd - 60, (r) => r.eye - 60], (r) => r.k, (r) => r.pa);
  console.log(`  hitters' strikeout rate: Contact ${pts(hk[1])} points, Power ${pts(hk[2])}, Eye ${pts(hk[4])}`);
  console.log(`  qualified hitters' ratings: Contact mean ${meanOf(pool.hit.map((r) => r.con)).toFixed(1)} spread ${sdOf(pool.hit.map((r) => r.con)).toFixed(1)}; Power mean ${meanOf(pool.hit.map((r) => r.pow)).toFixed(1)} spread ${sdOf(pool.hit.map((r) => r.pow)).toFixed(1)}`);
}

(async () => {
  for (const SEED of SEEDS) {
    D.rng = BB.U.seeded(SEED * 7 + 1);
    const L = S.newFranchise({ userTeamId: 'LAK', difficulty: 'medium', seed: SEED });
    for (let season = 0; season < SEASONS; season++) {
      while (!S.phaseDone(L)) S.simDay(L);
      O.setOpeningDay(L, O.suggestRoster(L, S.userTeam(L)));
      S.advancePhase(L);
      appear = {};
      reliefOuts = {};
      noPitcher = 0;
      contactBy = {};
      while (!S.phaseDone(L)) S.simDay(L);
      report(L);
      report2b(L, SEED);
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
  }
  summary2b();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
