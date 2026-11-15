// Pitch measurements: how each pitch's hidden quality (arsenal q), its type,
// the pitcher's arsenal size and mix, and his ratings line up with results.
// Run: node tools/pitchtest.js [seasons=5] [seed=11]
// Sims whole franchise seasons (regular season, postseason, offseason) and
// logs every regular-season pitch. It checks nothing; it prints tables for
// docs/reports/pitch-test-*.md.
//
// What it logs per pitch (wrapping BB.game and BB.sim at call time, so no
// game code changes): pitcher id, pitch type, the game q (arsenal q x Stuff
// multiplier, with that day's form), in or out of the zone, swing, miss,
// foul, ball in play with exit velocity, and how the plate appearance ended
// if it ended on this pitch.
//
// Terms:
//   grade      the 20-80 grade the profile shows: round5(50 + (q - 1) * 250),
//              from the stored arsenal q (0.90-1.10). It does not include Stuff.
//   game q     the q the pitch uses in play: stored q x (1 + 0.0033 per Stuff
//              point from 60, soft-capped), so roughly 0.85-1.15.
//   fastball-type   fb, si, ct (family 'fast' in BB.PITCHES)
//   breaking/off    sl, cv, ch, sp (family 'off')
//   hard contact    ball in play at 150 ft/s or more (about 102 mph). The sim's
//              exit speeds run high (league mean about 140 ft/s), so the usual
//              95 mph line would call 60% of balls in play hard.
//   qualified  starters with 162+ IP in the season (486 outs) and half their
//              games as starts; relievers (for 2-pitch arsenals) 50+ IP, no starts.
'use strict';
const path = require('path');
for (const f of ['util', 'data', 'sim', 'game', 'league', 'engine', 'season', 'depth', 'postseason', 'offseason', 'trades', 'form', 'db']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const BB = globalThis.BB;
const S = BB.season;
const D = BB.depth;
const O = BB.offseason;
const GM = BB.game;

const SEASONS = Math.max(1, +(process.argv[2] || 5));
const SEED = +(process.argv[3] || 11);
D.rng = BB.U.seeded(SEED * 7 + 1);
const HARD = 150; // ft/s (about 102 mph; about a third of balls in play)
const evHist = new Array(200).fill(0);

const grade = (q) => Math.max(20, Math.min(80, Math.round(Math.round(50 + (q - 1) * 250) / 5) * 5));
const fam = (key) => BB.PITCHES[key].family;

// ---------------------------------------------------------------------------
// Per-pitch logging
// ---------------------------------------------------------------------------
let tracking = false;
let cur = null; // the pitch in flight
let season = {}; // `${pid}|${type}` -> counters, this season
const newCnt = () => ({ n: 0, qSum: 0, laSum: 0, zone: 0, oz: 0, ozSwing: 0, swing: 0, miss: 0, foul: 0, ball: 0, bip: 0, hard: 0, evSum: 0, k: 0, bb: 0, ab: 0, h: 0, hr: 0, pa: 0 });
function add(a, b) {
  for (const k in b) a[k] = (a[k] || 0) + b[k];
  return a;
}

const origSwing = GM.cpuSwing;
GM.cpuSwing = function (g, pitch, rng) {
  const res = origSwing.apply(this, arguments);
  if (tracking) {
    const p = GM.fieldingTeam(g).pitcher;
    cur = { pid: p.pid, type: pitch.type, q: pitch.q, zone: GM.isStrike(pitch.loc), swing: res !== null, ev: null, la: null };
  } else cur = null;
  return res;
};
const origContact = BB.sim.contact;
BB.sim.contact = function () {
  const r = origContact.apply(this, arguments);
  if (cur && r.kind === 'inplay') {
    cur.ev = r.ev;
    cur.la = r.phi;
  }
  return r;
};
function finish(ev, kind, result) {
  if (!cur) return;
  const c = cur;
  cur = null;
  if (!c.pid) return;
  const key = c.pid + '|' + c.type;
  const s = season[key] || (season[key] = newCnt());
  s.n++;
  s.qSum += c.q;
  if (c.zone) s.zone++;
  else {
    s.oz++;
    if (c.swing) s.ozSwing++;
  }
  if (c.swing) s.swing++;
  if (kind === 'miss') s.miss++;
  if (kind === 'foul') s.foul++;
  if (kind === 'take' && !c.zone) s.ball++;
  if (kind === 'inplay') {
    s.bip++;
    s.evSum += c.ev || 0;
    s.laSum += c.la || 0;
    if ((c.ev || 0) >= HARD) s.hard++;
    evHist[Math.min(199, Math.floor(c.ev || 0))]++;
    s.pa++;
    if (result.ab) s.ab++;
    if (result.hit) s.h++;
    if (result.hit && result.batterBase === 4) s.hr++;
  }
  if (ev.type === 'strikeout') {
    s.k++;
    s.ab++;
    s.pa++;
  }
  if (ev.type === 'walk') {
    s.bb++;
    s.pa++;
  }
}
for (const [name, kind] of [['takePitch', 'take'], ['swingMiss', 'miss'], ['foulBall', 'foul'], ['inPlay', 'inplay']]) {
  const orig = GM[name];
  GM[name] = function (g, a, b) {
    const ev = orig.apply(this, arguments);
    finish(ev, kind, name === 'inPlay' ? a : null);
    return ev;
  };
}
S.hooks.beforeDay.push((L) => {
  tracking = L.phase === 'regular';
});

// ---------------------------------------------------------------------------
// Collect one season
// ---------------------------------------------------------------------------
const pitchRows = []; // one per pitcher-season-pitch: { season, pid, type, rawQ, grade, stf, vel, ctl, role, c }
const pitcherRows = []; // one per pitcher-season with his season line

function collect(L, si, snap) {
  const byPid = {};
  for (const key in season) {
    const [pid, type] = key.split('|');
    (byPid[pid] = byPid[pid] || {})[type] = season[key];
  }
  for (const pid in byPid) {
    const p = L.players[pid];
    const r = snap[pid] || (p && p.r);
    if (!p || !r || !p.arsenal) continue;
    const st = p.stats.reg;
    const q = st.pit;
    const role = q.g && q.gs >= q.g * 0.5 ? 'SP' : 'RP';
    const pitches = [];
    for (const a of p.arsenal) {
      const c = byPid[pid][a.key] || newCnt();
      const row = { season: si, pid, type: a.key, fam: fam(a.key), rawQ: a.q, grade: grade(a.q), stf: r.stf, vel: r.vel, ctl: r.ctl, role, c };
      pitchRows.push(row);
      pitches.push(row);
    }
    const tot = pitches.reduce((acc, x) => add(acc, x.c), newCnt());
    const bf = st.vsL.pa + st.vsR.pa;
    const ab = st.vsL.ab + st.vsR.ab;
    const ip = q.outs / 3;
    const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    pitcherRows.push({
      season: si, pid, name: p.name, role, stf: r.stf, vel: r.vel, ctl: r.ctl,
      outs: q.outs, g: q.g, gs: q.gs, bf,
      kPct: bf ? q.k / bf : 0, bbPct: bf ? q.bb / bf : 0, whip: ip ? (q.h + q.bb) / ip : 0, baa: ab ? (st.vsL.h + st.vsR.h) / ab : 0,
      hr9: ip ? (q.hr * 9) / ip : 0, era: ip ? (q.er * 9) / ip : 0,
      size: p.arsenal.length,
      nFast: p.arsenal.filter((a) => fam(a.key) === 'fast').length,
      gAll: avg(pitches.map((x) => x.grade)),
      gFast: avg(pitches.filter((x) => x.fam === 'fast').map((x) => x.grade)),
      gOff: avg(pitches.filter((x) => x.fam === 'off').map((x) => x.grade)),
      gUse: tot.n ? pitches.reduce((s, x) => s + x.grade * x.c.n, 0) / tot.n : null,
      fbShare: tot.n ? pitches.filter((x) => x.type === 'fb').reduce((s, x) => s + x.c.n, 0) / tot.n : 0,
      fastShare: tot.n ? pitches.filter((x) => x.fam === 'fast').reduce((s, x) => s + x.c.n, 0) / tot.n : 0,
      hardPct: tot.bip ? tot.hard / tot.bip : 0,
      whiffPct: tot.swing ? tot.miss / tot.swing : 0,
      types: p.arsenal.map((a) => a.key).join('/'),
    });
  }
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
function pearson(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy || 1);
}
// Least squares y ~ 1 + X; returns residuals.
function residuals(X, y) {
  const n = y.length;
  const k = X[0].length + 1;
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < n; i++) {
    const row = [1, ...X[i]];
    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) A[a][b] += row[a] * row[b];
      A[a][k] += row[a] * y[i];
    }
  }
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  const beta = A.map((row, i) => row[k] / row[i]);
  return { beta, res: y.map((v, i) => v - [1, ...X[i]].reduce((s, x, j) => s + x * beta[j], 0)) };
}

