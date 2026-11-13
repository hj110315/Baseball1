// Season: the calendar, simulating days, recording results, standings,
// leaders and the phase machine (spring → regular → postseason → offseason).
// Depth files (depth.js, postseason.js, offseason.js) extend it through
// hooks, phase handlers and custom game types. No DOM access.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const LG = () => BB.league;
  const EN = () => BB.engine;

  const hooks = { afterGame: [], afterDay: [], beforeDay: [] };
  // Special game types (for example the All-Star Game) can supply their own
  // create/sim/record: { create(L, game, { userSide }) → g, sim(L, game) → { g, box }, record(L, game, box, g) }.
  const customGames = {};
  const NEXT = { spring: 'regular', regular: 'postseason', postseason: 'offseason', offseason: 'spring' };

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------
  const player = (L, pid) => L.players[pid] || null;
  const team = (L, id) => L.teams.find((t) => t.id === id) || null;
  const userTeam = (L) => team(L, L.userTeamId);
  const teamOf = (L, pid) => {
    const p = player(L, pid);
    return p && p.teamId ? team(L, p.teamId) : null;
  };
  const isUserGame = (L, game) => game.home === L.userTeamId || game.away === L.userTeamId || !!(game.meta && game.meta.userPlays);

  function addNews(L, text, kind, teamId) {
    const d = L.days[L.day] || L.days[L.days.length - 1];
    L.news.unshift({ date: d ? d.date : L.year + '-01-01', text, kind: kind || 'info', teamId: teamId || null });
    if (L.news.length > 300) L.news.length = 300;
  }

  // ---------------------------------------------------------------------------
  // New franchise
  // ---------------------------------------------------------------------------
  function newFranchise(opts) {
    const L = LG().create(opts);
    L.phase = 'spring';
    phases.spring.start(L);
    const t = userTeam(L);
    addNews(L, `You take over the ${t.city} ${t.name}. Spring training opens ${L.days[0].date}.`, 'franchise', t.id);
    return L;
  }

  // ---------------------------------------------------------------------------
  // Days
  // ---------------------------------------------------------------------------
  function today(L) {
    const d = L.days[L.day];
    if (!d) return { day: L.day, date: null, phase: L.phase, event: null, games: [], userGame: null, done: true };
    const games = d.games.map((id) => L.games[id]).filter(Boolean);
    return {
      day: L.day,
      date: d.date,
      phase: d.phase,
      event: d.event,
      games,
      userGame: games.find((gm) => isUserGame(L, gm)) || null,
      done: false,
    };
  }

  function phaseDone(L) {
    const h = phases[L.phase];
    return h && h.done ? h.done(L) : L.day >= L.days.length;
  }

  // Once per day, before the first game: depth charts and roster health.
  function startDay(L) {
    const d = L.days[L.day];
    if (!d || d.started) return;
    d.started = true;
    for (const t of L.teams) {
      ensureRoster(L, t);
      LG().autoManage(L, t);
    }
    for (const fn of hooks.beforeDay) fn(L, d);
  }

  // Make sure a team can field 9 healthy hitters and has arms: call up reserves.
  function ensureRoster(L, t) {
    const healthy = (id) => {
      const p = player(L, id);
      return p && !p.injury;
    };
    const count = (pred) => t.roster.filter((id) => healthy(id) && pred(player(L, id))).length;
    const promote = (pred) => {
      const cands = t.reserves.map((id) => player(L, id)).filter((p) => p && !p.injury && pred(p));
      if (!cands.length) return false;
      cands.sort((a, b) => b.ovr - a.ovr);
      const p = cands[0];
      t.reserves = t.reserves.filter((id) => id !== p.id);
      t.roster.push(p.id);
      p.status = 'active';
      return true;
    };
    let guard = 0;
    while (count((p) => !LG().isPitcher(p)) < 10 && guard++ < 6 && promote((p) => !LG().isPitcher(p)));
    guard = 0;
    while (count((p) => LG().isPitcher(p)) < 11 && guard++ < 6 && promote((p) => LG().isPitcher(p)));
  }

  function endDay(L) {
    const d = L.days[L.day];
    for (const fn of hooks.afterDay) fn(L, d);
    for (const id in L.players) {
      const p = L.players[id];
      if (p.arm) p.arm.rest = Math.min(9, p.arm.rest + 1);
    }
    // Keep full box scores for the user's games and the last few days only.
    for (const gid in L.games) {
      const gm = L.games[gid];
      if (gm.box && gm.status === 'final' && !isUserGame(L, gm) && gm.day < L.day - 3) gm.box = null;
    }
    L.day++;
  }

  function dayComplete(L) {
    const d = L.days[L.day];
    return !d || d.games.every((id) => !L.games[id] || L.games[id].status === 'final');
  }

  // Sim every unplayed game today and finish the day. includeUser: false
  // leaves the user's game for them (the day stays open).
  function simDay(L, opts) {
    const o = opts || {};
    const includeUser = o.includeUser !== false;
    const d = L.days[L.day];
    if (!d) return { results: [], phaseDone: true };
    startDay(L);
    const results = [];
    for (const id of d.games) {
      const gm = L.games[id];
      if (!gm || gm.status === 'final') continue;
      if (!includeUser && isUserGame(L, gm)) continue;
      simAndRecord(L, gm);
      results.push(gm);
    }
    if (dayComplete(L)) endDay(L);
    return { results, phaseDone: phaseDone(L) };
  }

  function simAndRecord(L, gm) {
    const custom = customGames[gm.type];
    const r = custom && custom.sim ? custom.sim(L, gm) : EN().simGame(L, gm);
    recordGame(L, gm, r.box, r.g);
  }

  // Sim several days. target.to: 'day' | 'week' | 'month' | 'allstar' |
  // 'endRegular' | 'endPhase' | 'date' | 'nextUserGame'. With includeUser false
  // (the default) it stops before any day where the user still has a game.
  async function simUntil(L, target, opts) {
    const o = opts || {};
    const to = target.to;
    const start = L.day;
    const span = to === 'day' ? 1 : to === 'week' ? 7 : to === 'month' ? 30 : null;
    const total = Math.max(1, span || L.days.length - start);
    let stoppedBy = 'target';
    let n = 0;
    while (true) {
      if (phaseDone(L)) {
        stoppedBy = 'phaseEnd';
        break;
      }
      if (span && n >= span) break;
      const t = today(L);
      // (depth agent) No day left to play, e.g. the offseason has no calendar:
      // stop instead of looping on empty days.
      if (t.done) {
        stoppedBy = 'phaseEnd';
        break;
      }
      if (to === 'date' && target.date && t.date >= target.date) break;
      if (to === 'allstar' && t.event === 'allstar') break;
      const pendingUser = t.userGame && t.userGame.status !== 'final';
      if (pendingUser && (to === 'nextUserGame' || !o.includeUser)) {
        stoppedBy = 'userGame';
        break;
      }
      if (o.shouldStop && o.shouldStop()) {
        stoppedBy = 'cancelled';
        break;
      }
      simDay(L, { includeUser: true });
      n++;
      if (o.onProgress) o.onProgress(Math.min(1, n / total), today(L).date);
      // Let the browser breathe between days.
      if (n % 2 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { days: n, stoppedBy };
  }

  // ---------------------------------------------------------------------------
  // The user's games
  // ---------------------------------------------------------------------------
  // mode 'play': from the first pitch. 'quick': sim to the first key moment
  // (late and close); if there isn't one, the game is finished and recorded.
  function startUserGame(L, gid, mode) {
    const gm = L.games[gid];
    if (!gm || gm.status === 'final') return null;
    startDay(L);
    // Everyone else plays first.
    const d = L.days[L.day];
    if (d && d.games.includes(gid)) {
      for (const id of d.games) {
        const other = L.games[id];
        if (other && other.status !== 'final' && id !== gid) simAndRecord(L, other);
      }
    }
    const userSide = gm.home === L.userTeamId ? 'home' : gm.away === L.userTeamId ? 'away' : (gm.meta && gm.meta.userSide) || null;
    const custom = customGames[gm.type];
    const g = custom && custom.create ? custom.create(L, gm, { userSide }) : EN().createGame(L, gm, { userSide });
    if (mode === 'quick') {
      EN().runHeadless(g, { stopWhen: EN().isKeyMoment });
      if (g.over) {
        const box = EN().box(g, true);
        recordGame(L, gm, box, g);
        if (dayComplete(L)) endDay(L);
        return { done: true, box, g };
      }
    }
    return { g, done: false };
  }

  function finishUserGame(L, gid, g) {
    const gm = L.games[gid];
    if (!gm || gm.status === 'final') return null;
    if (!g.over) EN().finishHeadless(g);
    const box = EN().box(g, true);
    recordGame(L, gm, box, g);
    if (L.days[L.day] && L.days[L.day].games.includes(gid) && dayComplete(L)) endDay(L);
    return box;
  }

  // ---------------------------------------------------------------------------
  // Recording results
  // ---------------------------------------------------------------------------
  const BAT_KEYS = ['pa', 'ab', 'r', 'h', 'd', 't', 'hr', 'rbi', 'bb', 'k', 'sb', 'cs'];
  const SPLIT_KEYS = ['pa', 'ab', 'h', 'd', 't', 'hr', 'bb', 'k'];
  const PIT_KEYS = ['outs', 'h', 'r', 'er', 'bb', 'k', 'hr', 'pitches', 'gs'];

  function addSplit(dst, src) {
    if (!src) return;
    for (const k of SPLIT_KEYS) dst[k] += src[k] || 0;
  }

  function recordGame(L, gm, box, g) {
    const custom = customGames[gm.type];
    if (custom && custom.record && custom.record(L, gm, box, g) === true) return; // fully handled
    gm.status = 'final';
    gm.score = box.score.slice();
    gm.innings = box.innings;
    gm.wp = box.wp;
    gm.lp = box.lp;
    gm.sv = box.sv;
    const splits = box.splits;
    delete box.splits;
    gm.box = box;
    const bucket = gm.type === 'regular' ? 'reg' : gm.type === 'post' ? 'post' : gm.type === 'spring' ? 'spring' : null;
    const sides = [team(L, gm.away), team(L, gm.home)];
    const winner = box.score[0] === box.score[1] ? -1 : box.score[0] > box.score[1] ? 0 : 1;

    // Team records
    sides.forEach((t, i) => {
      if (!t) return;
      const won = winner === i;
      if (gm.type === 'regular') {
        const r = t.rec;
        if (won) r.w++;
        else r.l++;
        r.rs += box.score[i];
        r.ra += box.score[1 - i];
        if (i === 1) won ? r.hw++ : r.hl++;
        else won ? r.aw++ : r.al++;
        r.streak = won ? (r.streak > 0 ? r.streak + 1 : 1) : r.streak < 0 ? r.streak - 1 : -1;
        r.last.push(won ? 1 : 0);
        if (r.last.length > 10) r.last.shift();
      } else if (gm.type === 'spring') {
        if (won) t.springRec.w++;
        else t.springRec.l++;
      }
      // Rotation: the next starter is the one after today's.
      const st = g && g.teams[i] && g.teams[i].appear[0];
      if (st && st.pid && (gm.type === 'regular' || gm.type === 'spring' || gm.type === 'post')) {
        const idx = t.rotation.indexOf(st.pid);
        if (idx >= 0) t.rotIdx = (idx + 1) % Math.max(1, t.rotation.length);
      }
    });

    // Players
    sides.forEach((t, i) => {
      const opp = sides[1 - i];
      const home = i === 1;
      const res = winner === -1 ? 'T' : winner === i ? 'W' : 'L';
      const resText = `${res} ${box.score[i]}-${box.score[1 - i]}`;
      const cap = t && t.id === L.userTeamId ? 170 : 15;
      box.bat[i].forEach((line, k) => {
        const p = line.pid && player(L, line.pid);
        if (!p) return;
        if (bucket) {
          const st = p.stats[bucket];
          st.bat.g++;
          st.bat.gs++;
          for (const key of BAT_KEYS) st.bat[key] += line[key] || 0;
          const sp = splits && splits.bat[i] && splits.bat[i][k];
          if (sp) {
            addSplit(st.vsL, sp.L);
            addSplit(st.vsR, sp.R);
            addSplit(home ? st.home : st.away, sp.L);
            addSplit(home ? st.home : st.away, sp.R);
          }
        }
        pushLog(p, cap, { gid: gm.id, date: gm.date, type: gm.type, opp: opp ? opp.abbr : '', home, res: resText, bat: [line.ab, line.h, line.hr, line.rbi, line.bb, line.k], pit: null });
      });
      box.pit[i].forEach((line, k) => {
        const p = line.pid && player(L, line.pid);
        if (!p) return;
        if (bucket) {
          const st = p.stats[bucket];
          st.pit.g++;
          for (const key of PIT_KEYS) st.pit[key] += line[key] || 0;
          if (line.dec === 'W') st.pit.w++;
          if (line.dec === 'L') st.pit.l++;
          if (line.dec === 'S') st.pit.sv++;
          const sp = splits && splits.pit[i] && splits.pit[i][k];
          if (sp) {
            addSplit(st.vsL, sp.L);
            addSplit(st.vsR, sp.R);
          }
        }
        if (p.arm) {
          p.arm.rest = 0;
          p.arm.last = line.pitches;
        }
        pushLog(p, cap, { gid: gm.id, date: gm.date, type: gm.type, opp: opp ? opp.abbr : '', home, res: resText, bat: null, pit: [line.outs, line.h, line.er, line.bb, line.k, line.dec] });
      });
    });
    for (const fn of hooks.afterGame) fn(L, gm, box, g);
  }

  function pushLog(p, cap, entry) {
    p.log.push(entry);
    if (p.log.length > cap) p.log.splice(0, p.log.length - cap);
  }

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------
  function ipText(outs) {
    return Math.floor(outs / 3) + '.' + (outs % 3);
  }
  function calc(stat) {
    const b = stat.bat;
    const p = stat.pit;
    const tb = b.h + b.d + 2 * b.t + 3 * b.hr;
    const avg = b.ab ? b.h / b.ab : 0;
    const obp = b.pa ? (b.h + b.bb) / b.pa : 0;
    const slg = b.ab ? tb / b.ab : 0;
    const ip = p.outs / 3;
    return {
      avg, obp, slg, ops: obp + slg, tb,
      era: p.outs ? (p.er * 27) / p.outs : p.er ? 99.99 : 0,
      whip: p.outs ? ((p.h + p.bb) * 3) / p.outs : 0,
      k9: p.outs ? (p.k * 27) / p.outs : 0,
      bb9: p.outs ? (p.bb * 27) / p.outs : 0,
      ip, ipText: ipText(p.outs),
    };
  }
  // Batting line of a split object (vsL, vsR, home, away).
  function calcSplit(s) {
    return {
      avg: s.ab ? s.h / s.ab : 0,
      obp: s.pa ? (s.h + s.bb) / s.pa : 0,
      slg: s.ab ? (s.h + s.d + 2 * s.t + 3 * s.hr) / s.ab : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Standings
  // ---------------------------------------------------------------------------
  function row(t) {
    const r = t.rec;
    const g = r.w + r.l;
    const l10w = r.last.reduce((a, b) => a + b, 0);
    return {
      team: t,
      w: r.w,
      l: r.l,
      pct: g ? r.w / g : 0,
      gb: 0,
      wcgb: 0,
      rs: r.rs,
      ra: r.ra,
      diff: r.rs - r.ra,
      home: r.hw + '-' + r.hl,
      away: r.aw + '-' + r.al,
      last10: l10w + '-' + (r.last.length - l10w),
      streak: r.streak === 0 ? '-' : (r.streak > 0 ? 'W' : 'L') + Math.abs(r.streak),
      clinch: t.clinch || '',
    };
  }
  const byRecord = (a, b) => b.pct - a.pct || b.w - a.w || b.diff - a.diff || a.team.id.localeCompare(b.team.id);
  const gamesBack = (lead, r) => (lead.w - r.w + (r.l - lead.l)) / 2;

  function standings(L) {
    return LG().LEAGUES.map((name, lg) => {
      const divisions = LG().DIVS.map((dname, dv) => {
        const rows = L.teams.filter((t) => t.league === lg && t.div === dv).map(row).sort(byRecord);
        rows.forEach((r) => (r.gb = gamesBack(rows[0], r)));
        return { name: dname, rows };
      });
      const leaders = new Set(divisions.map((d) => d.rows[0].team.id));
      const wildcard = L.teams.filter((t) => t.league === lg && !leaders.has(t.id)).map(row).sort(byRecord);
      const cut = wildcard[2];
      wildcard.forEach((r) => (r.wcgb = cut ? gamesBack(cut, r) : 0));
      return { name, divisions, wildcard };
    });
  }

  // ---------------------------------------------------------------------------
  // Leaders
  // ---------------------------------------------------------------------------
  const LEADER_STATS = {
    avg: { kind: 'bat', label: 'AVG', val: (s, c) => c.avg, rate: true },
    obp: { kind: 'bat', label: 'OBP', val: (s, c) => c.obp, rate: true },
    slg: { kind: 'bat', label: 'SLG', val: (s, c) => c.slg, rate: true },
    ops: { kind: 'bat', label: 'OPS', val: (s, c) => c.ops, rate: true },
    hr: { kind: 'bat', label: 'HR', val: (s) => s.bat.hr },
    rbi: { kind: 'bat', label: 'RBI', val: (s) => s.bat.rbi },
    r: { kind: 'bat', label: 'R', val: (s) => s.bat.r },
    h: { kind: 'bat', label: 'H', val: (s) => s.bat.h },
    d: { kind: 'bat', label: '2B', val: (s) => s.bat.d },
    sb: { kind: 'bat', label: 'SB', val: (s) => s.bat.sb },
    bb: { kind: 'bat', label: 'BB', val: (s) => s.bat.bb },
    era: { kind: 'pit', label: 'ERA', val: (s, c) => c.era, rate: true, asc: true },
    whip: { kind: 'pit', label: 'WHIP', val: (s, c) => c.whip, rate: true, asc: true },
    w: { kind: 'pit', label: 'W', val: (s) => s.pit.w },
    k: { kind: 'pit', label: 'SO', val: (s) => s.pit.k },
    sv: { kind: 'pit', label: 'SV', val: (s) => s.pit.sv },
    ip: { kind: 'pit', label: 'IP', val: (s) => s.pit.outs },
    k9: { kind: 'pit', label: 'K/9', val: (s, c) => c.k9, rate: true },
  };

  function leaders(L, opts) {
    const o = Object.assign({ stat: 'avg', phase: 'reg', lg: null, limit: 10, qualified: true }, opts || {});
    const def = LEADER_STATS[o.stat];
    if (!def) return [];
    const out = [];
    for (const id in L.players) {
      const p = L.players[id];
      if (!p.teamId) continue;
      const t = team(L, p.teamId);
      if (!t || (o.lg != null && t.league !== o.lg)) continue;
      const s = p.stats[o.phase];
      if (!s) continue;
      if (def.kind === 'bat' && !s.bat.pa) continue;
      if (def.kind === 'pit' && !s.pit.outs) continue;
      if (def.rate && o.qualified) {
        const gp = o.phase === 'reg' ? t.rec.w + t.rec.l : 0;
        if (def.kind === 'bat' && s.bat.pa < Math.max(o.phase === 'reg' ? 3.1 * gp : 10, 10)) continue;
        if (def.kind === 'pit' && s.pit.outs < Math.max(o.phase === 'reg' ? 3 * gp : 9, 9)) continue;
      }
      out.push({ player: p, team: t, value: def.val(s, calc(s)) });
    }
    out.sort((a, b) => (def.asc ? a.value - b.value : b.value - a.value));
    return out.slice(0, o.limit);
  }

  // ---------------------------------------------------------------------------
  // Season rollover helpers (used by the offseason)
  // ---------------------------------------------------------------------------
  function hasStats(s) {
    return s && (s.bat.pa > 0 || s.pit.outs > 0 || s.pit.g > 0);
  }
  // Moves this season's stats into each player's career and clears them.
  function archiveSeason(L) {
    for (const id in L.players) {
      const p = L.players[id];
      if (hasStats(p.stats.reg) || hasStats(p.stats.post)) {
        p.career.push({ year: L.year, teamId: p.teamId, reg: p.stats.reg, post: p.stats.post });
      }
      p.stats = LG().freshStats();
      p.log = [];
    }
  }

  // ---------------------------------------------------------------------------
  // Phases. depth/postseason/offseason files replace or extend these.
  // ---------------------------------------------------------------------------
  const phases = {
    spring: {
      start(L) {
        L.day = 0;
        L.days = LG().springDays(L, Math.random);
        for (const t of L.teams) {
          t.springRec = { w: 0, l: 0 };
          LG().autoManage(L, t);
        }
        addNews(L, `Spring training opens.`, 'season');
      },
      end(L) {
        // Opening Day rosters: 26 active.
        for (const t of L.teams) {
          while (t.roster.length > 26) {
            const worst = t.roster.map((id) => player(L, id)).sort((a, b) => a.ovr - b.ovr)[0];
            t.roster = t.roster.filter((id) => id !== worst.id);
            t.reserves.push(worst.id);
            worst.status = 'reserve';
          }
        }
      },
      done: (L) => L.day >= L.days.length,
    },
    regular: {
      start(L) {
        L.day = 0;
        L.days = LG().regularDays(L, Math.random);
        for (const t of L.teams) {
          t.rec = LG().newRec();
          t.clinch = '';
          LG().autoManage(L, t);
        }
        addNews(L, `Opening Day: the ${L.year} season begins.`, 'season');
      },
      end() {},
      done: (L) => L.day >= L.days.length,
    },
    // Simple stand-ins until postseason.js / offseason.js replace them.
    postseason: {
      start(L) {
        L.day = 0;
        L.days = [];
        const best = L.teams.slice().sort((a, b) => b.rec.w - a.rec.w)[0];
        L.post = { champion: best.id, stub: true };
        addNews(L, `${best.city} ${best.name} finish with the best record.`, 'season', best.id);
      },
      end() {},
      done: () => true,
    },
    offseason: {
      start(L) {
        L.history.push({ year: L.year, champion: L.post ? L.post.champion : null, runnerUp: null, awards: L.awards, records: L.teams.map((t) => ({ id: t.id, w: t.rec.w, l: t.rec.l })) });
        archiveSeason(L);
        for (const id in L.players) L.players[id].age++;
        L.year++;
        L.games = {};
        L.days = [];
        L.day = 0;
        L.offStep = 'done';
      },
      end(L) {
        L.offStep = null;
        L.post = null;
        L.awards = null;
        L.allStar = null;
      },
      done: (L) => L.offStep === 'done',
    },
  };

  function advancePhase(L) {
    const cur = L.phase;
    phases[cur].end(L);
    L.phase = NEXT[cur];
    phases[L.phase].start(L);
    return L.phase;
  }

  BB.season = {
    hooks, customGames, phases, NEXT,
    newFranchise, today, phaseDone, startDay, simDay, simUntil, startUserGame, finishUserGame, recordGame,
    standings, leaders, LEADER_STATS, calc, calcSplit, ipText, archiveSeason, advancePhase, addNews, ensureRoster,
    endDay, dayComplete, player, team, userTeam, teamOf, isUserGame,
  };
})(typeof window !== 'undefined' ? window : globalThis);
