// Shared season checks for seasontest.js and franchisetest.js: reliever
// workload, days pitched in a row, starters' innings and the WAR scale.
// Thresholds are loose on purpose (seasons vary from run to run). Most sit
// between today's numbers and the numbers from before Milestone 1, so the
// old behavior fails them (measured over 10 old and 12 new seasons):
//                                   before M1        after M1      check
//   relief on a 3rd straight day    3,500-3,900      0             0
//   busiest reliever, relief IP     179-228          85-109        <= 125
//   most relief games               145-151          73-82         <= 95
//   top starter IP                  232-250          204-221       <= 226
//   hitters' share of WAR           59.2-60.4%       55.0-57.0%    <= 58%
//   relievers' share of WAR         -0.4-4.1%        6.2-13.1%     >= 5%
// Two are sanity bands that the old behavior also passed, because those
// numbers were already in range:
//   WAR total                       980-1,018        998-1,038     850-1,150
//   top 5 hitters, average WAR      6.0-7.4          6.7-10.3      6.0-12.5
// Milestone 1b (strikeout and slugging balance) added league bands; the
// Milestone 1 code fails the middle four:
//                                   before M1b       after M1b     check
//   runs per team-game              4.42-4.72        4.37-4.68     4.15-4.9
//   league strikeout rate           18.1-18.6%       20.8-21.4%    19.5-23%
//   league AVG                      .284-.287        .267-.275     .258-.280
//   extra-base hits per team-game   2.22-2.29        2.76-2.97     2.55-3.2
//   best qualified starter, K%      22-23%           27-32%        >= 25.5%
'use strict';

const dayNum = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000);

// Records regular-season relief appearances. Call reset() before a season.
function tracker(BB) {
  const t = { days: {}, outs: {}, noPitcher: 0 };
  BB.season.hooks.afterGame.push((L, gm, box) => {
    if (gm.type !== 'regular') return;
    const d = dayNum(gm.date);
    box.pit.forEach((side) => {
      if (!side.length) t.noPitcher++;
      side.forEach((line, k) => {
        if (!line.pid || k === 0) return; // relief only
        (t.days[line.pid] = t.days[line.pid] || []).push(d);
        t.outs[line.pid] = (t.outs[line.pid] || 0) + line.outs;
      });
    });
  });
  t.reset = () => {
    t.days = {};
    t.outs = {};
    t.noPitcher = 0;
  };
  return t;
}

// Numbers for the season that just ended (call before stats are archived).
function measure(BB, L, t) {
  const D = BB.depth;
  let third = 0;
  let longest = 0;
  let maxReliefOuts = 0;
  let maxReliefGames = 0;
  for (const pid in t.days) {
    const set = new Set(t.days[pid]);
    for (const d of set) {
      if (set.has(d - 1) && set.has(d - 2)) third++;
      if (!set.has(d - 1)) {
        let n = 1;
        while (set.has(d + n)) n++;
        if (n > longest) longest = n;
      }
    }
    maxReliefOuts = Math.max(maxReliefOuts, t.outs[pid]);
    maxReliefGames = Math.max(maxReliefGames, t.days[pid].length);
  }
  let total = 0;
  let hit = 0;
  let rel = 0;
  let topStarterOuts = 0;
  const hitters = [];
  for (const id in L.players) {
    const p = L.players[id];
    const s = p.stats.reg;
    if (!s.bat.pa && !s.pit.outs) continue;
    const w = D.value(L, p);
    total += w;
    if (D.isPitcher(p)) {
      if (s.pit.gs >= s.pit.g * 0.5) topStarterOuts = Math.max(topStarterOuts, s.pit.outs);
      else rel += w;
    } else {
      hit += w;
      hitters.push(w);
    }
  }
  hitters.sort((a, b) => b - a);
  const top5 = hitters.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(5, hitters.length));
  // League batting line and the best strikeout rate among qualified starters.
  const b = { ab: 0, h: 0, d: 0, t: 0, hr: 0, pa: 0, k: 0 };
  let bestK = 0;
  for (const id in L.players) {
    const s = L.players[id].stats.reg;
    for (const key in b) b[key] += s.bat[key];
    const bf = s.vsL.pa + s.vsR.pa;
    if (D.isPitcher(L.players[id]) && s.pit.outs >= 486 && s.pit.gs >= s.pit.g * 0.5 && bf) bestK = Math.max(bestK, s.pit.k / bf);
  }
  let runs = 0;
  let games = 0;
  for (const tm of L.teams) {
    runs += tm.rec.rs;
    games += tm.rec.w + tm.rec.l;
  }
  const line = { rpg: runs / Math.max(1, games), kPct: b.k / Math.max(1, b.pa), avg: b.h / Math.max(1, b.ab), xbh: (b.d + b.t + b.hr) / Math.max(1, games), bestK };
  return {
    line,
    third, longest, noPitcher: t.noPitcher,
    maxReliefIP: maxReliefOuts / 3, maxReliefGames,
    topStarterIP: topStarterOuts / 3,
    war: { total, hitShare: total ? hit / total : 0, relShare: total ? rel / total : 0, top5Hit: top5, best: hitters[0] || 0 },
  };
}