const pct = (x) => (100 * x).toFixed(1) + '%';
const f3 = (x) => x.toFixed(3).replace(/^0/, '').replace(/^-0/, '-');
const f2 = (x) => x.toFixed(2);
const r2 = (x) => (x >= 0 ? '+' : '') + x.toFixed(2);
function table(head, rows) {
  const w = head.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => '| ' + r.map((c, i) => String(c).padEnd(w[i])).join(' | ') + ' |';
  console.log(line(head));
  console.log('|' + w.map((x) => '-'.repeat(x + 2)).join('|') + '|');
  for (const r of rows) console.log(line(r));
  console.log('');
}

// Per-pitch summary columns for a set of counters.
function pitchCols(c) {
  return [
    c.n,
    pct(c.swing ? c.miss / c.swing : 0),
    pct(c.oz ? c.ozSwing / c.oz : 0),
    (c.n ? (100 * c.k) / c.n : 0).toFixed(2),
    (c.n ? (100 * c.bb) / c.n : 0).toFixed(2),
    pct(c.bip ? c.hard / c.bip : 0),
    (c.bip ? (100 * c.hr) / c.bip : 0).toFixed(2),
    f3(c.ab ? c.h / c.ab : 0),
  ];
}
const PITCH_HEAD = ['pitches', 'whiff/swing', 'chase', 'K/100', 'BB/100', 'hard%', 'HR/100 BIP', 'AVG'];

