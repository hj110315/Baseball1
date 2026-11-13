// Postseason: the 12-team bracket (6 per league: 3 division winners plus 3
// wild cards; seeds 1-2 get a bye), series scheduled day by day, labels for
// the presentation layer, clinch and elimination marks in the standings, and
// the champion. Replaces BB.season.phases.postseason. No DOM access.
// Owned by the depth agent.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const LG = () => BB.league;
  const S = () => BB.season;
  const PS = (BB.post = BB.post || {});

  // Home patterns: 'hi' is the better seed (or better record in the final).
  const ROUNDS = [
    { key: 'wc', name: 'Wild Card Series', short: 'Wild Card', best: 3, slots: [1, 2, 3], home: ['hi', 'hi', 'hi'] },
    { key: 'ds', name: 'Division Series', short: 'Division Series', best: 5, slots: [1, 2, 'off', 3, 4, 'off', 5], home: ['hi', 'hi', 'lo', 'lo', 'hi'] },
    { key: 'lcs', name: 'League Championship Series', short: 'LCS', best: 7, slots: [1, 2, 'off', 3, 4, 5, 'off', 6, 7], home: ['hi', 'hi', 'lo', 'lo', 'lo', 'hi', 'hi'] },
    { key: 'final', name: 'Diamond Series', short: 'Diamond Series', best: 7, slots: [1, 2, 'off', 3, 4, 5, 'off', 6, 7], home: ['hi', 'hi', 'lo', 'lo', 'lo', 'hi', 'hi'] },
  ];

  const teamById = (L, id) => L.teams.find((t) => t.id === id) || null;
  const full = (t) => (t ? t.city + ' ' + t.name : '');
  const abbr = (L, id) => {
    const t = teamById(L, id);
    return t ? t.abbr : id;
  };
  const news = (L, text, kind, teamId) => S().addNews(L, text, kind, teamId);
  const byRecord = (a, b) => b.pct - a.pct || b.w - a.w || b.diff - a.diff || a.team.id.localeCompare(b.team.id);

  // ---------------------------------------------------------------------------
  // Seeds: three division winners (by record), then the three best others.
  // ---------------------------------------------------------------------------
  function seedLeague(L, lg) {
    const st = S().standings(L)[lg];
    const winners = st.divisions.map((d) => d.rows[0]).sort(byRecord);
    return winners.concat(st.wildcard.slice(0, 3)).map((r) => r.team.id);
  }
  function seeds(L) {
    return [seedLeague(L, 0), seedLeague(L, 1)];
  }

  // ---------------------------------------------------------------------------
  // Clinching (regular season). Sound bounds, never a guess:
  //   W = wins now, M = W + games left (best case).
  //   Division clinched ('x'): every division rival's M is below our W.
  //   Berth clinched ('w'): at most 2 teams could finish level with or ahead
  //     of us without winning their division. In each division with b teams
  //     whose M >= our W, at most b-1 of them are non-winners.
  //   Eliminated ('e'): a rival already has more wins than our M (so the
  //     division is gone) and at least 3 teams that can't all win their
  //     divisions already have more wins than our M.
  // ---------------------------------------------------------------------------
  function remainingGames(L) {
    const rem = {};
    for (const t of L.teams) rem[t.id] = 0;
    for (let i = Math.max(0, L.day); i < L.days.length; i++) {
      for (const gid of L.days[i].games) {
        const gm = L.games[gid];
        if (!gm || gm.type !== 'regular' || gm.status === 'final') continue;
        rem[gm.home]++;
        rem[gm.away]++;
      }
    }
    return rem;
  }

  function clinchMarks(L) {
    const rem = remainingGames(L);
    const marks = {};
    for (let lg = 0; lg < 2; lg++) {
      const teams = L.teams.filter((t) => t.league === lg);
      for (const T of teams) {
        const W = T.rec.w;
        const M = W + rem[T.id];
        let divClinch = true;
        let aOwn = 0;
        let sumB = 0;
        let sumA = 0;
        for (let dv = 0; dv < 3; dv++) {
          const others = teams.filter((x) => x.div === dv && x.id !== T.id);
          const b = others.filter((x) => x.rec.w + rem[x.id] >= W).length;
          const a = others.filter((x) => x.rec.w > M).length;
          if (dv === T.div) {
            divClinch = others.every((x) => x.rec.w + rem[x.id] < W);
            aOwn = a;
          }
          sumB += Math.max(0, b - 1);
          sumA += Math.max(0, a - 1);
        }
        marks[T.id] = divClinch ? 'x' : sumB <= 2 ? 'w' : aOwn >= 1 && sumA >= 3 ? 'e' : '';
      }
    }
    return marks;
  }

  function updateClinch(L) {
    if (L.phase !== 'regular') return;
    const marks = clinchMarks(L);
    for (const t of L.teams) {
      const was = t.clinch || '';
      const now = marks[t.id];
      if (now === was) continue;
      t.clinch = now;
      if (now === 'x') news(L, `The ${full(t)} clinch the ${LG().LEAGUES[t.league]} ${LG().DIVS[t.div]} title.`, 'clinch', t.id);
      else if (now === 'w' && was === '') news(L, `The ${full(t)} clinch a postseason berth.`, 'clinch', t.id);
      else if (now === 'e' && t.id === L.userTeamId) news(L, `The ${full(t)} are eliminated from postseason contention.`, 'clinch', t.id);
    }
  }

  // Final marks once the field is set.
  function markField(L, sd) {
    for (const t of L.teams) {
      const s = sd[t.league];
      const i = s.indexOf(t.id);
      t.clinch = i < 0 ? 'e' : i < 3 ? 'x' : 'w';
    }
  }

  // ---------------------------------------------------------------------------
  // Bracket
  // ---------------------------------------------------------------------------
  function newSeries(L, round, lg, hi, lo, hiSeed, loSeed, idx) {
    const R = ROUNDS[round];
    const s = {
      id: `${R.key}-${lg == null ? 'x' : lg}-${idx}`,
      round, key: R.key, name: R.name, lg,
      hi, lo, hiSeed, loSeed,
      best: R.best, need: Math.ceil(R.best / 2),
      wins: { [hi]: 0, [lo]: 0 },
      games: [], results: [],
      winner: null, loser: null, status: 'upcoming',
    };
    if (R.key === 'final') s.stats = {};
    L.post.series.push(s);
    return s;
  }

  function seriesIn(L, round) {
    return L.post ? L.post.series.filter((s) => s.round === round) : [];
  }
  function seriesById(L, id) {
    return L.post ? L.post.series.find((s) => s.id === id) || null : null;
  }
  function winnerOf(L, round, lg, hiSeed) {
    const s = seriesIn(L, round).find((x) => x.lg === lg && (x.hiSeed === hiSeed || x.loSeed === hiSeed));
    return s ? s.winner : null;
  }
  const seedOf = (L, lg, id) => L.post.seeds[lg].indexOf(id) + 1;

  // Better regular-season record (home field in the final).
  function betterRecord(L, a, b) {
    const ta = teamById(L, a);
    const tb = teamById(L, b);
    const pa = ta.rec.w / Math.max(1, ta.rec.w + ta.rec.l);
    const pb = tb.rec.w / Math.max(1, tb.rec.w + tb.rec.l);
    if (pa !== pb) return pa > pb ? a : b;
    if (ta.rec.w !== tb.rec.w) return ta.rec.w > tb.rec.w ? a : b;
    const da = ta.rec.rs - ta.rec.ra;
    const db = tb.rec.rs - tb.rec.ra;
    if (da !== db) return da > db ? a : b;
    return a < b ? a : b;
  }

  function makeRoundSeries(L, round) {
    const post = L.post;
    if (round === 0) {
      for (let lg = 0; lg < 2; lg++) {
        const sd = post.seeds[lg];
        newSeries(L, 0, lg, sd[2], sd[5], 3, 6, 0);
        newSeries(L, 0, lg, sd[3], sd[4], 4, 5, 1);
      }
    } else if (round === 1) {
      for (let lg = 0; lg < 2; lg++) {
        const sd = post.seeds[lg];
        const w45 = winnerOf(L, 0, lg, 4);
        const w36 = winnerOf(L, 0, lg, 3);
        newSeries(L, 1, lg, sd[0], w45, 1, seedOf(L, lg, w45), 0);
        newSeries(L, 1, lg, sd[1], w36, 2, seedOf(L, lg, w36), 1);
      }
    } else if (round === 2) {
      for (let lg = 0; lg < 2; lg++) {
        const [a, b] = seriesIn(L, 1).filter((s) => s.lg === lg).map((s) => s.winner);
        const sa = seedOf(L, lg, a);
        const sb = seedOf(L, lg, b);
        if (sa < sb) newSeries(L, 2, lg, a, b, sa, sb, 0);
        else newSeries(L, 2, lg, b, a, sb, sa, 0);
      }
    } else if (round === 3) {
      const a = seriesIn(L, 2).find((s) => s.lg === 0).winner;
      const b = seriesIn(L, 2).find((s) => s.lg === 1).winner;
      const hi = betterRecord(L, a, b);
      const lo = hi === a ? b : a;
      newSeries(L, 3, null, hi, lo, seedOf(L, teamById(L, hi).league, hi), seedOf(L, teamById(L, lo).league, lo), 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Calendar: one game day at a time, as series are set.
  // ---------------------------------------------------------------------------
  function nextDate(L) {
    const last = L.days[L.days.length - 1];
    return last ? LG().addDays(last.date, 1) : L.post.startDate;
  }

  function seriesText(L, s) {
    const a = s.wins[s.hi];
    const b = s.wins[s.lo];
    if (s.winner) return `${abbr(L, s.winner)} wins ${Math.max(a, b)}-${Math.min(a, b)}`;
    if (a === b) return `Series tied ${a}-${b}`;
    return `${abbr(L, a > b ? s.hi : s.lo)} leads ${Math.max(a, b)}-${Math.min(a, b)}`;
  }

  function makeGame(L, s, date, dayIdx) {
    const R = ROUNDS[s.round];
    const n = s.games.length + 1;
    const home = R.home[n - 1] === 'hi' ? s.hi : s.lo;
    const away = home === s.hi ? s.lo : s.hi;
    const gm = LG().newGame(L, 'post', date, away, home, dayIdx);
    gm.series = { id: s.id, round: R.key, gameNum: n };
    const clinchFor = [s.hi, s.lo].filter((id) => s.wins[id] === s.need - 1);
    const userIn = home === L.userTeamId || away === L.userTeamId;
    gm.meta = {
      label: `${R.name} · Game ${n}`,
      round: R.key,
      roundName: R.name,
      gameNum: n,
      best: R.best,
      seriesId: s.id,
      seriesText: seriesText(L, s),
      clinchFor, // teams that win the series with a win today
      clinch: R.key === 'final' && userIn && clinchFor.includes(L.userTeamId),
    };
    s.games.push(gm.id);
    s.status = 'live';
    return gm;
  }

  function pushDay(L, games, event) {
    const d = { date: nextDate(L), phase: 'postseason', games, event: event || null };
    L.days.push(d);
    return d;
  }

  // Schedule the next game day of the current round (with any travel off day).
  function scheduleSlot(L) {
    const post = L.post;
    const R = ROUNDS[post.cur];
    const live = seriesIn(L, post.cur).filter((s) => !s.winner);
    if (!live.length) return false;
    while (post.step < R.slots.length && R.slots[post.step] === 'off') {
      pushDay(L, [], 'off');
      post.step++;
    }
    post.step++;
    const date = nextDate(L);
    const dayIdx = L.days.length;
    const d = { date, phase: 'postseason', games: [], event: null };
    for (const s of live) d.games.push(makeGame(L, s, date, dayIdx).id);
    L.days.push(d);
    return true;
  }

  function startRound(L, round) {
    const post = L.post;
    post.cur = round;
    post.step = 0;
    makeRoundSeries(L, round);
    const R = ROUNDS[round];
    // Aces first: each team's rotation restarts at the top (rest permitting).
    for (const s of seriesIn(L, round)) {
      for (const id of [s.hi, s.lo]) {
        const t = teamById(L, id);
        if (t) t.rotIdx = 0;
      }
    }
    if (round > 0) pushDay(L, [], 'off');
    const list = seriesIn(L, round);
    news(L, `${R.name}: ` + list.map((s) => `${abbr(L, s.lo)} at ${abbr(L, s.hi)}`).join(', ') + '.', 'postseason');
    scheduleSlot(L);
  }

  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------
  function afterGame(L, gm, box) {
    if (gm.type !== 'post' || !gm.series || !L.post) return;
    const s = seriesById(L, gm.series.id);
    if (!s || s.winner || !box) return;
    const w = box.score[0] > box.score[1] ? gm.away : gm.home;
    const lo = w === gm.away ? gm.home : gm.away;
    s.wins[w]++;
    s.results.push({ gid: gm.id, n: gm.series.gameNum, away: gm.away, home: gm.home, score: box.score.slice(), winner: w, innings: box.innings });
    if (s.stats) addSeriesStats(s, box);
    L.post.played = (L.post.played || 0) + 1;
    const R = ROUNDS[s.round];
    if (s.wins[w] >= s.need) {
      s.winner = w;
      s.loser = lo;
      s.status = 'done';
      const tw = teamById(L, w);
      const tl = teamById(L, lo);
      if (R.key === 'final') {
        L.post.champion = w;
        L.post.runnerUp = lo;
        L.post.mvp = seriesMvp(L, s, w);
        news(L, `The ${full(tw)} win the ${L.year} Diamond Series, beating the ${full(tl)} ${s.wins[w]}-${s.wins[lo]}!`, 'champion', w);
        if (L.post.mvp) news(L, `Diamond Series MVP: ${L.post.mvp.name} (${tw.abbr}), ${L.post.mvp.line}.`, 'award', w);
        if (L.awards && L.awards.year === L.year) L.awards.seriesMvp = L.post.mvp;
      } else {
        news(L, `The ${full(tw)} beat the ${full(tl)} ${s.wins[w]}-${s.wins[lo]} in the ${R.name}.`, 'postseason', w);
      }
    } else if (gm.home === L.userTeamId || gm.away === L.userTeamId) {
      const mine = gm.home === L.userTeamId ? gm.home : gm.away;
      news(L, `${R.name} Game ${gm.series.gameNum}: ${abbr(L, gm.away)} ${box.score[0]}, ${abbr(L, gm.home)} ${box.score[1]}. ${seriesText(L, s)}.`, 'postseason', mine);
    }
  }

  function addSeriesStats(s, box) {
    for (let i = 0; i < 2; i++) {
      for (const b of box.bat[i]) {
        if (!b.pid) continue;
        const x = (s.stats[b.pid] = s.stats[b.pid] || { ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, r: 0, bb: 0, outs: 0, k: 0, er: 0, gs: 0 });
        for (const k of ['ab', 'h', 'd', 't', 'hr', 'rbi', 'r', 'bb']) x[k] += b[k] || 0;
      }
      for (const q of box.pit[i]) {
        if (!q.pid) continue;
        const x = (s.stats[q.pid] = s.stats[q.pid] || { ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, r: 0, bb: 0, outs: 0, k: 0, er: 0, gs: 0 });
        x.outs += q.outs;
        x.k += q.k;
        x.er += q.er;
        x.gs += q.gs || 0;
      }
    }
  }

  function seriesMvp(L, s, w) {
    let best = null;
    let bs = -1e9;
    for (const pid in s.stats) {
      const p = L.players[pid];
      if (!p || p.teamId !== w) continue;
      const x = s.stats[pid];
      const bat = x.h + x.d + 2 * x.t + 3 * x.hr + x.rbi + x.r + 0.5 * x.bb;
      const pit = x.outs / 3 + x.k * 0.5 - x.er * 1.5;
      const sc = Math.max(x.ab ? bat - x.ab * 0.2 : -1e9, x.outs ? pit : -1e9);
      if (sc > bs) {
        bs = sc;
        const isPit = x.outs && pit >= bat - x.ab * 0.2;
        const line = isPit
          ? `${S().ipText(x.outs)} IP, ${x.k} K, ${((x.er * 27) / Math.max(1, x.outs)).toFixed(2)} ERA`
          : `${x.h}-for-${x.ab}, ${x.hr} HR, ${x.rbi} RBI`;
        best = { pid, name: p.name, teamId: w, pos: p.pos, line };
      }
    }
    return best;
  }

  function afterDay(L, d) {
    if (L.phase === 'regular') {
      updateClinch(L);
      return;
    }
    if (L.phase !== 'postseason' || !L.post || L.post.champion) return;
    if (L.day + 1 < L.days.length) return; // tomorrow is already on the calendar
    const live = seriesIn(L, L.post.cur).filter((s) => !s.winner);
    if (live.length) scheduleSlot(L);
    else if (L.post.cur < ROUNDS.length - 1) startRound(L, L.post.cur + 1);
  }

  S().hooks.afterGame.push(afterGame);
  S().hooks.afterDay.push(afterDay);

  // ---------------------------------------------------------------------------
  // Phase handler
  // ---------------------------------------------------------------------------
  S().phases.postseason = {
    start(L) {
      const last = L.days.length ? L.days[L.days.length - 1].date : L.year + '-09-28';
      if (BB.depth && BB.depth.computeAwards && !(L.awards && L.awards.year === L.year)) BB.depth.computeAwards(L);
      const sd = seeds(L);
      markField(L, sd);
      L.post = {
        year: L.year, seeds: sd, series: [], cur: -1, step: 0,
        champion: null, runnerUp: null, mvp: null, played: 0,
        startDate: LG().addDays(last, 2),
      };
      L.day = 0;
      L.days = [];
      for (let lg = 0; lg < 2; lg++) {
        news(L, `${LG().LEAGUES[lg]} postseason field: ` + sd[lg].map((id, i) => `${i + 1}. ${abbr(L, id)}`).join(', ') + '.', 'postseason');
      }
      const u = L.userTeamId;
      const ut = teamById(L, u);
      const ui = sd[ut.league].indexOf(u);
      news(L, ui >= 0 ? `The ${full(ut)} are the No. ${ui + 1} seed in the ${LG().LEAGUES[ut.league]}${ui < 2 ? ' and get a bye to the Division Series' : ''}.` : `The ${full(ut)} miss the postseason.`, 'postseason', u);
      startRound(L, 0);
    },
    end(L) {
      if (L.post) L.post.done = true;
    },
    done: (L) => !!(L.post && L.post.champion),
  };

  // ---------------------------------------------------------------------------
  // Queries for the UI
  // ---------------------------------------------------------------------------
  // The user's next unplayed postseason game, if any.
  function nextUserGame(L) {
    if (L.phase !== 'postseason') return null;
    for (let i = L.day; i < L.days.length; i++) {
      for (const gid of L.days[i].games) {
        const gm = L.games[gid];
        if (gm && gm.status !== 'final' && (gm.home === L.userTeamId || gm.away === L.userTeamId)) return gm;
      }
    }
    return null;
  }

  // Where the user's team stands: { state: 'out'|'bye'|'alive'|'eliminated'|'champion', text, series }
  function userStatus(L) {
    const u = L.userTeamId;
    if (!L.post) return { state: 'none', text: '' };
    const ut = teamById(L, u);
    const seed = L.post.seeds[ut.league].indexOf(u) + 1;
    if (!seed) return { state: 'out', text: 'Your team did not make the postseason.' };
    if (L.post.champion === u) return { state: 'champion', text: `Your team won the ${L.year} Diamond Series!`, seed };
    const mine = L.post.series.filter((s) => s.hi === u || s.lo === u);
    const lost = mine.find((s) => s.loser === u);
    if (lost) return { state: 'eliminated', text: `Eliminated in the ${lost.name} by ${abbr(L, lost.winner)} (${lost.wins[lost.winner]}-${lost.wins[u]}).`, series: lost, seed };
    const live = mine.find((s) => !s.winner);
    if (live) {
      const opp = live.hi === u ? live.lo : live.hi;
      return { state: 'alive', text: `${live.name} vs ${abbr(L, opp)}: ${seriesText(L, live)}.`, series: live, seed };
    }
    return { state: 'bye', text: `No. ${seed} seed: waiting for the next round.`, seed };
  }

  // Projected field from the current standings (before the postseason).
  function projected(L) {
    return seeds(L);
  }

  Object.assign(PS, {
    ROUNDS, seeds, projected, clinchMarks, updateClinch, seriesIn, seriesById, seriesText, nextUserGame, userStatus, betterRecord,
  });
})(typeof window !== 'undefined' ? window : globalThis);
