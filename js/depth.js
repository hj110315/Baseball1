// Season depth: injuries and the injured list, position-player fatigue and
// rest, roster upkeep (26 active, call-ups, send-downs, mid-season free
// agents), the All-Star Game, a WAR-like value metric and the season awards.
// Plugs into the core through BB.season.hooks and BB.season.customGames.
// No DOM access (Node-testable). Owned by the depth agent.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;
  const LG = () => BB.league;
  const S = () => BB.season;
  const EN = () => BB.engine;
  const D = (BB.depth = BB.depth || {});

  // Random source for depth decisions (tests may replace it with U.seeded(n)).
  D.rng = D.rng || Math.random;
  const rng = () => D.rng();
  const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));

  const ROSTER_MAX = 26;
  const RESERVE_MAX = 14;
  const ORG_MAX = ROSTER_MAX + RESERVE_MAX;
  const PITCHERS = 13; // active pitchers we aim for (13 hitters + 13 pitchers)

  const P = (L, id) => L.players[id] || null;
  const isP = (p) => p.pos === 'SP' || p.pos === 'RP';
  const teamById = (L, id) => L.teams.find((t) => t.id === id) || null;
  const fullName = (t) => t.city + ' ' + t.name;
  const r1 = (x) => Math.round(x * 10) / 10;
  const inSeason = (L) => L.phase === 'regular' || L.phase === 'postseason';
  // News with a sensible date: during the offseason there's no calendar, so
  // offseason.js keeps the current step's date in L.off.date.
  function news(L, text, kind, teamId) {
    if (L.phase === 'offseason' && L.off && L.off.date) {
      L.news.unshift({ date: L.off.date, text, kind: kind || 'info', teamId: teamId || null });
      if (L.news.length > 300) L.news.length = 300;
    } else S().addNews(L, text, kind, teamId);
  }
  D.news = news;

  // Running totals since the page (or test) loaded; not saved.
  D.tally = { injuries: 0, il: 0, byType: {} };

  // Bumped after every recorded game so cached league context stays fresh.
  let statVersion = 0;
  D.touch = () => statVersion++;

  // ---------------------------------------------------------------------------
  // Fatigue (position players). The engine sits a regular above 0.85.
  // An everyday player nets about +0.05 a game (a little noise keeps
  // teammates out of step); a day off (bench day or team off day) takes off
  // 0.34. With off days every ~19 days that's a rest about every 12 games
  // for regulars and every 5 or 6 for catchers. Older players tire faster.
  // ---------------------------------------------------------------------------
  const FAT = { gain: 0.09, catcher: 0.135, dh: 0.05, passive: 0.04, rest: 0.3, ageStep: 0.03, limit: 0.85 };

  function fatigueGain(p, pos, type) {
    let g = pos === 'C' ? FAT.catcher : pos === 'DH' ? FAT.dh : FAT.gain;
    g *= (1 + Math.max(0, p.age - 30) * FAT.ageStep) * (0.75 + 0.5 * rng());
    if (type === 'spring' || type === 'post') g *= 0.5; // short spring games; nobody rests in October
    return g;
  }

  // Before each game day: if more regulars are tired than the bench can
  // cover, the least tired play through it (otherwise the engine would give
  // up on resting anyone), and one catcher always stays available.
  function staggerRest(L, t) {
    const hitters = t.roster.map((id) => P(L, id)).filter((p) => p && !isP(p) && !p.injury);
    const tired = hitters.filter((p) => p.fatigue > FAT.limit).sort((a, b) => b.fatigue - a.fatigue);
    if (!tired.length) return;
    const catchers = hitters.filter((p) => p.pos === 'C');
    if (catchers.length && catchers.every((p) => p.fatigue > FAT.limit)) {
      catchers.sort((a, b) => a.fatigue - b.fatigue)[0].fatigue = FAT.limit;
    }
    const still = tired.filter((p) => p.fatigue > FAT.limit);
    const spare = Math.max(0, Math.min(2, hitters.length - 10));
    for (const p of still.slice(spare)) p.fatigue = FAT.limit;
  }

  // ---------------------------------------------------------------------------
  // Injuries
  // ---------------------------------------------------------------------------
  const INJURY = {
    dtd: { label: 'Day-to-day', il: false, days: [1, 3] },
    il10: { label: '10-day IL', il: true, days: [10, 20] },
    il15: { label: '15-day IL', il: true, days: [15, 35] },
    il60: { label: '60-day IL', il: true, days: [60, 110] },
    season: { label: 'Out for the season', il: true, days: null },
  };
  const SEVERITY = {
    hit: { dtd: 0.42, il10: 0.3, il15: 0.13, il60: 0.11, season: 0.04 },
    pit: { dtd: 0.3, il10: 0.25, il15: 0.24, il60: 0.15, season: 0.06 },
  };
  const DESC = {
    hit: {
      dtd: ['sore hamstring', 'bruised hand', 'tight back', 'sore wrist', 'jammed finger', 'stiff neck', 'bruised knee', 'illness'],
      il10: ['hamstring strain', 'sprained ankle', 'wrist inflammation', 'calf strain', 'bruised ribs', 'back strain', 'hip flexor strain'],
      il15: ['oblique strain', 'groin strain', 'broken finger', 'shoulder strain', 'knee sprain', 'quad strain'],
      il60: ['torn hamstring', 'fractured wrist', 'broken hand', 'high ankle sprain', 'torn meniscus', 'broken foot'],
      season: ['torn ACL', 'torn Achilles tendon', 'torn labrum', 'broken leg'],
    },
    pit: {
      dtd: ['blister', 'sore shoulder', 'back tightness', 'cramping', 'illness', 'sore elbow'],
      il10: ['blister', 'shoulder fatigue', 'forearm tightness', 'back strain', 'ankle sprain'],
      il15: ['elbow inflammation', 'shoulder inflammation', 'forearm strain', 'oblique strain', 'lat strain'],
      il60: ['shoulder strain', 'elbow sprain', 'torn lat muscle', 'rotator cuff strain'],
      season: ['elbow ligament surgery', 'torn labrum', 'shoulder surgery'],
    },
  };
  const MAJOR = new Set(['elbow ligament surgery', 'torn ACL', 'torn Achilles tendon', 'shoulder surgery']);
  // Per-game chance for a position player who appears (fatigue and age raise it),
  // and per pitch for pitchers (more when they go past their stamina).
  const RATE = { hitter: 0.0025, perPitch: 0.0001, spring: 0.6, post: 0.8 };

  function seasonEndDays(L) {
    const left = Math.max(0, L.days.length - L.day);
    if (L.phase === 'spring') return left + 190 + rint(0, 40);
    if (L.phase === 'regular') return left + 30 + rint(0, 90);
    return 30 + rint(0, 120);
  }

  // Give a player an injury. sev: 'dtd'|'il10'|'il15'|'il60'|'season' (random if omitted).
  function injure(L, p, sev, opts) {
    const o = opts || {};
    const kind = isP(p) ? 'pit' : 'hit';
    const type = sev || U.weighted(rng, SEVERITY[kind]);
    const def = INJURY[type];
    const desc = o.desc || U.pick(rng, DESC[kind][type]);
    let days = def.days ? rint(def.days[0], def.days[1]) : seasonEndDays(L);
    if (type === 'season' && MAJOR.has(desc)) days += 120;
    const d = L.days[L.day];
    p.injury = { days, total: days, desc, type, label: def.label, il: def.il, date: d ? d.date : null };
    p.fatigue = 0;
    D.tally.injuries++;
    D.tally.byType[type] = (D.tally.byType[type] || 0) + 1;
    if (def.il) D.tally.il++;
    const t = p.teamId ? teamById(L, p.teamId) : null;
    if (t && def.il) placeOnIL(L, t, p, { quiet: true });
    else if (t) manage(L, t); // day-to-day: out of today's plans
    if (t && !o.quiet) injuryNews(L, t, p);
    return p.injury;
  }

  function injuryNews(L, t, p) {
    const inj = p.injury;
    const user = t.id === L.userTeamId;
    const notable = p.ovr >= 68 || (inj.type === 'season' && p.ovr >= 60);
    if (!user && !notable) return;
    if (!user && inj.type === 'dtd') return;
    const what = inj.type === 'dtd' ? `is day-to-day with a ${inj.desc}` : inj.type === 'season' ? `is out for the season with a ${inj.desc}` : `goes on the ${inj.label} with a ${inj.desc}`;
    let text = `${t.abbr} ${posName(p)} ${p.name} ${what}.`;
    if (user && inj.il && inj.callUp) text += ` ${inj.callUp} is called up.`;
    news(L, text, 'injury', t.id);
  }

  function posName(p) {
    return p.pos === 'SP' ? 'starter' : p.pos === 'RP' ? 'reliever' : p.pos;
  }

  // Injury rolls and fatigue after each game (hooks.afterGame).
  function afterGame(L, gm, box, g) {
    statVersion++;
    if (!box || gm.type === 'allstar') return;
    const typeMul = gm.type === 'spring' ? RATE.spring : gm.type === 'post' ? RATE.post : 1;
    const sides = [gm.away, gm.home];
    for (let i = 0; i < 2; i++) {
      const t = teamById(L, sides[i]);
      if (!t) continue;
      for (const line of box.bat[i] || []) {
        const p = line.pid && P(L, line.pid);
        if (!p || isP(p)) continue;
        p.fatigue = U.clamp((p.fatigue || 0) + fatigueGain(p, line.pos, gm.type), 0, 1);
        if (p.injury) continue;
        let chance = RATE.hitter * typeMul * (0.75 + 0.5 * p.fatigue) * (1 + Math.max(0, p.age - 30) * 0.04);
        if (line.pos === 'C') chance *= 1.15;
        if (rng() < chance) injure(L, p);
      }
      const appear = g && g.teams && g.teams[i] ? g.teams[i].appear : null;
      (box.pit[i] || []).forEach((line, k) => {
        const p = line.pid && P(L, line.pid);
        if (!p || p.injury || !line.pitches) return;
        const stam = appear && appear[k] && appear[k].pid === p.id ? appear[k].stamina : line.pitches;
        const over = Math.max(0, line.pitches - stam) / 20;
        const chance = RATE.perPitch * line.pitches * typeMul * (1 + over * 0.8) * (1 + Math.max(0, p.age - 31) * 0.04);
        if (rng() < chance) injure(L, p);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Roster moves
  // ---------------------------------------------------------------------------
  // Depth chart upkeep: the core's autoManage, plus a five-man rotation for
  // hand-edited (manual) teams, which the core only refills from starters.
  function manage(L, t, force) {
    LG().autoManage(L, t, force);
    if (t.rotation.length >= 5) return;
    const pen = t.bullpen.map((id) => P(L, id)).filter((p) => p && !p.injury && p.id !== t.closer).sort((a, b) => b.r.sta - a.r.sta);
    while (t.rotation.length < 5 && pen.length) {
      const p = pen.shift();
      t.rotation.push(p.id);
      t.bullpen = t.bullpen.filter((id) => id !== p.id);
    }
  }

  function counts(L, t) {
    const c = { H: 0, P: 0, C: 0, SP: 0, hH: 0, hP: 0 };
    for (const id of t.roster) {
      const p = P(L, id);
      if (!p) continue;
      const ok = !p.injury;
      if (isP(p)) {
        c.P++;
        if (ok) c.hP++;
        if (ok && p.pos === 'SP') c.SP++;
      } else {
        c.H++;
        if (ok) c.hH++;
        if (ok && p.pos === 'C') c.C++;
      }
    }
    return c;
  }

  // How much a team wants to keep a player (young players with upside count more).
  function keepScore(p) {
    const room = Math.max(0, p.pot - p.ovr);
    return p.ovr + room * (p.age <= 23 ? 0.6 : p.age <= 26 ? 0.35 : 0) - (p.age >= 33 ? 3 : 0);
  }

  // Best healthy candidate to fill a spot of the given kind ('P' or 'H').
  function fitScore(L, t, p, kind, hint) {
    const c = counts(L, t);
    if (kind === 'P') {
      if (!isP(p)) return -1e9;
      let s = p.ovr;
      if (c.SP < 5 && p.pos === 'SP') s += 10;
      if (c.SP >= 5 && p.pos === 'RP') s += 2;
      return s;
    }
    if (isP(p)) return -1e9;
    let s = p.ovr;
    if (hint && hint !== 'DH') s = Math.max(LG().ovrAt(p, hint), p.ovr - 4);
    if (c.C < 2 && p.pos === 'C') s += 25;
    return s;
  }

  function bestOf(list, score) {
    let best = null;
    let bs = -1e9;
    for (const p of list) {
      const s = score(p);
      if (s > bs) {
        bs = s;
        best = p;
      }
    }
    return bs > -1e8 ? best : null;
  }

  function assignNumber(L, t, p) {
    const used = new Set();
    for (const id of t.roster.concat(t.reserves, t.il)) {
      const q = P(L, id);
      if (q && q.id !== p.id) used.add(q.num);
    }
    if (!p.num || used.has(p.num)) p.num = LG().pickNumber(rng, used);
  }

  function removeFromTeam(t, pid) {
    t.roster = t.roster.filter((id) => id !== pid);
    t.reserves = t.reserves.filter((id) => id !== pid);
    t.il = t.il.filter((id) => id !== pid);
    t.lineup = t.lineup.filter((e) => e.pid !== pid);
    t.rotation = t.rotation.filter((id) => id !== pid);
    t.bullpen = t.bullpen.filter((id) => id !== pid);
    if (t.closer === pid) t.closer = null;
  }

  function promote(L, t, p) {
    t.reserves = t.reserves.filter((id) => id !== p.id);
    if (!t.roster.includes(p.id)) t.roster.push(p.id);
    p.status = 'active';
    // First taste of the big leagues: still a rookie until he passes the limits.
    if (!p.rookie && !exceededRookie(p) && L.history.length > 0 && p.age <= ROOKIE_AGE) p.rookie = true;
  }

  function demote(L, t, p) {
    t.roster = t.roster.filter((id) => id !== p.id);
    if (!t.reserves.includes(p.id)) t.reserves.push(p.id);
    p.status = 'reserve';
    trimReserves(L, t);
  }

  // Release a player into free agency.
  function release(L, t, p) {
    // The team keeps paying what's left of his contract (see BB.league.deadMoney).
    if (p.contract && p.contract.years > 0 && p.contract.salary > 0) {
      t.deadMoney = t.deadMoney || [];
      t.deadMoney.push({ pid: p.id, name: p.name, salary: p.contract.salary, years: p.contract.years });
    }
    removeFromTeam(t, p.id);
    p.teamId = null;
    p.status = 'fa';
    p.contract = { years: 0, salary: LG().salaryFor(p) };
    if (!L.freeAgents.includes(p.id)) L.freeAgents.push(p.id);
  }

  function trimReserves(L, t) {
    while (t.reserves.length > RESERVE_MAX) {
      const worst = t.reserves.map((id) => P(L, id)).filter(Boolean).sort((a, b) => keepScore(a) - keepScore(b))[0];
      if (!worst) break;
      release(L, t, worst);
      if (t.id === L.userTeamId) news(L, `${t.abbr} release ${worst.name} (${worst.pos}) to make room in the reserves.`, 'roster', t.id);
    }
  }

  // Sign a free agent. where: 'active' | 'reserve' (default: active when there's room).
  function signFreeAgent(L, t, p, contract, where) {
    L.freeAgents = L.freeAgents.filter((id) => id !== p.id);
    if (p.teamId && p.teamId !== t.id) {
      const old = teamById(L, p.teamId);
      if (old) removeFromTeam(old, p.id);
    }
    p.teamId = t.id;
    p.contract = { years: Math.max(1, contract.years | 0), salary: r1(Math.max(0.75, contract.salary)) };
    const active = where ? where === 'active' : t.roster.length < ROSTER_MAX || t.reserves.length >= RESERVE_MAX;
    if (p.injury && p.injury.il) {
      t.il.push(p.id);
      p.status = 'il';
    } else if (active) {
      t.roster.push(p.id);
      p.status = 'active';
    } else {
      t.reserves.push(p.id);
      p.status = 'reserve';
    }
    assignNumber(L, t, p);
    return p;
  }

  function asking(L, p) {
    if (BB.offseason && BB.offseason.asking) return BB.offseason.asking(L, p);
    return { salary: LG().salaryFor(p), years: 1 };
  }

  // Best healthy free agent of a kind that fits the budget (cheap fallbacks allowed).
  function bestFreeAgent(L, t, kind, hint) {
    const room = t.budget - LG().payroll(L, t);
    const list = L.freeAgents.map((id) => P(L, id)).filter((p) => p && !p.injury && (kind === 'P' ? isP(p) : !isP(p)));
    const fits = list.filter((p) => asking(L, p).salary <= Math.max(1, room));
    return bestOf(fits.length ? fits : list.filter((p) => p.ovr < 55), (p) => fitScore(L, t, p, kind, hint));
  }

  // Replacement-level player when the free-agent pool has nobody (keeps rosters legal).
  function makeFiller(L, t, kind, hint) {
    const pos = kind === 'P' ? (counts(L, t).SP < 5 ? 'SP' : 'RP') : hint && hint !== 'DH' ? hint : U.pick(rng, ['C', '2B', 'SS', 'CF', '3B']);
    const p = LG().makePlayer(L, rng, { pos, mean: 46, age: 26 + rint(0, 7) });
    p.status = 'fa';
    L.freeAgents.push(p.id);
    return p;
  }

  // Add one player to the active roster: best reserve, else a free agent, else a filler.
  function callUpOne(L, t, kind, hint, why) {
    const cands = t.reserves.map((id) => P(L, id)).filter((p) => p && !p.injury);
    let p = bestOf(cands, (q) => fitScore(L, t, q, kind, hint));
    if (p) {
      promote(L, t, p);
      return { p, how: 'reserve' };
    }
    p = bestFreeAgent(L, t, kind, hint) || makeFiller(L, t, kind, hint);
    const ask = asking(L, p);
    signFreeAgent(L, t, p, { salary: Math.min(ask.salary, Math.max(0.75, LG().salaryFor(p))), years: 1 }, 'active');
    news(L, `${t.abbr} sign free agent ${p.name} (${p.pos}) to fill a hole${why ? ' ' + why : ''}.`, 'roster', t.id);
    return { p, how: 'fa' };
  }

  // Weakest healthy extra to send down, keeping 2 catchers and 5 starters when possible.
  function pickSendDown(L, t) {
    const c = counts(L, t);
    const wantP = c.P > PITCHERS ? true : c.H > ROSTER_MAX - PITCHERS ? false : c.P >= c.H;
    const ok = (p) => p && !p.injury && !(p.pos === 'C' && c.C <= 2) && !(p.pos === 'SP' && c.SP <= 5);
    const all = t.roster.map((id) => P(L, id)).filter(ok);
    let cands = all.filter((p) => isP(p) === wantP);
    if (!cands.length) cands = all;
    if (!cands.length) return null;
    const role = (p) => (t.closer === p.id ? 6 : t.rotation.includes(p.id) ? 4 : t.lineup.some((e) => e.pid === p.id) ? 3 : 0);
    cands.sort((a, b) => keepScore(a) + role(a) - (keepScore(b) + role(b)));
    return cands[0];
  }

  // Keep the active roster at 26 (regular season and postseason) or at least 26
  // (spring). Returns true when something changed.
  function normalizeRoster(L, t, opts) {
    const o = opts || {};
    if (L.phase === 'offseason' && !o.force) return false;
    const strict = o.strict != null ? o.strict : inSeason(L);
    let changed = false;
    // Repairs: IL players with no injury come back; IL-level injuries leave the roster.
    for (const id of t.il.slice()) {
      const p = P(L, id);
      if (!p || !p.injury) {
        t.il = t.il.filter((x) => x !== id);
        if (p) {
          t.roster.push(id);
          p.status = 'active';
        }
        changed = true;
      }
    }
    for (const id of t.roster.slice()) {
      const p = P(L, id);
      if (p && p.injury && p.injury.il) {
        t.roster = t.roster.filter((x) => x !== id);
        t.il.push(id);
        p.status = 'il';
        changed = true;
      }
    }
    let guard = 0;
    while (t.roster.length < ROSTER_MAX && guard++ < 30) {
      const c = counts(L, t);
      const kind = c.P < PITCHERS ? 'P' : 'H';
      callUpOne(L, t, kind, null);
      changed = true;
    }
    guard = 0;
    while (strict && t.roster.length > ROSTER_MAX && guard++ < 30) {
      const p = pickSendDown(L, t);
      if (p) demote(L, t, p);
      else {
        // Only injured or protected players left: the longest day-to-day case goes on the IL.
        const dtd = t.roster.map((id) => P(L, id)).filter((q) => q && q.injury).sort((a, b) => b.injury.days - a.injury.days)[0];
        if (!dtd) break;
        Object.assign(dtd.injury, { type: 'il10', label: INJURY.il10.label, il: true, days: Math.max(dtd.injury.days, 10) });
        t.roster = t.roster.filter((x) => x !== dtd.id);
        t.il.push(dtd.id);
        dtd.status = 'il';
      }
      changed = true;
    }
    if (changed) manage(L, t);
    return changed;
  }

  // Injured list: off the active roster, and a call-up takes the spot.
  function placeOnIL(L, t, p, opts) {
    const wasActive = t.roster.includes(p.id);
    t.roster = t.roster.filter((id) => id !== p.id);
    t.reserves = t.reserves.filter((id) => id !== p.id);
    if (!t.il.includes(p.id)) t.il.push(p.id);
    p.status = 'il';
    if (wasActive && L.phase !== 'offseason' && t.roster.length < ROSTER_MAX) {
      const r = callUpOne(L, t, isP(p) ? 'P' : 'H', isP(p) ? null : p.pos, `after the injury to ${p.name}`);
      if (p.injury && r && r.p) p.injury.callUp = r.p.name;
    }
    manage(L, t);
  }

  // Healed: back to the active roster; the weakest extra goes down.
  function activate(L, t, p) {
    t.il = t.il.filter((id) => id !== p.id);
    if (!t.roster.includes(p.id)) t.roster.push(p.id);
    p.status = 'active';
    let sent = null;
    if (inSeason(L)) {
      while (t.roster.length > ROSTER_MAX) {
        const d = pickSendDown(L, t);
        if (!d) break;
        demote(L, t, d);
        sent = sent || d;
      }
    }
    manage(L, t);
    return sent;
  }

  function heal(L, p) {
    const inj = p.injury;
    p.injury = null;
    const t = p.teamId ? teamById(L, p.teamId) : null;
    if (!t) return;
    let sent = null;
    if (t.il.includes(p.id)) sent = activate(L, t, p);
    const user = t.id === L.userTeamId;
    if (inj && inj.il && (user || p.ovr >= 68)) {
      news(L, `${t.abbr} ${posName(p)} ${p.name} returns from the ${inj.label}${user && sent && sent.id !== p.id ? `; ${sent.name} is sent down` : ''}.`, 'injury', t.id);
    }
  }

  // Manual moves for the UI (the user's team). Return { ok, reason }.
  function callUp(L, teamId, pid, sendDownPid) {
    const t = teamById(L, teamId);
    const p = P(L, pid);
    if (!t || !p || !t.reserves.includes(pid)) return { ok: false, reason: 'That player is not in your reserves.' };
    if (p.injury) return { ok: false, reason: `${p.name} is injured.` };
    if (L.phase !== 'offseason' && L.phase !== 'spring' && t.roster.length >= ROSTER_MAX) {
      const d = sendDownPid && P(L, sendDownPid);
      if (!d || !t.roster.includes(sendDownPid)) return { ok: false, reason: 'The active roster is full (26). Choose someone to send down.' };
      demote(L, t, d);
    }
    promote(L, t, p);
    manage(L, t);
    return { ok: true };
  }

  function sendDown(L, teamId, pid) {
    const t = teamById(L, teamId);
    const p = P(L, pid);
    if (!t || !p || !t.roster.includes(pid)) return { ok: false, reason: 'That player is not on the active roster.' };
    demote(L, t, p);
    if (inSeason(L)) normalizeRoster(L, t);
    manage(L, t);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // CPU roster management: weekly swaps and free agents for holes.
  // ---------------------------------------------------------------------------
  function orgCounts(L, t) {
    const c = { H: 0, P: 0, C: 0, SP: 0, size: t.roster.length + t.reserves.length };
    for (const id of t.roster.concat(t.reserves)) {
      const p = P(L, id);
      if (!p || p.injury) continue;
      if (isP(p)) {
        c.P++;
        if (p.pos === 'SP') c.SP++;
      } else {
        c.H++;
        if (p.pos === 'C') c.C++;
      }
    }
    return c;
  }

  function fillOrgHoles(L, t) {
    let guard = 0;
    while (guard++ < 4) {
      const c = orgCounts(L, t);
      if (c.size >= ORG_MAX) return;
      let kind = null;
      let hint = null;
      if (c.C < 2) {
        kind = 'H';
        hint = 'C';
      } else if (c.SP < 6) kind = 'P';
      else if (c.P < 15) kind = 'P';
      else if (c.H < 15) kind = 'H';
      if (!kind) return;
      const list = L.freeAgents.map((id) => P(L, id)).filter((p) => p && !p.injury && (kind === 'P' ? isP(p) : !isP(p)) && (!hint || p.pos === hint));
      const room = t.budget - LG().payroll(L, t);
      const fits = list.filter((p) => asking(L, p).salary <= Math.max(1, room));
      const p = bestOf(fits, (q) => (hint ? q.ovr : fitScore(L, t, q, kind)));
      if (!p) return;
      const ask = asking(L, p);
      signFreeAgent(L, t, p, { salary: ask.salary, years: 1 }, 'reserve');
      if (p.ovr >= 58 || t.id === L.userTeamId) news(L, `${t.abbr} sign free agent ${p.name} (${p.pos}).`, 'transaction', t.id);
    }
  }

  function cpuRosterMoves(L, t) {
    if (t.id === L.userTeamId) return;
    for (const kind of ['P', 'H']) {
      const res = t.reserves.map((id) => P(L, id)).filter((p) => p && !p.injury && (kind === 'P' ? isP(p) : !isP(p)));
      if (!res.length) continue;
      const best = res.sort((a, b) => b.ovr - a.ovr)[0];
      const c = counts(L, t);
      const act = t.roster
        .map((id) => P(L, id))
        .filter((p) => p && !p.injury && (kind === 'P' ? isP(p) : !isP(p)))
        .filter((p) => !(p.pos === 'C' && c.C <= 2 && best.pos !== 'C') && !(p.pos === 'SP' && c.SP <= 5 && best.pos !== 'SP'));
      if (!act.length) continue;
      const worst = act.sort((a, b) => a.ovr - b.ovr)[0];
      if (best.ovr >= worst.ovr + 4) {
        demote(L, t, worst);
        promote(L, t, best);
        manage(L, t);
      }
    }
    fillOrgHoles(L, t);
  }

  // ---------------------------------------------------------------------------
  // Value metric: a WAR-like number from this season's stats.
  // Hitters: batting runs (linear weights) + baserunning + fielding (rating,
  // scaled by games) + position adjustment + replacement level, / 10.
  // Pitchers: runs saved vs. replacement from a 50/50 RA9 and FIP blend,
  // relievers weighted by leverage (saves).
  // ---------------------------------------------------------------------------
  const POS_ADJ = { C: 10, SS: 7, CF: 2.5, '2B': 3, '3B': 2, LF: -7, RF: -7, '1B': -10, DH: -15 };
  const FLD_K = { C: 0.3, SS: 0.45, CF: 0.4, '2B': 0.35, '3B': 0.3, LF: 0.2, RF: 0.22, '1B': 0.12, DH: 0 };
  const ARM_K = { C: 0.2, SS: 0.15, CF: 0.1, '2B': 0.08, '3B': 0.15, LF: 0.06, RF: 0.15, '1B': 0.02, DH: 0 };
  const LW = { bb: 0.69, s: 0.88, d: 1.25, t: 1.58, hr: 2.0 };
  // Calibration (Milestone 1; targets in DESIGN.md "WAR"): about 1,000 WAR a
  // season, 57% to hitters, MVPs at about 8-10.
  //   spread: stretches a hitter's runs above or below average, so MVPs
  //     land at about 8-10. It was 1.45 before Milestone 1b gave the league
  //     real standout hitters; the best season is now about 8 to 11.5.
  //   replHit: replacement level for hitters, runs per 600 PA.
  //   replSP / replRP: replacement level for pitchers, as a multiple of the
  //     league ERA.
  const WAR = { spread: 1.25, replHit: 19.8, replSP: 1.22, replRP: 1.16 };
  const ctxCache = { L: null, key: '', ctx: null };

  function context(L, bucket) {
    const key = bucket + '|' + statVersion + '|' + L.year + '|' + L.phase + '|' + L.day;
    if (ctxCache.L === L && ctxCache.key === key) return ctxCache.ctx;
    let pa = 0, bb = 0, h = 0, d = 0, t = 0, hr = 0;
    let outs = 0, er = 0, pbb = 0, pk = 0, phr = 0;
    for (const id in L.players) {
      const s = L.players[id].stats[bucket];
      if (!s) continue;
      const b = s.bat;
      pa += b.pa; bb += b.bb; h += b.h; d += b.d; t += b.t; hr += b.hr;
      const q = s.pit;
      outs += q.outs; er += q.er; pbb += q.bb; pk += q.k; phr += q.hr;
    }
    const ip = outs / 3;
    const woba = pa > 300 ? (LW.bb * bb + LW.s * (h - d - t - hr) + LW.d * d + LW.t * t + LW.hr * hr) / pa : 0.32;
    const era = ip > 60 ? (er * 9) / ip : 4.4;
    const fipC = ip > 60 ? era - (13 * phr + 3 * pbb - 2 * pk) / ip : 3.1;
    const ctx = { woba, era, fipC };
    ctxCache.L = L;
    ctxCache.key = key;
    ctxCache.ctx = ctx;
    return ctx;
  }

  function wobaOf(b) {
    if (!b.pa) return 0;
    return (LW.bb * b.bb + LW.s * (b.h - b.d - b.t - b.hr) + LW.d * b.d + LW.t * b.t + LW.hr * b.hr) / b.pa;
  }
  function fipOf(q, ctx) {
    const ip = q.outs / 3;
    return ip ? (13 * q.hr + 3 * q.bb - 2 * q.k) / ip + ctx.fipC : 0;
  }

  function hitterWar(p, s, ctx) {
    const b = s.bat;
    if (!b.pa) return 0;
    const pos = POS_ADJ[p.pos] != null ? p.pos : 'DH';
    const bat = ((wobaOf(b) - ctx.woba) / 1.2) * b.pa;
    const run = 0.2 * b.sb - 0.4 * b.cs;
    const share = b.g / 162;
    const fld = ((p.r.fld - 60) * FLD_K[pos] + (p.r.arm - 60) * ARM_K[pos]) * share;
    const adj = POS_ADJ[pos] * share;
    const repl = (WAR.replHit * b.pa) / 600;
    return (WAR.spread * (bat + run + fld + adj) + repl) / 10;
  }

  function pitcherWar(p, s, ctx) {
    const q = s.pit;
    if (!q.outs) return 0;
    const ip = q.outs / 3;
    const blend = 0.5 * ((q.er * 9) / ip) + 0.5 * fipOf(q, ctx);
    const starter = q.gs >= Math.max(1, q.g * 0.5);
    let runs = (ctx.era * (starter ? WAR.replSP : WAR.replRP) - blend) * (ip / 9);
    if (!starter) runs *= 1 + Math.min(0.5, (q.sv / Math.max(1, q.g)) * 0.7);
    return runs / 10;
  }

  // BB.depth.value(L, p, { bucket: 'reg'|'post'|'spring' }) → WAR-like number.
  function value(L, p, opts) {
    const bucket = (opts && opts.bucket) || 'reg';
    const s = p && p.stats && p.stats[bucket];
    if (!s) return 0;
    const ctx = context(L, bucket);
    return isP(p) ? pitcherWar(p, s, ctx) : hitterWar(p, s, ctx);
  }

  const fmt3 = (x) => (x >= 1 ? x.toFixed(3) : x.toFixed(3).replace(/^0/, ''));
  // Short stat line: '.312, 34 HR, 101 RBI' or '15-6, 2.85 ERA, 201 K' or '38 SV, 1.95 ERA'.
  function statLine(p, bucket) {
    const s = p.stats[bucket || 'reg'];
    const c = S().calc(s);
    if (isP(p)) {
      const q = s.pit;
      if (q.gs >= Math.max(1, q.g * 0.5)) return `${q.w}-${q.l}, ${c.era.toFixed(2)} ERA, ${q.k} K`;
      return `${q.sv ? q.sv + ' SV, ' : ''}${c.era.toFixed(2)} ERA, ${c.ipText} IP, ${q.k} K`;
    }
    const b = s.bat;
    return `${fmt3(c.avg)}, ${b.hr} HR, ${b.rbi} RBI${b.sb >= 20 ? ', ' + b.sb + ' SB' : ''}`;
  }

  // ---------------------------------------------------------------------------
  // Rookies: first big-league season (MLB limits: 130 AB-ish / 50 IP).
  // ---------------------------------------------------------------------------
  function careerTotals(p) {
    let pa = 0;
    let outs = 0;
    for (const c of p.career || []) {
      pa += c.reg ? c.reg.bat.pa : 0;
      outs += c.reg ? c.reg.pit.outs : 0;
    }
    return { pa, outs };
  }
  function exceededRookie(p) {
    const c = careerTotals(p);
    return c.pa >= 130 || c.outs >= 150;
  }
  // Called at the start of spring. In the first franchise year nobody has a
  // career yet, so rookies are the youngest big-leaguers (22 and under) and
  // anyone starting the year in the minors (27 and under). Later, a player
  // with no big-league time is a rookie only up to 27: the league starts
  // without a past, so an older player with an empty career is a veteran
  // the game generated, not a newcomer.
  const ROOKIE_AGE = 27;
  function refreshRookies(L) {
    const first = L.history.length === 0;
    for (const id in L.players) {
      const p = L.players[id];
      const minors = p.status === 'reserve' || p.status === 'prospect';
      p.rookie = !exceededRookie(p) && p.age <= ROOKIE_AGE && (!first || p.age <= 22 || minors);
    }
  }

  // ---------------------------------------------------------------------------
  // Awards (end of the regular season)
  // ---------------------------------------------------------------------------
  function awardRow(L, p, t, score) {
    return { pid: p.id, name: p.name, first: p.first, last: p.last, teamId: t.id, pos: p.pos, age: p.age, war: r1(value(L, p)), score: r1(score), line: statLine(p) };
  }

  function pickAward(L, rows, eligible, score, fallback) {
    let list = rows.filter(eligible);
    if (!list.length && fallback) list = rows.filter(fallback);
    if (!list.length) return null;
    list.sort((a, b) => score(b) - score(a));
    const top = list.slice(0, 3).map((x) => awardRow(L, x.p, x.t, score(x)));
    return Object.assign({}, top[0], { top });
  }

  // Season awards (or, with { dry: true }, the current races without saving
  // anything or adding news).
  function computeAwards(L, opts) {
    const dry = !!(opts && opts.dry);
    const rows = [[], []];
    for (const id in L.players) {
      const p = L.players[id];
      if (!p.teamId) continue;
      const t = teamById(L, p.teamId);
      const s = p.stats.reg;
      if (!t || (!s.bat.pa && !s.pit.outs)) continue;
      const g = t.rec.w + t.rec.l;
      rows[t.league].push({ p, t, war: value(L, p), s, pct: g ? t.rec.w / g : 0.5, games: g });
    }
    const out = { year: L.year, leagues: [], allStarMvp: L.allStar && L.allStar.result ? L.allStar.result.mvp : null, seriesMvp: null };
    rows.forEach((list, lg) => {
      const gp = Math.max(1, ...list.map((x) => x.games));
      const pit = (x) => isP(x.p);
      const ipOf = (x) => x.s.pit.outs / 3;
      const mvp = pickAward(
        L, list,
        (x) => (pit(x) ? ipOf(x) >= gp * 0.75 : x.s.bat.pa >= gp * 3.1),
        (x) => x.war * (pit(x) ? 0.6 : 1) + (x.pct - 0.5) * 2,
        (x) => x.s.bat.pa > 0 || x.s.pit.outs > 0,
      );
      const cy = pickAward(L, list, (x) => pit(x) && ipOf(x) >= gp * 0.62, (x) => x.war + x.s.pit.w * 0.02, (x) => pit(x) && x.s.pit.outs > 0);
      const roy = pickAward(
        L, list,
        (x) => x.p.rookie && (pit(x) ? ipOf(x) >= 40 : x.s.bat.pa >= 150),
        (x) => x.war,
        (x) => x.p.rookie,
      );
      const rel = pickAward(
        L, list,
        // A relief pitcher: at least 80% of his games out of the bullpen.
        (x) => pit(x) && x.s.pit.gs <= x.s.pit.g * 0.2 && x.s.pit.g >= gp * 0.2,
        (x) => x.war + x.s.pit.sv * 0.025,
        (x) => pit(x) && x.s.pit.gs <= x.s.pit.g * 0.2 && x.s.pit.outs > 0,
      );
      out.leagues.push({ lg, name: LG().LEAGUES[lg], mvp, cy, roy, rel });
    });
    if (dry) return out;
    L.awards = out;
    for (const lgA of out.leagues) {
      const bits = [['MVP', lgA.mvp], ['Cy Young', lgA.cy], ['Rookie of the Year', lgA.roy], ['Reliever of the Year', lgA.rel]];
      for (const [label, a] of bits) {
        if (!a) continue;
        const t = teamById(L, a.teamId);
        news(L, `${lgA.name} ${label}: ${a.name} (${t ? t.abbr : ''}), ${a.line}.`, 'award', a.teamId);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // All-Star Game
  // ---------------------------------------------------------------------------
  const AS_SIDES = [
    { abbr: 'CST', name: 'Coast League All-Stars', short: 'Coast', color: '#1f5fa8', color2: '#f2c94c' },
    { abbr: 'HRT', name: 'Heartland League All-Stars', short: 'Heartland', color: '#b5213b', color2: '#f4f1de' },
  ];

  function selectAllStars(L, lg) {
    const pool = [];
    for (const t of L.teams) {
      if (t.league !== lg) continue;
      const gp = Math.max(1, t.rec.w + t.rec.l);
      for (const id of t.roster) {
        const p = P(L, id);
        if (!p || p.injury) continue;
        const s = p.stats.reg;
        const war = value(L, p);
        const base = war + (p.ovr - 60) * 0.03;
        let ok;
        if (isP(p)) ok = p.pos === 'SP' ? s.pit.gs >= Math.min(6, gp * 0.15) : s.pit.g >= Math.min(15, gp * 0.25);
        else ok = s.bat.pa >= gp * 1.5;
        pool.push({ p, t, score: ok ? base : base - 50 });
      }
    }
    const taken = new Set();
    const by = (pred) => pool.filter((x) => !taken.has(x.p.id) && pred(x.p)).sort((a, b) => b.score - a.score);
    const take = (x) => {
      taken.add(x.p.id);
      return x;
    };
    const starters = [];
    for (const pos of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']) {
      let x = by((p) => p.pos === pos)[0];
      if (!x && (pos === 'LF' || pos === 'CF' || pos === 'RF')) x = by((p) => p.pos === 'LF' || p.pos === 'CF' || p.pos === 'RF')[0];
      if (!x) x = by((p) => !isP(p))[0];
      if (x) starters.push({ x: take(x), pos });
    }
    // DH: the best remaining bat.
    const ctx = context(L, 'reg');
    const offScore = (x) => (x.score < -10 ? -50 : 0) + ((wobaOf(x.p.stats.reg.bat) - ctx.woba) / 1.2) * x.p.stats.reg.bat.pa / 10 + LG().offense(x.p) * 0.01;
    const dh = pool.filter((x) => !taken.has(x.p.id) && !isP(x.p)).sort((a, b) => offScore(b) - offScore(a))[0];
    if (dh) starters.push({ x: take(dh), pos: 'DH' });
    const bench = [];
    const backupC = by((p) => p.pos === 'C')[0];
    if (backupC) bench.push(take(backupC));
    while (bench.length < 5) {
      const x = by((p) => !isP(p))[0];
      if (!x) break;
      bench.push(take(x));
    }
    const sp = [];
    while (sp.length < 5) {
      const x = by((p) => p.pos === 'SP')[0];
      if (!x) break;
      sp.push(take(x));
    }
    const rp = [];
    while (rp.length < 7) {
      const x = by((p) => p.pos === 'RP')[0] || by(isP)[0];
      if (!x) break;
      rp.push(take(x));
    }
    // Every team gets at least one All-Star.
    const teamsIn = () => {
      const m = {};
      for (const x of starters.map((s) => s.x).concat(bench, sp, rp)) m[x.t.id] = (m[x.t.id] || 0) + 1;
      return m;
    };
    for (const t of L.teams.filter((tm) => tm.league === lg)) {
      const m = teamsIn();
      if (m[t.id]) continue;
      const best = pool.filter((x) => x.t.id === t.id && !taken.has(x.p.id)).sort((a, b) => b.score - a.score)[0];
      if (!best) continue;
      const list = isP(best.p) ? (best.p.pos === 'SP' ? sp : rp) : bench;
      const minIdx = list === bench && backupC ? 1 : list === sp ? 1 : 0;
      let swap = -1;
      for (let i = list.length - 1; i >= minIdx; i--) {
        if ((m[list[i].t.id] || 0) >= 2) {
          swap = i;
          break;
        }
      }
      if (swap < 0) continue;
      taken.delete(list[swap].p.id);
      list[swap] = take(best);
    }
    const lineup = LG().battingOrder(L, starters.map((s) => ({ pid: s.x.p.id, pos: s.pos })));
    rp.sort((a, b) => b.p.stats.reg.pit.sv - a.p.stats.reg.pit.sv || b.score - a.score);
    const side = AS_SIDES[lg];
    return {
      lg, name: side.name, abbr: side.abbr, color: side.color, short: side.short,
      starters: lineup,
      bench: bench.map((x) => x.p.id),
      sp: sp.map((x) => x.p.id),
      rp: rp.map((x) => x.p.id),
      closer: rp.length ? rp[0].p.id : null,
      teams: Object.keys(teamsIn()).length,
    };
  }

  function allStarDayIndex(L) {
    if (L.phase !== 'regular') return -1;
    return L.days.findIndex((d) => d.event === 'allstar');
  }

  // Create the All-Star Game on the 'allstar' day (once per season).
  function ensureAllStarGame(L) {
    const di = allStarDayIndex(L);
    if (di < 0) return null;
    if (L.allStar && L.allStar.year === L.year && L.allStar.gameId && L.games[L.allStar.gameId]) return L.games[L.allStar.gameId];
    const d = L.days[di];
    const rosters = [selectAllStars(L, 0), selectAllStars(L, 1)];
    const homeLg = L.year % 2 === 1 ? 1 : 0; // the host league alternates
    const awayLg = 1 - homeLg;
    const gm = LG().newGame(L, 'allstar', d.date, AS_SIDES[awayLg].abbr, AS_SIDES[homeLg].abbr, di);
    const userLg = S().userTeam(L).league;
    gm.meta = {
      label: 'All-Star Game', userPlays: true, userSide: userLg === homeLg ? 'home' : 'away',
      awayName: AS_SIDES[awayLg].name, homeName: AS_SIDES[homeLg].name,
      awayAbbr: AS_SIDES[awayLg].abbr, homeAbbr: AS_SIDES[homeLg].abbr,
      awayColor: AS_SIDES[awayLg].color, homeColor: AS_SIDES[homeLg].color,
      awayLg, homeLg,
    };
    d.games.push(gm.id);
    L.allStar = { year: L.year, gameId: gm.id, day: di, date: d.date, homeLg, awayLg, rosters, result: null };
    news(L, `All-Star rosters are set for the game on ${d.date}: ${AS_SIDES[awayLg].name} at ${AS_SIDES[homeLg].name}.`, 'allstar');
    const ut = S().userTeam(L);
    const mine = rosterPids(rosters[ut.league]).map((id) => P(L, id)).filter((p) => p && p.teamId === ut.id);
    if (mine.length) news(L, `${mine.length === 1 ? 'An All-Star' : mine.length + ' All-Stars'} for the ${ut.name}: ${mine.map((p) => p.name).join(', ')}.`, 'allstar', ut.id);
    return gm;
  }

  function rosterPids(r) {
    return r.starters.map((e) => e.pid).concat(r.bench, r.sp, r.rp);
  }

  // TeamDef for one All-Star side: short outings for everyone.
  function allStarDef(L, r) {
    const lineup = r.starters.map((e, i) => LG().toGameBatter(P(L, e.pid), e.pos, i));
    const staff = [];
    const sps = r.sp.map((id) => P(L, id)).filter(Boolean);
    const rps = r.rp.map((id) => P(L, id)).filter(Boolean);
    sps.forEach((p, i) => {
      const gp = LG().toGamePitcher(p, i === 0 ? 'SP' : 'RP');
      gp.stamina = i === 0 ? 28 : 22;
      staff.push(gp);
    });
    const closer = rps.find((p) => p.id === r.closer);
    for (const p of rps.filter((q) => q !== closer).reverse()) {
      const gp = LG().toGamePitcher(p, 'RP');
      gp.stamina = 20;
      staff.push(gp);
    }
    if (closer) {
      const gp = LG().toGamePitcher(closer, 'CL');
      gp.stamina = 25;
      staff.push(gp);
    }
    if (!staff.length) staff.push(LG().toGamePitcher(rps[0] || sps[0], 'SP'));
    const defense = { P: { q: 1, arm: 1 } };
    for (const e of r.starters) if (e.pos !== 'DH') defense[e.pos] = LG().fieldDef(P(L, e.pid));
    return { id: r.abbr, name: r.name, abbr: r.abbr, color: r.color, lineup, staff, defense };
  }

  function createAllStar(L, game, userSide) {
    const as = L.allStar;
    const g = BB.game.createGame({
      innings: 9,
      difficulty: userSide ? L.difficulty : 'medium',
      away: allStarDef(L, as.rosters[as.awayLg]),
      home: allStarDef(L, as.rosters[as.homeLg]),
      userSide: userSide || null,
      ghostRunner: false,
      meta: Object.assign({ type: 'allstar', gameId: game.id }, game.meta || {}),
    });
    return g;
  }

  function allStarMvp(L, g, winner) {
    const t = g.teams[winner];
    let best = null;
    let bs = -1e9;
    for (const b of t.lineup) {
      const s = b.stats;
      const sc = s.h + s.d + 2 * s.t + 3 * s.hr + s.rbi + s.r + 0.5 * s.bb + 0.5 * s.sb;
      if (sc > bs) {
        bs = sc;
        best = { pid: b.pid, line: batText(s) };
      }
    }
    for (const q of t.appear) {
      const s = q.stats;
      const sc = s.outs / 3 + s.k * 0.6 - s.r * 1.5 - s.h * 0.4 - 0.5;
      if (sc > bs) {
        bs = sc;
        best = { pid: q.pid, line: `${S().ipText(s.outs)} IP, ${s.k} K, ${s.r} R` };
      }
    }
    if (!best) return null;
    const p = P(L, best.pid);
    return p ? { pid: p.id, name: p.name, teamId: p.teamId, line: best.line } : null;
  }

  function batText(s) {
    const bits = [`${s.h}-for-${s.ab}`];
    if (s.hr) bits.push(s.hr === 1 ? 'a home run' : s.hr + ' home runs');
    else if (s.d + s.t) bits.push(s.d + s.t === 1 ? (s.t ? 'a triple' : 'a double') : s.d + s.t + ' extra-base hits');
    if (s.rbi) bits.push(s.rbi + ' RBI');
    return bits.join(', ');
  }

  S().customGames.allstar = {
    create: (L, game, o) => createAllStar(L, game, o && o.userSide),
    sim(L, game) {
      const g = createAllStar(L, game, null);
      EN().runHeadless(g);
      return { g, box: EN().box(g, false) };
    },
    // No league stats: just the result, the MVP and news.
    record(L, game, box, g) {
      delete box.splits;
      game.status = 'final';
      game.score = box.score.slice();
      game.innings = box.innings;
      game.wp = box.wp;
      game.lp = box.lp;
      game.sv = box.sv;
      game.box = box;
      const winner = box.score[0] === box.score[1] ? -1 : box.score[0] > box.score[1] ? 0 : 1;
      const as = L.allStar;
      const mvp = g && winner >= 0 ? allStarMvp(L, g, winner) : null;
      if (as) {
        as.result = { score: box.score.slice(), winnerLg: winner < 0 ? null : winner === 0 ? as.awayLg : as.homeLg, mvp };
        if (mvp) game.meta = Object.assign({}, game.meta, { mvp: mvp.pid });
      }
      // Pitchers who threw still need their rest.
      for (const side of box.pit) {
        for (const line of side) {
          const p = line.pid && P(L, line.pid);
          if (p && line.pitches) LG().markPitched(p, line.pitches);
        }
      }
      const names = [game.meta.awayName, game.meta.homeName];
      if (winner >= 0) {
        const mt = mvp ? teamById(L, mvp.teamId) : null;
        news(L, `The ${names[winner]} beat the ${names[1 - winner]} ${box.score[winner]}-${box.score[1 - winner]} in the All-Star Game.${mvp ? ` MVP: ${mvp.name}${mt ? ' (' + mt.abbr + ')' : ''}, ${mvp.line}.` : ''}`, 'allstar', mvp ? mvp.teamId : null);
      }
      statVersion++;
      return true;
    },
  };

  // ---------------------------------------------------------------------------
  // Day hooks
  // ---------------------------------------------------------------------------
  function beforeDay(L) {
    if (L.phase === 'offseason') return;
    for (const t of L.teams) {
      normalizeRoster(L, t);
      if (t.rotation.length < 5) manage(L, t);
      staggerRest(L, t);
    }
    if (L.phase === 'regular') ensureAllStarIfToday(L);
  }

  function ensureAllStarIfToday(L) {
    const d = L.days[L.day];
    if (d && d.event === 'allstar' && !(L.allStar && L.allStar.year === L.year && L.allStar.gameId)) ensureAllStarGame(L);
  }

  function afterDay(L, d) {
    if (!d || L.phase === 'offseason') return;
    // Who played today (box scores are kept for the last few days).
    const played = new Set();
    for (const gid of d.games) {
      const gm = L.games[gid];
      if (!gm || !gm.box || gm.type === 'allstar') continue;
      for (const side of gm.box.bat) for (const line of side) if (line.pid) played.add(line.pid);
    }
    // Fatigue recovery and injury countdown.
    const healed = [];
    for (const id in L.players) {
      const p = L.players[id];
      if (!isP(p) && p.fatigue > 0) p.fatigue = Math.max(0, p.fatigue - FAT.passive - (played.has(id) ? 0 : FAT.rest));
      if (p.injury) {
        p.injury.days -= 1;
        if (p.injury.days <= 0) healed.push(p);
      }
    }
    for (const p of healed) heal(L, p);
    for (const t of L.teams) {
      normalizeRoster(L, t);
      if (t.rotation.length < 5) manage(L, t);
    }
    if (L.phase === 'regular') {
      // Weekly CPU roster check.
      if (L.day % 7 === 3) for (const t of L.teams) cpuRosterMoves(L, t);
      // The All-Star Game is created at the end of the day before it.
      const next = L.days[L.day + 1];
      if (next && next.event === 'allstar') ensureAllStarGame(L);
      // Awards when the last regular-season day is done.
      if (L.day >= L.days.length - 1 && !(L.awards && L.awards.year === L.year)) computeAwards(L);
    }
  }

  S().hooks.afterGame.push(afterGame);
  S().hooks.beforeDay.push(beforeDay);
  S().hooks.afterDay.push(afterDay);

  // ---------------------------------------------------------------------------
  // Queries for the UI and tests
  // ---------------------------------------------------------------------------
  // Everyone on an injured list (and day-to-day), the user's team first.
  function injuryList(L) {
    const out = [];
    for (const t of L.teams) {
      for (const id of t.roster.concat(t.il, t.reserves)) {
        const p = P(L, id);
        if (p && p.injury) out.push({ player: p, team: t, injury: p.injury });
      }
    }
    out.sort((a, b) => (b.team.id === L.userTeamId) - (a.team.id === L.userTeamId) || a.team.abbr.localeCompare(b.team.abbr) || b.injury.days - a.injury.days);
    return out;
  }

  // Expected return date (ISO) for an injured player, when it falls on the calendar.
  function returnDate(L, p) {
    if (!p.injury) return null;
    const d = L.days[L.day + p.injury.days];
    if (d) return d.date;
    const last = L.days[L.days.length - 1];
    return last ? LG().addDays(last.date, L.day + p.injury.days - (L.days.length - 1)) : null;
  }

  // Consistency check used by tests: returns a list of problems (empty = fine).
  function integrity(L, opts) {
    const o = opts || {};
    const errs = [];
    const seen = {};
    const statusFor = { roster: ['active'], reserves: ['reserve', 'prospect'], il: ['il'] };
    for (const t of L.teams) {
      for (const where of ['roster', 'reserves', 'il']) {
        for (const id of t[where]) {
          const p = P(L, id);
          if (!p) {
            errs.push(`${t.id} ${where} has missing player ${id}`);
            continue;
          }
          if (seen[id]) errs.push(`${p.name} (${id}) is on ${seen[id]} and ${t.id} ${where}`);
          seen[id] = t.id + ' ' + where;
          if (p.teamId !== t.id) errs.push(`${p.name} (${id}) teamId ${p.teamId} but listed by ${t.id}`);
          if (!statusFor[where].includes(p.status)) errs.push(`${p.name} (${id}) status ${p.status} in ${t.id} ${where}`);
          if (where === 'il' && !(p.injury && p.injury.il)) errs.push(`${p.name} (${id}) on ${t.id} IL without an IL injury`);
          if (where !== 'il' && p.injury && p.injury.il) errs.push(`${p.name} (${id}) has an IL injury but is in ${t.id} ${where}`);
        }
      }
      if (o.inSeason) {
        if (t.roster.length !== ROSTER_MAX) errs.push(`${t.id} has ${t.roster.length} active players`);
        if (t.reserves.length > RESERVE_MAX) errs.push(`${t.id} has ${t.reserves.length} reserves`);
      }
      if (o.depth) {
        if (t.lineup.length !== 9) errs.push(`${t.id} lineup has ${t.lineup.length}`);
        for (const e of t.lineup) if (!t.roster.includes(e.pid)) errs.push(`${t.id} lineup has non-roster ${e.pid}`);
        if (t.rotation.length !== 5) errs.push(`${t.id} rotation has ${t.rotation.length}`);
        for (const id of t.rotation) if (!t.roster.includes(id)) errs.push(`${t.id} rotation has non-roster ${id}`);
        if (new Set(t.lineup.map((e) => e.pid)).size !== t.lineup.length) errs.push(`${t.id} lineup repeats a player`);
      }
    }
    for (const id of L.freeAgents) {
      const p = P(L, id);
      if (!p) errs.push(`free agent ${id} missing`);
      else {
        if (seen[id]) errs.push(`${p.name} (${id}) is a free agent and on ${seen[id]}`);
        if (p.teamId) errs.push(`free agent ${p.name} has teamId ${p.teamId}`);
        if (p.status !== 'fa') errs.push(`free agent ${p.name} status ${p.status}`);
        seen[id] = 'FA';
      }
    }
    for (const id in L.players) {
      const p = L.players[id];
      if (p.teamId && !seen[id]) errs.push(`${p.name} (${id}) has teamId ${p.teamId} but is on no list`);
    }
    return errs;
  }

  Object.assign(D, {
    ROSTER_MAX, RESERVE_MAX, ORG_MAX, INJURY, FAT, RATE, AS_SIDES,
    value, statLine, context, wobaOf, fipOf, hitterWar, pitcherWar,
    injure, placeOnIL, activate, heal, injuryList, returnDate,
    normalizeRoster, callUp, sendDown, release, signFreeAgent, removeFromTeam, assignNumber, trimReserves, keepScore,
    pickSendDown, counts, orgCounts, fillOrgHoles, cpuRosterMoves, promote, demote,
    selectAllStars, ensureAllStarGame, allStarDayIndex, rosterPids,
    computeAwards, refreshRookies, exceededRookie, careerTotals,
    integrity, isPitcher: isP, manage,
  });
})(typeof window !== 'undefined' ? window : globalThis);