// [{ ok, text }] for the season that just ended.
function check(BB, L, t) {
  const m = measure(BB, L, t);
  const f1 = (x) => x.toFixed(1);
  const out = [];
  const add = (ok, text) => out.push({ ok, text });
  add(m.third === 0, `no reliever pitches a 3rd straight day (${m.third} such appearances, longest run ${m.longest} days)`);
  add(m.noPitcher === 0, `every team has a pitcher in every game (${m.noPitcher} without)`);
  add(m.maxReliefIP <= 125, `busiest reliever at most 125 IP in relief (${f1(m.maxReliefIP)})`);
  add(m.maxReliefGames <= 95, `most relief games at most 95 (${m.maxReliefGames})`);
  add(m.topStarterIP <= 226, `top starter at most 226 IP (${f1(m.topStarterIP)})`);
  add(m.war.total >= 850 && m.war.total <= 1150, `WAR total 850-1,150 (${f1(m.war.total)})`);
  add(m.war.hitShare >= 0.5 && m.war.hitShare <= 0.58, `hitters earn 50-58% of WAR (${f1(100 * m.war.hitShare)}%)`);
  add(m.war.relShare >= 0.05, `relievers earn at least 5% of WAR (${f1(100 * m.war.relShare)}%)`);
  add(m.war.top5Hit >= 6.0 && m.war.top5Hit <= 12.5, `top 5 hitters average 6.0-12.5 WAR (${f1(m.war.top5Hit)}, best ${f1(m.war.best)})`);
  // League balance (Milestone 1b).
  add(m.line.rpg >= 4.15 && m.line.rpg <= 4.9, `runs per team-game 4.15-4.9 (${m.line.rpg.toFixed(2)})`);
  add(m.line.kPct >= 0.195 && m.line.kPct <= 0.23, `league strikeout rate 19.5-23% (${f1(100 * m.line.kPct)}%)`);
  add(m.line.avg >= 0.258 && m.line.avg <= 0.28, `league AVG .258-.280 (${m.line.avg.toFixed(3).replace(/^0/, '')})`);
  add(m.line.xbh >= 2.55 && m.line.xbh <= 3.2, `extra-base hits per team-game 2.55-3.2 (${m.line.xbh.toFixed(2)})`);
  add(m.line.bestK >= 0.255, `best qualified starter strikes out at least 25.5% (${f1(100 * m.line.bestK)}%)`);
  // Reliever of the Year: a relief pitcher with a reliever's innings.
  const aw = L.awards || BB.depth.computeAwards(L, { dry: true });
  for (const lg of aw.leagues) {
    if (!lg.rel) continue;
    const q = L.players[lg.rel.pid].stats.reg.pit;
    add(q.gs <= q.g * 0.2 && q.outs <= 345, `${lg.name} Reliever of the Year is a reliever (${lg.rel.name}: ${q.g} G, ${q.gs} GS, ${f1(q.outs / 3)} IP, ${q.sv} SV)`);
  }
  return out;
}

module.exports = { tracker, measure, check };