function byBand(rows, bandOf, order) {
  const m = {};
  for (const r of rows) {
    const b = bandOf(r);
    if (b == null) continue;
    m[b] = add(m[b] || newCnt(), r.c);
  }
  return (order || Object.keys(m).sort()).filter((b) => m[b]).map((b) => [b, ...pitchCols(m[b])]);
}
const gradeBand = (g) => (g <= 35 ? '20-35' : g >= 65 ? '65-80' : String(g));
const GRADE_ORDER = ['20-35', '40', '45', '50', '55', '60', '65-80'];

function pitcherCols(xs) {
  return [xs.length, pct(mean(xs.map((x) => x.kPct))), pct(mean(xs.map((x) => x.bbPct))), f2(mean(xs.map((x) => x.hr9))), pct(mean(xs.map((x) => x.hardPct))), f3(mean(xs.map((x) => x.baa))), f2(mean(xs.map((x) => x.whip)))];
}
const PITCHER_HEAD = ['pitchers', 'K%', 'BB%', 'HR/9', 'hard%', 'AVG', 'WHIP'];
function groupBy(xs, keyOf, order) {
  const m = {};
  for (const x of xs) {
    const k = keyOf(x);
    if (k == null) continue;
    (m[k] = m[k] || []).push(x);
  }
  return (order || Object.keys(m).sort()).filter((k) => m[k]).map((k) => [k, ...pitcherCols(m[k])]);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function report() {
  const qualSP = pitcherRows.filter((x) => x.role === 'SP' && x.outs >= 486);
  const qualRP = pitcherRows.filter((x) => x.role === 'RP' && x.gs === 0 && x.outs >= 150);
  const qualPids = new Set(qualSP.map((x) => x.season + '|' + x.pid));
  const allPitches = pitchRows.filter((r) => r.c.n > 0);
  const tot = allPitches.reduce((a, r) => add(a, r.c), newCnt());
  console.log(`# Pitch test: ${SEASONS} season(s), seed ${SEED}`);
  console.log(`regular-season pitches logged: ${tot.n}; pitcher-seasons: ${pitcherRows.length}; qualified starters: ${qualSP.length}; relievers 50+ IP: ${qualRP.length}`);
  console.log(`league: whiff/swing ${pct(tot.miss / tot.swing)}, chase ${pct(tot.ozSwing / tot.oz)}, hard% ${pct(tot.hard / tot.bip)}, mean EV ${(tot.evSum / tot.bip).toFixed(1)} ft/s, AVG ${f3(tot.h / tot.ab)}`);
  {
    const n = evHist.reduce((a, b) => a + b, 0);
    const at = (f) => {
      let c = 0;
      for (let i = 0; i < 200; i++) if ((c += evHist[i]) >= f * n) return i;
      return 199;
    };
    console.log(`exit speed (ft/s): 25th ${at(0.25)}, median ${at(0.5)}, 75th ${at(0.75)}, 90th ${at(0.9)}; hard line ${HARD}\n`);
  }

  // Grade spread
  const gCount = {};
  for (const p of new Set(pitchRows.map((r) => r.pid + '|' + r.type + '|' + r.grade))) {
    const g = +p.split('|')[2];
    gCount[g] = (gCount[g] || 0) + 1;
  }
  console.log('## Displayed grade spread (unique pitcher-pitches)');
  table(['grade', 'count'], Object.keys(gCount).sort((a, b) => a - b).map((g) => [g, gCount[g]]));

  console.log('## 1a. Per pitch, by displayed grade (all pitchers, all pitches)');
  table(['grade', ...PITCH_HEAD], byBand(allPitches, (r) => gradeBand(r.grade), GRADE_ORDER));
  console.log('## 1a2. Per pitch, by displayed grade, qualified starters only');
  table(['grade', ...PITCH_HEAD], byBand(allPitches.filter((r) => qualPids.has(r.season + '|' + r.pid)), (r) => gradeBand(r.grade), GRADE_ORDER));

  console.log('## 1b. Per pitch, by game q (stored q x Stuff, with form): what the sim actually uses');
  const qb = (q) => (q < 0.94 ? '<0.94' : q < 0.97 ? '0.94-0.97' : q < 1.0 ? '0.97-1.00' : q < 1.03 ? '1.00-1.03' : q < 1.06 ? '1.03-1.06' : '1.06+');
  table(['game q', ...PITCH_HEAD], byBand(allPitches, (r) => qb(r.c.qSum / r.c.n), ['<0.94', '0.94-0.97', '0.97-1.00', '1.00-1.03', '1.03-1.06', '1.06+']));

  console.log('## 1c. Per pitch, by grade, with Stuff held in a band');
  for (const [lo, hi] of [[40, 54], [55, 64], [65, 99]]) {
    console.log(`### Stuff ${lo}-${hi}`);
    table(['grade', ...PITCH_HEAD], byBand(allPitches.filter((r) => r.stf >= lo && r.stf <= hi), (r) => (r.grade <= 40 ? '20-40' : r.grade >= 60 ? '60-80' : String(r.grade)), ['20-40', '45', '50', '55', '60-80']));
  }

  console.log('## 1d. Per pitch, by type');
  const typeOrder = ['fb', 'si', 'ct', 'sl', 'cv', 'ch', 'sp'];
  table(['type', 'share', ...PITCH_HEAD, 'mean EV', 'mean launch'], typeOrder.map((t) => {
    const c = allPitches.filter((r) => r.type === t).reduce((a, r) => add(a, r.c), newCnt());
    return [`${BB.PITCHES[t].name} (${fam(t)})`, pct(c.n / tot.n), ...pitchCols(c), (c.evSum / c.bip).toFixed(1), (c.laSum / c.bip).toFixed(1) + '°'];
  }));
  console.log('## 1d2. Per pitch, by family');
  table(['family', 'share', ...PITCH_HEAD], ['fast', 'off'].map((f) => {
    const c = allPitches.filter((r) => r.fam === f).reduce((a, r) => add(a, r.c), newCnt());
    return [f, pct(c.n / tot.n), ...pitchCols(c)];
  }));
  console.log('## 1d4. Per pitch, by grade within family');
  for (const f of ['fast', 'off']) {
    console.log(`### ${f === 'fast' ? 'fastball-type (fb, si, ct)' : 'breaking/offspeed (sl, cv, ch, sp)'}`);
    table(['grade', ...PITCH_HEAD], byBand(allPitches.filter((r) => r.fam === f), (r) => gradeBand(r.grade), GRADE_ORDER));
  }
  console.log('## 1d5. Four-seam fastball by grade');
  table(['grade', ...PITCH_HEAD], byBand(allPitches.filter((r) => r.type === 'fb'), (r) => gradeBand(r.grade), GRADE_ORDER));
  console.log('## 1d6. Usage vs grade within a pitcher: share of his family\'s pitches, by grade');
  {
    const m = {};
    const famTot = {};
    const famN = {};
    for (const r of pitchRows) {
      const k = r.season + '|' + r.pid + '|' + r.fam;
      famTot[k] = (famTot[k] || 0) + r.c.n;
      famN[k] = (famN[k] || 0) + 1;
    }
    for (const r of allPitches) {
      const k = r.season + '|' + r.pid + '|' + r.fam;
      const nFam = famN[k];
      if (nFam < 2) continue;
      const b = gradeBand(r.grade);
      m[b] = m[b] || { s: 0, n: 0 };
      m[b].s += (r.c.n / famTot[k]) * nFam; // 1.0 = an even share
      m[b].n++;
    }
    table(['grade', 'pitches', 'usage vs even share'], GRADE_ORDER.filter((b) => m[b]).map((b) => [b, m[b].n, f2(m[b].s / m[b].n)]));
  }

  console.log('## 1e. Per pitcher (qualified starters), by average grade');
  const avgBand = (g) => (g < 42.5 ? '<42.5' : g < 47.5 ? '42.5-47.5' : g < 52.5 ? '47.5-52.5' : g < 57.5 ? '52.5-57.5' : '57.5+');
  const AVG_ORDER = ['<42.5', '42.5-47.5', '47.5-52.5', '52.5-57.5', '57.5+'];
  table(['avg grade', ...PITCHER_HEAD], groupBy(qualSP, (x) => avgBand(x.gAll), AVG_ORDER));

  console.log('## 2a. Arsenal size (qualified starters)');
  table(['pitches', ...PITCHER_HEAD], groupBy(qualSP, (x) => String(x.size)));
  console.log('## 2a2. Arsenal size (relievers, 50+ IP)');
  table(['pitches', ...PITCHER_HEAD], groupBy(qualRP, (x) => String(x.size)));
  console.log('## 2b. Arsenal makeup: fastball-type vs breaking/off pitch count (qualified starters)');
  table(['fast+off', ...PITCHER_HEAD], groupBy(qualSP, (x) => `${x.nFast}+${x.size - x.nFast}`));
  console.log('## 2b2. Arsenal makeup (relievers, 50+ IP)');
  table(['fast+off', ...PITCHER_HEAD], groupBy(qualRP, (x) => `${x.nFast}+${x.size - x.nFast}`));
  console.log('## 2c. Thrown mix: share of fastball-type pitches thrown (qualified starters)');
  const shares = qualSP.map((x) => x.fastShare).sort((a, b) => a - b);
  console.log(`fastball share thrown: min ${pct(shares[0])}, 25th ${pct(shares[Math.floor(shares.length * 0.25)])}, median ${pct(shares[Math.floor(shares.length / 2)])}, 75th ${pct(shares[Math.floor(shares.length * 0.75)])}, max ${pct(shares[shares.length - 1])}\n`);
  const t1 = shares[Math.floor(shares.length / 3)];
  const t2 = shares[Math.floor((shares.length * 2) / 3)];
  table(['fastball share (thirds)', ...PITCHER_HEAD], groupBy(qualSP, (x) => (x.fastShare < t1 ? `a breaking-heavier (<${pct(t1)})` : x.fastShare < t2 ? 'b middle' : `c fastball-heavier (${pct(t2)}+)`)));
  console.log('## 2c2. Thrown mix, relievers 50+ IP (thirds)');
  {
    const rs = qualRP.map((x) => x.fastShare).sort((a, b) => a - b);
    const u1 = rs[Math.floor(rs.length / 3)];
    const u2 = rs[Math.floor((rs.length * 2) / 3)];
    console.log(`fastball share thrown: min ${pct(rs[0])}, median ${pct(rs[Math.floor(rs.length / 2)])}, max ${pct(rs[rs.length - 1])}\n`);
    table(['fastball share (thirds)', ...PITCHER_HEAD], groupBy(qualRP, (x) => (x.fastShare < u1 ? `a breaking-heavier (<${pct(u1)})` : x.fastShare < u2 ? 'b middle' : `c fastball-heavier (${pct(u2)}+)`)));
  }
  console.log('## 2e. Four-seam fastball share of all pitches thrown');
  const fbBand = (x) => (x.fbShare === 0 ? 'a none (sinker/cutter only)' : x.fbShare < 0.35 ? 'b under 35%' : x.fbShare < 0.5 ? 'c 35-50%' : 'd 50%+');
  console.log('### qualified starters');
  table(['four-seam share', ...PITCHER_HEAD], groupBy(qualSP, fbBand));
  console.log('### relievers, 50+ IP');
  table(['four-seam share', ...PITCHER_HEAD], groupBy(qualRP, fbBand));
  console.log('## 2d. Arsenal templates (qualified starters)');
  table(['arsenal', ...PITCHER_HEAD], groupBy(qualSP, (x) => x.types));

  // Correlations
  function corrBlock(label, xs) {
    const W = xs.map((x) => x.whip);
    const vars = [
      ['avg grade (all pitches)', (x) => x.gAll],
      ['avg grade, usage-weighted', (x) => x.gUse],
      ['avg fastball-type grade', (x) => x.gFast],
      ['avg breaking/off grade', (x) => x.gOff],
      ['Stuff', (x) => x.stf],
      ['Velocity', (x) => x.vel],
      ['Control', (x) => x.ctl],
    ];
    const X = xs.map((x) => [x.stf, x.vel, x.ctl]);
    const wr = residuals(X, W);
    console.log(`### ${label} (n = ${xs.length})`);
    console.log(`WHIP ~ ratings fit: WHIP = ${f3(wr.beta[0])} ${r2(wr.beta[1] * 10)}/10 Stf ${r2(wr.beta[2] * 10)}/10 Vel ${r2(wr.beta[3] * 10)}/10 Ctl\n`);
    table(['measure', 'r with WHIP', 'r with K%', 'r with BB%', 'r with hard%', 'partial r with WHIP (Stf, Vel, Ctl held)'], vars.map(([name, f]) => {
      const v = xs.map(f);
      const isRating = name === 'Stuff' || name === 'Velocity' || name === 'Control';
      let partial = '-';
      if (!isRating) partial = r2(pearson(residuals(X, v).res, wr.res));
      else {
        const others = xs.map((x) => [x.stf, x.vel, x.ctl].filter((_, i) => i !== ['Stuff', 'Velocity', 'Control'].indexOf(name)));
        partial = r2(pearson(residuals(others, v).res, residuals(others, W).res)) + ' (other two held)';
      }
      return [name, r2(pearson(v, W)), r2(pearson(v, xs.map((x) => x.kPct))), r2(pearson(v, xs.map((x) => x.bbPct))), r2(pearson(v, xs.map((x) => x.hardPct))), partial];
    }));
    // Ratings held equal, grouped view: WHIP left over after the ratings fit, by grade band.
    const rows = xs.map((x, i) => ({ x, res: wr.res[i] }));
    const m = {};
    for (const r of rows) (m[avgBand(r.x.gAll)] = m[avgBand(r.x.gAll)] || []).push(r.res);
    console.log('WHIP above (+) or below (-) what Stf/Vel/Ctl predict, by average grade:');
    table(['avg grade', 'pitchers', 'WHIP vs rating fit'], AVG_ORDER.filter((b) => m[b]).map((b) => [b, m[b].length, r2(mean(m[b]))]));
  }
  console.log('## 3/4. Correlations');
  corrBlock('qualified starters', qualSP);
  corrBlock('relievers, 50+ IP', qualRP);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
(async () => {
  const t0 = Date.now();
  const L = S.newFranchise({ userTeamId: 'LAK', difficulty: 'medium', seed: SEED });
  for (let si = 0; si < SEASONS; si++) {
    while (!S.phaseDone(L)) S.simDay(L);
    O.setOpeningDay(L, O.suggestRoster(L, S.userTeam(L)));
    S.advancePhase(L);
    season = {};
    const snap = {};
    for (const id in L.players) snap[id] = Object.assign({}, L.players[id].r);
    while (!S.phaseDone(L)) S.simDay(L);
    tracking = false;
    collect(L, si, snap);
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
    process.stderr.write(`season ${si + 1} done (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
  }
  report();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
