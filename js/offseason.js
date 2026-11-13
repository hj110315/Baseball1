// Offseason and spring training. The offseason is a step machine in
// L.offStep: 'recap' → 'retire' → 'progress' → 'resign' → 'draft' →
// 'freeagency' → 'done' (the next advancePhase starts spring). Spring adds
// breakouts and slumps and sets Opening Day rosters. Replaces
// BB.season.phases.offseason and extends phases.spring. No DOM access.
// Owned by the depth agent.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;
  const LG = () => BB.league;
  const S = () => BB.season;
  const D = () => BB.depth;
  const O = (BB.offseason = BB.offseason || {});

  const rng = () => BB.depth.rng();
  const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const r1 = (x) => Math.round(x * 10) / 10;
  const P = (L, id) => L.players[id] || null;
  const isP = (p) => p.pos === 'SP' || p.pos === 'RP';
  const teamById = (L, id) => L.teams.find((t) => t.id === id) || null;
  const full = (t) => (t ? t.city + ' ' + t.name : '');
  const news = (L, text, kind, teamId) => D().news(L, text, kind, teamId);
  const byOvr = (a, b) => b.ovr - a.ovr;
  const money = (m) => '$' + (m >= 10 ? Math.round(m) : m.toFixed(1)) + 'M';

  const STEPS = ['recap', 'retire', 'progress', 'resign', 'draft', 'freeagency', 'done'];
  const STEP_LABEL = {
    recap: 'Season recap', retire: 'Retirements', progress: 'Player development', resign: 'Re-sign players',
    draft: 'Draft', freeagency: 'Free agency', done: 'Ready for spring training',
  };
  const STEP_DATE = { recap: '11-01', retire: '11-04', progress: '11-08', resign: '11-15', draft: '12-05', freeagency: '12-15', done: '02-10' };
  const DRAFT_ROUNDS = 5;
  const FA_ROUNDS = 4;

  // ---------------------------------------------------------------------------
  // Money
  // ---------------------------------------------------------------------------
  // Everything the organization pays (active, injured and reserves).
  function orgPayroll(L, t) {
    let s = 0;
    for (const id of t.roster.concat(t.il, t.reserves)) {
      const p = P(L, id);
      if (p && p.contract) s += p.contract.salary;
    }
    return r1(s);
  }
  function fairSalary(p) {
    const base = Math.max(0.75, Math.pow(Math.max(0, p.ovr - 50) / 10, 2.4) * 1.2);
    const age = p.age <= 24 ? 0.5 : p.age <= 26 ? 0.8 : p.age >= 35 ? 0.75 : p.age >= 33 ? 0.88 : 1;
    return Math.max(0.75, base * age);
  }
  function expectedWar(p) {
    if (isP(p)) return p.pos === 'SP' ? (p.ovr - 52) * 0.22 : (p.ovr - 55) * 0.09;
    return (p.ovr - 50) * 0.2;
  }
  // What a CPU front office is willing to spend: bigger markets spend more of their budget.
  function spendCap(t) {
    return t.budget * (0.5 + 0.1 * t.market);
  }
  // Unsigned free agents ask for less as the winter goes on, and less again in season.
  function marketFactor(L) {
    if (L.phase === 'regular') return 0.55;
    if (L.phase === 'spring') return 0.7;
    if (L.phase === 'offseason' && L.off && L.off.fa) return Math.pow(0.92, L.off.fa.round);
    return 1;
  }
  // Asking contract { salary, years } (re-signing and free agency).
  function asking(L, p) {
    let s = fairSalary(p);
    const war = L.off && L.off.war ? L.off.war[p.id] : null;
    if (war != null) s *= 1 + U.clamp(war - expectedWar(p), -1.5, 2) * 0.08;
    if (p.status === 'fa') s *= marketFactor(L);
    let years = p.age >= 34 ? 1 : p.age >= 32 ? (p.ovr >= 65 ? 2 : 1) : p.age >= 29 ? (p.ovr >= 68 ? 3 : 2) : p.ovr >= 65 ? 4 : 3;
    if (p.ovr < 55) years = Math.min(years, p.age <= 26 ? 2 : 1);
    return { salary: Math.max(0.75, r1(s)), years };
  }

  // How a free agent rates an offer (>= 1 means yes): salary against the
  // asking price, adjusted for years, the team's quality and its market.
  function offerScore(L, p, t, salary, years) {
    const ask = asking(L, p);
    const g = t.rec.w + t.rec.l;
    const pct = g ? t.rec.w / g : 0.5;
    const quality = U.clamp((pct - 0.5) * 0.4, -0.08, 0.08);
    const market = (t.market - 2) * 0.04;
    const dy = U.clamp(years - ask.years, -3, 2);
    const yf = 1 + dy * (dy < 0 ? (p.age >= 30 ? 0.07 : 0.04) : 0.02);
    return (salary * yf * (1 + quality + market)) / ask.salary;
  }

  // ---------------------------------------------------------------------------
  // Step machine
  // ---------------------------------------------------------------------------
  function setStep(L, step) {
    L.offStep = step;
    const y = step === 'done' ? L.year + 1 : L.year;
    L.off.date = y + '-' + STEP_DATE[step];
    if (ENTER[step]) ENTER[step](L);
  }

  // Continue: finish the current step and enter the next. In free agency each
  // call runs one round until all rounds are done.
  function advance(L) {
    const step = L.offStep;
    if (L.phase !== 'offseason' || !step) return { ok: false, reason: 'Not in the offseason.' };
    if (step === 'done') return { ok: false, reason: 'The offseason is complete: start spring training.' };
    if (step === 'freeagency' && L.off.fa.round < L.off.fa.rounds) {
      const signed = faRound(L);
      return { ok: true, step, round: L.off.fa.round, signed };
    }
    if (EXIT[step]) EXIT[step](L);
    setStep(L, STEPS[STEPS.indexOf(step) + 1]);
    return { ok: true, step: L.offStep };
  }

  // Decide everything the user hasn't for the current step (used by tests and "sim to spring").
  function autoUser(L) {
    if (L.offStep === 'draft' && L.draft && !L.draft.done) simDraft(L, { untilUser: false });
    if (L.offStep === 'freeagency') {
      const t = S().userTeam(L);
      ensureOrg(L, t);
      // One sensible signing: the best affordable upgrade.
      const n = teamNeeds(L, t);
      const room = t.budget - orgPayroll(L, t);
      const p = L.freeAgents.map((id) => P(L, id)).filter((q) => q && !q.injury && isUpgrade(L, t, q, n) && asking(L, q).salary <= room).sort(byOvr)[0];
      if (p) {
        const ask = asking(L, p);
        offer(L, p.id, { salary: r1(ask.salary * 1.05), years: ask.years });
      }
    }
  }

  function runToDone(L) {
    let guard = 0;
    while (L.phase === 'offseason' && L.offStep !== 'done' && guard++ < 40) {
      autoUser(L);
      advance(L);
    }
  }

  function stepInfo(L) {
    const i = STEPS.indexOf(L.offStep);
    return { step: L.offStep, index: i, label: STEP_LABEL[L.offStep] || '', steps: STEPS.map((s) => ({ id: s, label: STEP_LABEL[s] })) };
  }

  // ---------------------------------------------------------------------------
  // 'recap': champion, awards and the history entry
  // ---------------------------------------------------------------------------
  function userFinish(L) {
    const u = L.userTeamId;
    const post = L.post;
    if (!post || !post.series) return '';
    if (post.champion === u) return 'Won the Diamond Series';
    const lost = post.series.find((s) => s.loser === u);
    if (lost) return 'Lost in the ' + lost.name;
    return 'Missed the postseason';
  }

  function writeHistory(L) {
    if (L.history.some((h) => h.year === L.year)) return;
    const post = L.post || {};
    const fin = post.series ? post.series.find((s) => s.key === 'final') : null;
    const ut = S().userTeam(L);
    const ch = teamById(L, post.champion);
    const ru = teamById(L, post.runnerUp);
    L.history.push({
      year: L.year,
      champion: post.champion || null,
      runnerUp: post.runnerUp || null,
      championName: full(ch),
      runnerUpName: full(ru),
      finalResult: fin && fin.winner ? `${fin.wins[fin.winner]}-${fin.wins[fin.loser]}` : null,
      seriesMvp: post.mvp || null,
      awards: L.awards ? JSON.parse(JSON.stringify(L.awards)) : null,
      allStar: L.allStar && L.allStar.result ? JSON.parse(JSON.stringify(L.allStar.result)) : null,
      records: L.teams.map((t) => ({ id: t.id, w: t.rec.w, l: t.rec.l, clinch: t.clinch || '' })),
      seeds: post.seeds || null,
      bracket: post.series ? post.series.map((s) => ({ key: s.key, name: s.name, lg: s.lg, hi: s.hi, lo: s.lo, hiSeed: s.hiSeed, loSeed: s.loSeed, wins: Object.assign({}, s.wins), winner: s.winner })) : null,
      user: { id: ut.id, w: ut.rec.w, l: ut.rec.l, finish: userFinish(L) },
    });
  }

  function enterRecap(L) {
    writeHistory(L);
    const ch = L.post && teamById(L, L.post.champion);
    news(L, `The ${L.year} season is in the books${ch ? `: the ${full(ch)} are champions` : ''}. The offseason begins.`, 'season');
  }

  // ---------------------------------------------------------------------------
  // 'retire'
  // ---------------------------------------------------------------------------
  function retireChance(p) {
    const a = p.age;
    let c = 0;
    if (a >= 41) c = 0.92;
    else if (a >= 33) c = 0.06 + (a - 33) * 0.09;
    if (a >= 33 && p.ovr >= 72) c *= 0.5; // stars hang on
    if (a >= 31 && p.ovr < 50) c += 0.25;
    if (a >= 31 && p.ovr < 45) c += 0.25;
    if (p.status === 'fa' && a >= 30) c += 0.2;
    if (p.status === 'reserve' && a >= 30 && p.ovr < 52) c += 0.2;
    if (p.injury && p.injury.type === 'season' && a >= 32) c += 0.15;
    return U.clamp(c, 0, 0.97);
  }

  // Career line, including a season that hasn't been archived yet.
  function careerLine(p) {
    let b = { pa: 0, ab: 0, h: 0, hr: 0, rbi: 0 };
    let q = { outs: 0, er: 0, w: 0, l: 0, k: 0, sv: 0 };
    const seasons = p.career.map((c) => c.reg);
    const cur = p.stats && p.stats.reg;
    if (cur && (cur.bat.pa || cur.pit.outs)) seasons.push(cur);
    for (const s of seasons) {
      for (const k in b) b[k] += s.bat[k] || 0;
      for (const k in q) q[k] += s.pit[k] || 0;
    }
    const n = seasons.length;
    const yrs = `${n} season${n === 1 ? '' : 's'}`;
    if (isP(p)) {
      const era = q.outs ? ((q.er * 27) / q.outs).toFixed(2) : '-';
      return `${q.w}-${q.l}, ${era} ERA, ${q.k} K${q.sv >= 20 ? ', ' + q.sv + ' SV' : ''} in ${yrs}`;
    }
    const avg = b.ab ? (b.h / b.ab).toFixed(3).replace(/^0/, '') : '.000';
    return `${avg}, ${b.hr} HR, ${b.h} H in ${yrs}`;
  }

  // Remove a player from the league for good.
  function retirePlayer(L, p) {
    const t = p.teamId ? teamById(L, p.teamId) : null;
    if (t) D().removeFromTeam(t, p.id);
    L.freeAgents = L.freeAgents.filter((id) => id !== p.id);
    delete L.players[p.id];
  }

  function enterRetire(L) {
    const out = [];
    for (const id in L.players) {
      const p = L.players[id];
      if (rng() < retireChance(p)) out.push(p);
    }
    const rows = [];
    for (const p of out) {
      const seasons = p.career.length + (p.stats.reg.bat.pa || p.stats.reg.pit.outs ? 1 : 0);
      const notable = p.ovr >= 65 || seasons >= 8 || p.teamId === L.userTeamId;
      rows.push({ pid: p.id, name: p.name, first: p.first, last: p.last, pos: p.pos, age: p.age, teamId: p.teamId, ovr: p.ovr, seasons, line: careerLine(p), notable });
      retirePlayer(L, p);
    }
    rows.sort((a, b) => b.notable - a.notable || b.ovr - a.ovr);
    L.off.retired = rows;
    for (const r of rows.filter((x) => x.notable && (x.ovr >= 62 || x.teamId === L.userTeamId)).slice(0, 12)) {
      const t = teamById(L, r.teamId);
      news(L, `${t ? t.abbr + ' ' : ''}${r.pos} ${r.name} retires at ${r.age}: ${r.line}.`, 'retire', r.teamId);
    }
    news(L, `${rows.length} players retire this offseason.`, 'retire');
  }

  // ---------------------------------------------------------------------------
  // 'progress': archive, age, develop
  // ---------------------------------------------------------------------------
  // Performance against what ratings predicted, from last season's line:
  // hitters wOBA vs. offense rating, pitchers RA9/FIP blend vs. overall.
  // Returns { pid: nudge } in rating points (about -3..+3).
  function performanceNudges(L, year) {
    const ctx = { fipC: 3.1 };
    const rows = { h: [], p: [] };
    let er = 0;
    let outs = 0;
    let fipRaw = 0;
    for (const id in L.players) {
      const p = L.players[id];
      const c = p.career.find((x) => x.year === year);
      if (!c) continue;
      if (isP(p)) {
        if (c.reg.pit.outs >= 90) rows.p.push({ p, s: c.reg.pit, x: p.ovr });
        er += c.reg.pit.er;
        outs += c.reg.pit.outs;
        fipRaw += 13 * c.reg.pit.hr + 3 * c.reg.pit.bb - 2 * c.reg.pit.k;
      } else if (c.reg.bat.pa >= 150) rows.h.push({ p, s: c.reg.bat, x: LG().offense(p) });
    }
    if (outs) ctx.fipC = (er * 27) / outs - fipRaw / (outs / 3);
    const out = {};
    const fit = (list, yOf, wOf, sign, shrink) => {
      if (list.length < 10) return;
      let sw = 0, sx = 0, sy = 0;
      for (const r of list) {
        r.y = yOf(r);
        r.w = wOf(r);
        sw += r.w;
        sx += r.w * r.x;
        sy += r.w * r.y;
      }
      const mx = sx / sw;
      const my = sy / sw;
      let sxx = 0, sxy = 0;
      for (const r of list) {
        sxx += r.w * (r.x - mx) * (r.x - mx);
        sxy += r.w * (r.x - mx) * (r.y - my);
      }
      const b = sxx ? sxy / sxx : 0;
      let ss = 0;
      for (const r of list) {
        r.res = r.y - (my + b * (r.x - mx));
        ss += r.w * r.res * r.res;
      }
      const sd = Math.sqrt(ss / sw) || 1;
      for (const r of list) out[r.p.id] = U.clamp((sign * r.res) / sd * shrink(r) * 1.3, -3, 3);
    };
    fit(rows.h, (r) => D().wobaOf(r.s), (r) => r.s.pa, 1, (r) => r.s.pa / (r.s.pa + 300));
    fit(rows.p, (r) => 0.5 * ((r.s.er * 27) / r.s.outs) + 0.5 * D().fipOf(r.s, ctx), (r) => r.s.outs, -1, (r) => r.s.outs / (r.s.outs + 300));
    return out;
  }

  const DECLINE_W = { con: 1, pow: 0.8, eye: 0.5, spd: 1.5, fld: 1.1, arm: 1, vel: 1.3, ctl: 0.6, sta: 1, stf: 0.9 };
  const GROW_W = { con: 1.05, pow: 1.1, eye: 0.9, spd: 0.5, fld: 1, arm: 0.8, vel: 0.9, ctl: 1.1, sta: 1, stf: 1.05 };
  const NUDGE_W = { con: 0.8, pow: 0.6, eye: 0.5, spd: 0, fld: 0, arm: 0, vel: 0.3, ctl: 0.7, sta: 0, stf: 0.8 };

  // One year of development (the age has already gone up).
  function develop(p, nudge) {
    const a = p.age;
    const keys = isP(p) ? LG().PIT_KEYS : LG().HIT_KEYS;
    const gap = Math.max(0, p.pot - p.ovr);
    let mean = 0;
    if (a <= 27 && gap > 0) mean = Math.min(8, gap * (a <= 20 ? 0.36 : a <= 22 ? 0.32 : a <= 24 ? 0.27 : a <= 26 ? 0.2 : 0.12));
    else if (a >= 31) mean = -(0.4 + (a - 31) * 0.45);
    const changes = {};
    for (const k of keys) {
      const m = mean < 0 ? mean * DECLINE_W[k] : mean * GROW_W[k];
      const d = m + U.gauss(rng, 0, 1.2) + (nudge || 0) * NUDGE_W[k];
      const v = Math.round(U.clamp(p.r[k] + d, 20, 99));
      if (v !== p.r[k]) changes[k] = v - p.r[k];
      p.r[k] = v;
    }
    LG().refreshOvr(p);
    if (a <= 25) p.pot = Math.round(U.clamp(p.pot + U.gauss(rng, 0, 2.2), p.ovr, 99));
    else if (a <= 28) p.pot = Math.max(p.ovr, p.pot - 3);
    else p.pot = p.ovr;
    return changes;
  }

  function enterProgress(L) {
    const year = L.year;
    S().archiveSeason(L);
    D().touch();
    const nudges = performanceNudges(L, year);
    const user = L.userTeamId;
    const rows = [];
    const lg = [];
    for (const id in L.players) {
      const p = L.players[id];
      const before = p.ovr;
      p.age++;
      const changes = develop(p, nudges[id] || 0);
      const row = { pid: p.id, name: p.name, pos: p.pos, age: p.age, before, after: p.ovr, delta: p.ovr - before, pot: p.pot, nudge: r1(nudges[id] || 0), changes };
      if (p.teamId === user) rows.push(row);
      if (p.teamId && p.age <= 26) lg.push(Object.assign({ teamId: p.teamId }, row));
      p.fatigue = 0;
      p.arm = { rest: 9, last: 0 };
      // The winter heals most injuries.
      if (p.injury) {
        p.injury.days -= 150;
        if (p.injury.days <= 0) {
          p.injury = null;
          const t = p.teamId && teamById(L, p.teamId);
          if (t && t.il.includes(p.id)) {
            t.il = t.il.filter((x) => x !== p.id);
            t.roster.push(p.id);
            p.status = 'active';
          }
        }
      }
    }
    rows.sort((a, b) => b.delta - a.delta);
    lg.sort((a, b) => b.delta - a.delta);
    L.off.progress = { teamId: user, year: year + 1, rows, league: lg.slice(0, 12) };
    // The season's games and calendar are archived with the stats.
    L.games = {};
    L.days = [];
    L.day = 0;
    const up = rows[0];
    const down = rows[rows.length - 1];
    if (up && up.delta > 0) news(L, `Development: ${up.name} (${up.pos}, ${up.age}) jumps ${up.before} → ${up.after}.`, 'progress', user);
    if (down && down.delta < 0) news(L, `Development: ${down.name} (${down.pos}, ${down.age}) slips ${down.before} → ${down.after}.`, 'progress', user);
    const star = lg.find((r) => r.teamId !== user);
    if (star && star.delta >= 5) {
      const t = teamById(L, star.teamId);
      news(L, `Breakout winter: ${t.abbr} ${star.pos} ${star.name} (${star.age}) jumps ${star.before} → ${star.after}.`, 'progress', star.teamId);
    }
    for (const t of L.teams) LG().autoManage(L, t, t.id !== L.userTeamId);
  }

  // ---------------------------------------------------------------------------
  // 'resign': contract years tick down; decisions on expiring deals
  // ---------------------------------------------------------------------------
  function suggestResign(L, t, p, ask) {
    if (p.age >= 36) return 'release';
    if (p.ovr >= 58 || (p.age <= 27 && p.pot >= 62)) return ask.salary <= fairSalary(p) * 1.6 ? 'sign' : 'release';
    return 'release';
  }

  function enterResign(L) {
    const list = [];
    for (const t of L.teams) {
      for (const id of t.roster.concat(t.reserves, t.il)) {
        const p = P(L, id);
        if (!p) continue;
        p.contract.years = Math.max(0, (p.contract.years | 0) - 1);
        if (p.contract.years > 0) continue;
        // Young players are still under team control: renewed automatically.
        if (p.age <= 24 || p.status === 'prospect') {
          p.contract = { years: rint(2, 3), salary: r1(Math.max(0.75, LG().salaryFor(p))) };
          continue;
        }
        if (t.id === L.userTeamId) {
          const ask = asking(L, p);
          list.push({ pid: p.id, ask, old: p.contract.salary, decision: suggestResign(L, t, p, ask) });
        }
      }
    }
    list.sort((a, b) => P(L, b.pid).ovr - P(L, a.pid).ovr);
    L.off.resign = { list, applied: false };
    if (list.length) news(L, `${list.length} of your players have expiring contracts. Decide who to re-sign.`, 'contract', L.userTeamId);
  }

  // Projected payroll for the user's team with the current re-sign decisions.
  function resignPayroll(L) {
    const t = S().userTeam(L);
    let pay = orgPayroll(L, t);
    if (L.off && L.off.resign) {
      for (const e of L.off.resign.list) {
        const p = P(L, e.pid);
        if (!p || p.teamId !== t.id) continue;
        pay -= p.contract.salary;
        if (e.decision === 'sign') pay += e.ask.salary;
      }
    }
    return r1(pay);
  }

  function setResign(L, pid, decision) {
    if (L.offStep !== 'resign' || !L.off.resign) return { ok: false, reason: 'Re-signing happens after player development.' };
    const e = L.off.resign.list.find((x) => x.pid === pid);
    if (!e) return { ok: false, reason: 'That player does not have an expiring contract.' };
    const prev = e.decision;
    e.decision = decision === 'sign' ? 'sign' : 'release';
    const t = S().userTeam(L);
    if (e.decision === 'sign' && resignPayroll(L) > t.budget) {
      e.decision = prev;
      return { ok: false, reason: `That would put your payroll over your ${money(t.budget)} budget.` };
    }
    return { ok: true };
  }

  function toFreeAgency(L, t, p) {
    D().release(L, t, p);
    p.contract = { years: 0, salary: asking(L, p).salary };
  }

  function cpuKeeps(L, t, p, ask) {
    const pay = orgPayroll(L, t) - p.contract.salary + ask.salary;
    if (pay > spendCap(t)) return false;
    let prob = p.ovr >= 70 ? 0.62 : p.ovr >= 62 ? 0.6 : p.ovr >= 55 ? 0.45 : 0.15;
    if (p.age >= 34) prob *= 0.55;
    if (p.age <= 27 && p.pot > p.ovr + 4) prob += 0.15;
    return rng() < prob;
  }

  function exitResign(L) {
    const ut = S().userTeam(L);
    const r = L.off.resign;
    let kept = 0;
    let left = 0;
    for (const e of r ? r.list : []) {
      const p = P(L, e.pid);
      if (!p || p.teamId !== ut.id) continue;
      if (e.decision === 'sign') {
        p.contract = { years: e.ask.years, salary: e.ask.salary };
        kept++;
        news(L, `${ut.abbr} re-sign ${p.name} (${p.pos}): ${e.ask.years} yr, ${money(e.ask.salary)}/yr.`, 'contract', ut.id);
      } else {
        toFreeAgency(L, ut, p);
        left++;
      }
    }
    if (r) r.applied = true;
    let fa = 0;
    for (const t of L.teams) {
      if (t.id === ut.id) continue;
      const exp = t.roster.concat(t.reserves, t.il).map((id) => P(L, id)).filter((p) => p && p.contract.years === 0).sort(byOvr);
      for (const p of exp) {
        const ask = asking(L, p);
        if (cpuKeeps(L, t, p, ask)) p.contract = { years: ask.years, salary: ask.salary };
        else {
          toFreeAgency(L, t, p);
          fa++;
        }
      }
    }
    // Anyone the user didn't decide on (e.g., traded in) hits the market too.
    for (const id of ut.roster.concat(ut.reserves, ut.il)) {
      const p = P(L, id);
      if (p && p.contract.years === 0) toFreeAgency(L, ut, p);
    }
    if (kept + left) news(L, `You re-sign ${kept} player${kept === 1 ? '' : 's'} and let ${left} go.`, 'contract', ut.id);
    news(L, `${fa + left} players with expiring contracts head to free agency.`, 'contract');
    for (const t of L.teams) LG().autoManage(L, t, t.id !== L.userTeamId);
  }

  // ---------------------------------------------------------------------------
  // 'draft': 5 rounds, worst record picks first
  // ---------------------------------------------------------------------------
  function draftOrder(L) {
    return L.teams
      .map((t) => ({ id: t.id, pct: t.rec.w / Math.max(1, t.rec.w + t.rec.l), diff: t.rec.rs - t.rec.ra }))
      .sort((a, b) => a.pct - b.pct || a.diff - b.diff || a.id.localeCompare(b.id))
      .map((x) => x.id);
  }

  function enterDraft(L) {
    const pool = [];
    const scout = {};
    const n = L.teams.length * DRAFT_ROUNDS + 60;
    for (let i = 0; i < n; i++) {
      const elite = i < 8;
      const opts = elite ? { mean: U.gauss(rng, 48, 4), potMean: 78, age: 20 + rint(0, 2) } : { age: 18 + rint(0, 4), potMean: 64 };
      const p = LG().makeProspect(L, rng, opts);
      p.teamId = null;
      p.status = 'prospect';
      pool.push(p.id);
      // Scouting: what the user sees is a range around a noisy read.
      const so = U.gauss(rng, 0, 3);
      const sp = U.gauss(rng, 0, p.age <= 19 ? 7 : 5);
      const wo = 3;
      const wp = p.age <= 19 ? 8 : 6;
      scout[p.id] = {
        ovr: [Math.round(U.clamp(p.ovr + so - wo, 20, 99)), Math.round(U.clamp(p.ovr + so + wo, 20, 99))],
        pot: [Math.round(U.clamp(p.pot + sp - wp, 20, 99)), Math.round(U.clamp(p.pot + sp + wp, 20, 99))],
      };
    }
    L.draft = { year: L.year, rounds: DRAFT_ROUNDS, order: draftOrder(L), pool, picks: [], cur: 0, done: false, scout };
    const ui = L.draft.order.indexOf(L.userTeamId);
    news(L, `The ${L.year} draft: ${pool.length} prospects, ${DRAFT_ROUNDS} rounds. You pick ${U.ordinal(ui + 1)} in each round.`, 'draft', L.userTeamId);
  }

  function onClock(L) {
    const d = L.draft;
    if (!d || d.done) return null;
    return d.order[d.cur % d.order.length];
  }

  function makePick(L, teamId, pid) {
    const d = L.draft;
    const t = teamById(L, teamId);
    const p = P(L, pid);
    if (!d || d.done || !t || !p || !d.pool.includes(pid)) return false;
    const n = d.cur + 1;
    const round = Math.floor(d.cur / d.order.length) + 1;
    const inRound = (d.cur % d.order.length) + 1;
    d.pool = d.pool.filter((x) => x !== pid);
    d.picks.push({ n, round, inRound, teamId, pid, name: p.name, pos: p.pos, age: p.age, scout: d.scout[pid] });
    p.draft = { year: d.year, round, pick: n, teamId };
    p.teamId = teamId;
    p.status = 'prospect';
    p.contract = { years: round === 1 ? 4 : 3, salary: round === 1 ? (inRound <= 5 ? 2.5 : 1.5) : 0.75 };
    t.reserves.push(pid);
    D().assignNumber(L, t, p);
    d.cur++;
    if (d.cur >= d.order.length * d.rounds || !d.pool.length) d.done = true;
    if (n === 1) news(L, `With the first pick of the ${d.year} draft, the ${full(t)} select ${p.pos} ${p.name} (${p.age}).`, 'draft', t.id);
    else if (teamId === L.userTeamId) news(L, `Round ${round}, pick ${inRound}: you select ${p.pos} ${p.name} (${p.age}).`, 'draft', t.id);
    return true;
  }

  function orgNeedBonus(L, t, p) {
    const c = D().orgCounts(L, t);
    if (p.pos === 'C' && c.C < 3) return 3;
    if (p.pos === 'SP' && c.SP < 8) return 2;
    if (!isP(p) && c.H < 18) return 1.5;
    if (isP(p) && c.P < 18) return 1.5;
    return 0;
  }

  // CPU teams read potential with their own noise and weigh need.
  function cpuPick(L, teamId) {
    const t = teamById(L, teamId);
    let best = null;
    let bs = -1e9;
    for (const pid of L.draft.pool) {
      const p = P(L, pid);
      const s = (p.pot + U.gauss(rng, 0, 4)) * 0.75 + p.ovr * 0.25 + orgNeedBonus(L, t, p);
      if (s > bs) {
        bs = s;
        best = pid;
      }
    }
    return best ? makePick(L, teamId, best) : false;
  }

  // The user's auto-pick: best scouted potential.
  function autoPickUser(L) {
    const d = L.draft;
    let best = null;
    let bs = -1e9;
    for (const pid of d.pool) {
      const sc = d.scout[pid];
      const s = (sc.pot[0] + sc.pot[1]) / 2 * 0.75 + (sc.ovr[0] + sc.ovr[1]) / 2 * 0.25;
      if (s > bs) {
        bs = s;
        best = pid;
      }
    }
    return best ? makePick(L, L.userTeamId, best) : false;
  }

  // The user's pick (must be on the clock).
  function draftPick(L, pid) {
    if (L.offStep !== 'draft' || !L.draft) return { ok: false, reason: 'The draft is not open.' };
    if (onClock(L) !== L.userTeamId) return { ok: false, reason: 'You are not on the clock.' };
    if (!L.draft.pool.includes(pid)) return { ok: false, reason: 'That player is not available.' };
    makePick(L, L.userTeamId, pid);
    return { ok: true };
  }

  // CPU picks until the user is on the clock (untilUser) or the draft ends
  // (the user's picks are then automatic).
  function simDraft(L, opts) {
    const o = opts || {};
    const d = L.draft;
    let guard = 0;
    while (d && !d.done && guard++ < 1000) {
      const tid = onClock(L);
      if (tid === L.userTeamId) {
        if (o.untilUser) break;
        autoPickUser(L);
      } else cpuPick(L, tid);
    }
  }

  // Keep the organization at 40 (active plus reserves): release the least valuable.
  function trimOrg(L, t) {
    while (t.roster.length + t.reserves.length > D().ORG_MAX) {
      const pool = t.reserves.length ? t.reserves : t.roster;
      const worst = pool.map((id) => P(L, id)).filter(Boolean).sort((a, b) => D().keepScore(a) - D().keepScore(b))[0];
      if (!worst) break;
      D().release(L, t, worst);
    }
  }

  // Promote reserves until the active roster has 26 (offseason bookkeeping).
  function fillActive(L, t) {
    while (t.roster.length < D().ROSTER_MAX && t.reserves.length) {
      const cands = t.reserves.map((id) => P(L, id)).filter((p) => p && p.status !== 'prospect');
      const p = (cands.length ? cands : t.reserves.map((id) => P(L, id)).filter(Boolean)).sort(byOvr)[0];
      if (!p) break;
      t.reserves = t.reserves.filter((x) => x !== p.id);
      t.roster.push(p.id);
      p.status = 'active';
    }
  }

  function exitDraft(L) {
    simDraft(L, { untilUser: false });
    const d = L.draft;
    for (const pid of d.pool) delete L.players[pid];
    d.pool = [];
    d.done = true;
    for (const t of L.teams) {
      fillActive(L, t);
      D().trimReserves(L, t);
      trimOrg(L, t);
      LG().autoManage(L, t, t.id !== L.userTeamId);
    }
    const mine = d.picks.filter((x) => x.teamId === L.userTeamId);
    news(L, `The ${d.year} draft is complete. Your picks: ${mine.map((x) => `${x.name} (${x.pos})`).join(', ')}.`, 'draft', L.userTeamId);
  }

  // ---------------------------------------------------------------------------
  // 'freeagency'
  // ---------------------------------------------------------------------------
  function teamNeeds(L, t) {
    const org = t.roster.concat(t.reserves).map((id) => P(L, id)).filter((p) => p && !(p.injury && p.injury.days > 40));
    const hitters = org.filter((p) => !isP(p));
    const lineup = LG().bestLineup(L, { roster: hitters.map((p) => p.id) });
    const atPos = {};
    for (const e of lineup) atPos[e.pos] = LG().ovrAt(P(L, e.pid), e.pos);
    const sps = org.filter((p) => p.pos === 'SP').map((p) => p.ovr).sort((a, b) => b - a);
    const rps = org.filter((p) => p.pos === 'RP').map((p) => p.ovr).sort((a, b) => b - a);
    return {
      atPos,
      sp5: sps.length >= 5 ? sps[4] : 0,
      rp7: rps.length >= 7 ? rps[6] : 0,
      C: hitters.filter((p) => p.pos === 'C').length,
      size: t.roster.length + t.reserves.length,
    };
  }

  // Rating points a player adds over the team's current option at his spot.
  function upgradeGain(L, p, n) {
    if (isP(p)) return p.pos === 'SP' ? p.ovr - n.sp5 : (p.ovr - n.rp7) * 0.6;
    if (p.pos === 'C' && n.C < 2) return 10;
    const here = n.atPos[p.pos];
    const g = here == null ? 12 : LG().ovrAt(p, p.pos) - here;
    const dh = n.atPos.DH != null ? LG().ovrAt(p, 'DH') - n.atPos.DH - 2 : -99;
    return Math.max(g, dh);
  }

  function isUpgrade(L, t, p, n) {
    if (isP(p)) return p.pos === 'SP' ? p.ovr > n.sp5 + 1 : p.ovr > n.rp7 + 1;
    if (p.pos === 'C' && n.C < 2) return true;
    const pos = p.pos === 'DH' ? 'DH' : p.pos;
    const here = n.atPos[pos];
    return here == null || LG().ovrAt(p, pos) > here + 1 || (n.atPos.DH != null && LG().ovrAt(p, 'DH') > n.atPos.DH + 3);
  }

  function enterFreeAgency(L) {
    L.off.fa = { round: 0, rounds: FA_ROUNDS, log: [] };
    const top = L.freeAgents.map((id) => P(L, id)).filter(Boolean).sort(byOvr).slice(0, 5);
    news(L, `Free agency opens with ${L.freeAgents.length} players available. Top names: ${top.map((p) => `${p.name} (${p.pos}, ${p.ovr})`).join(', ')}.`, 'freeagency');
  }

  function recordSigning(L, t, p, contract, how) {
    if (L.off && L.off.fa && L.phase === 'offseason') L.off.fa.log.push({ round: L.off.fa.round, pid: p.id, name: p.name, pos: p.pos, ovr: p.ovr, age: p.age, teamId: t.id, salary: contract.salary, years: contract.years, how });
  }

  // Sign a free agent to a team, making room in a full organization (CPU only).
  function sign(L, t, p, contract, how) {
    if (t.roster.length + t.reserves.length >= D().ORG_MAX) {
      const worst = t.reserves.map((id) => P(L, id)).filter(Boolean).sort((a, b) => D().keepScore(a) - D().keepScore(b))[0];
      if (!worst) return false;
      D().release(L, t, worst);
    }
    D().signFreeAgent(L, t, p, contract);
    recordSigning(L, t, p, contract, how);
    if (L.phase !== 'offseason') LG().autoManage(L, t);
    return true;
  }

  // One round of CPU bidding: teams offer to upgrades they can afford; players
  // take the best offer that meets their (cooling) asking price.
  function faRound(L) {
    const fa = L.off.fa;
    fa.round++;
    L.off.date = LG().addDays(L.year + '-12-15', (fa.round - 1) * 9);
    const pool = L.freeAgents.map((id) => P(L, id)).filter((p) => p && !(p.injury && p.injury.days > 60)).sort(byOvr);
    const offers = {};
    const teams = LG().shuffle(rng, L.teams.filter((t) => t.id !== L.userTeamId));
    for (const t of teams) {
      const n = teamNeeds(L, t);
      let room = spendCap(t) - orgPayroll(L, t);
      // Each team chases its own biggest improvements; a player with three
      // offers already is left to the others.
      const targets = pool
        .filter((p) => (offers[p.id] || []).length < 3 && isUpgrade(L, t, p, n))
        .map((p) => ({ p, gain: upgradeGain(L, p, n) + rng() * 3 }))
        .sort((a, b) => b.gain - a.gain);
      let made = 0;
      for (const x of targets) {
        if (made >= 2) break;
        const ask = asking(L, x.p);
        if (ask.salary > room) continue;
        const bid = r1(Math.min(room, ask.salary * (0.97 + rng() * 0.1 + (t.market - 2) * 0.03)));
        (offers[x.p.id] = offers[x.p.id] || []).push({ t, salary: bid, years: ask.years });
        room -= bid;
        made++;
      }
    }
    const signed = [];
    for (const pid in offers) {
      const p = P(L, pid);
      if (!p || p.status !== 'fa') continue;
      let best = null;
      let bs = 0;
      for (const o of offers[pid]) {
        const sc = offerScore(L, p, o.t, o.salary, o.years);
        if (sc > bs) {
          bs = sc;
          best = o;
        }
      }
      if (!best || bs < 1) continue;
      if (sign(L, best.t, p, { salary: best.salary, years: best.years }, 'cpu')) {
        signed.push({ p, t: best.t, salary: best.salary, years: best.years });
        if (p.ovr >= 64) news(L, `${best.t.abbr} sign free agent ${p.pos} ${p.name}: ${best.years} yr, ${money(best.salary)}/yr.`, 'freeagency', best.t.id);
      }
    }
    news(L, `Free agency, round ${fa.round}: ${signed.length} signing${signed.length === 1 ? '' : 's'}; ${L.freeAgents.length} players still available.`, 'freeagency');
    return signed.length;
  }

  // The user's offer, answered immediately.
  function offer(L, pid, o) {
    const p = P(L, pid);
    const t = S().userTeam(L);
    if (!p || p.status !== 'fa') return { ok: false, accepted: false, reason: 'That player is not a free agent.' };
    if (L.phase === 'postseason') return { ok: false, accepted: false, reason: 'Free agents can’t sign during the postseason.' };
    if (L.phase === 'offseason' && L.offStep !== 'freeagency' && L.offStep !== 'done') return { ok: false, accepted: false, reason: 'Free agency opens after the draft.' };
    const years = U.clamp(Math.round(+o.years || 1), 1, 6);
    const salary = Math.max(0.75, r1(+o.salary || 0));
    if (t.roster.length + t.reserves.length >= D().ORG_MAX) return { ok: false, accepted: false, reason: 'Your organization is full (40 players). Release someone first.' };
    if (orgPayroll(L, t) + salary > t.budget) return { ok: false, accepted: false, reason: `That would put your payroll over your ${money(t.budget)} budget.` };
    const sc = offerScore(L, p, t, salary, years);
    if (sc >= 1) {
      D().signFreeAgent(L, t, p, { salary, years });
      recordSigning(L, t, p, { salary, years }, 'user');
      if (L.phase !== 'offseason') {
        D().normalizeRoster(L, t);
        LG().autoManage(L, t);
      }
      news(L, `${t.abbr} sign free agent ${p.pos} ${p.name}: ${years} yr, ${money(salary)}/yr.`, 'freeagency', t.id);
      return { ok: true, accepted: true, reason: `${p.name} signs with you!` };
    }
    const want = r1(Math.ceil((salary / sc) * 10) / 10);
    return { ok: true, accepted: false, want, reason: `${p.name} turns it down. He'd sign for about ${money(want)}/yr over ${years} yr.` };
  }

  // Make sure an organization can field a legal roster: 2 catchers, 6 starters,
  // 14 pitchers and 14 hitters (cheap free agents, or fillers if none).
  function ensureOrg(L, t) {
    let guard = 0;
    while (guard++ < 20) {
      const c = D().orgCounts(L, t);
      let kind = null;
      let pos = null;
      if (c.C < 2) {
        kind = 'H';
        pos = 'C';
      } else if (c.SP < 6) {
        kind = 'P';
        pos = 'SP';
      } else if (c.P < 14) kind = 'P';
      else if (c.H < 14) kind = 'H';
      if (!kind) return;
      const list = L.freeAgents.map((id) => P(L, id)).filter((p) => p && !p.injury && (kind === 'P' ? isP(p) : !isP(p)) && (!pos || p.pos === pos));
      const room = t.budget - orgPayroll(L, t);
      let p = list.filter((q) => asking(L, q).salary <= room).sort(byOvr)[0] || list.sort((a, b) => a.contract.salary - b.contract.salary)[0];
      if (!p) {
        p = LG().makePlayer(L, rng, { pos: pos || (kind === 'P' ? 'RP' : U.pick(rng, ['2B', 'SS', 'CF', '3B', '1B'])), mean: 46, age: 26 + rint(0, 6) });
        p.status = 'fa';
        L.freeAgents.push(p.id);
      }
      const ask = asking(L, p);
      sign(L, t, p, { salary: Math.min(ask.salary, Math.max(0.75, fairSalary(p))), years: 1 }, 'fill');
      if (t.id === L.userTeamId) news(L, `${t.abbr} sign ${p.pos} ${p.name} to fill out the roster.`, 'freeagency', t.id);
    }
  }

  // Keep the free-agent pool to players someone might want.
  function cleanupFreeAgents(L) {
    let list = L.freeAgents.map((id) => P(L, id)).filter(Boolean);
    const gone = (p) => (p.age >= 25 && p.ovr < 45) || (p.age >= 32 && p.ovr < 54) || p.age >= 37;
    for (const p of list.filter(gone)) delete L.players[p.id];
    list = list.filter((p) => !gone(p)).sort((a, b) => D().keepScore(b) - D().keepScore(a));
    for (const p of list.slice(120)) delete L.players[p.id];
    L.freeAgents = list.slice(0, 120).map((p) => p.id);
  }

  function exitFreeAgency(L) {
    while (L.off.fa.round < L.off.fa.rounds) faRound(L);
    if (BB.trades && BB.trades.cpuTrades) BB.trades.cpuTrades(L, 2 + rint(0, 2));
    for (const t of L.teams) {
      if (t.id !== L.userTeamId) ensureOrg(L, t);
      fillActive(L, t);
      D().trimReserves(L, t);
      trimOrg(L, t);
    }
    cleanupFreeAgents(L);
  }

  function enterDone(L) {
    news(L, `The offseason is complete. Spring training opens soon.`, 'season');
  }

  const ENTER = { recap: enterRecap, retire: enterRetire, progress: enterProgress, resign: enterResign, draft: enterDraft, freeagency: enterFreeAgency, done: enterDone };
  const EXIT = { resign: exitResign, draft: exitDraft, freeagency: exitFreeAgency };

  S().phases.offseason = {
    start(L) {
      L.off = { year: L.year, date: null, war: {}, retired: [], progress: null, resign: null, fa: null };
      // Last season's value, for asking prices.
      for (const id in L.players) {
        const p = L.players[id];
        const s = p.stats.reg;
        if (s.bat.pa || s.pit.outs) L.off.war[id] = r1(D().value(L, p));
      }
      for (const t of L.teams) {
        // Nobody stays tired over the winter.
        for (const id of t.roster) {
          const p = P(L, id);
          if (p) p.fatigue = 0;
        }
      }
      setStep(L, 'recap');
    },
    end(L) {
      if (L.offStep !== 'done') runToDone(L);
      L.year++;
      L.offStep = null;
      L.post = null;
      L.awards = null;
      L.allStar = null;
    },
    done: (L) => L.offStep === 'done',
  };

  // ---------------------------------------------------------------------------
  // Spring training: breakouts and slumps, Opening Day rosters.
  // ---------------------------------------------------------------------------
  const BREAK_KEYS = { hit: ['con', 'pow', 'eye', 'con', 'pow', 'spd', 'fld'], pit: ['vel', 'ctl', 'stf', 'stf', 'ctl'] };

  function springEvent(L, t, p, kind) {
    const keys = BREAK_KEYS[isP(p) ? 'pit' : 'hit'];
    const n = rint(2, 3);
    const deltas = {};
    const before = p.ovr;
    for (let i = 0; i < n; i++) {
      const k = U.pick(rng, keys);
      if (deltas[k]) continue;
      const d = kind === 'breakout' ? rint(1, 4) : -rint(1, 3);
      p.r[k] = Math.round(U.clamp(p.r[k] + d, 20, 99));
      deltas[k] = d;
    }
    LG().refreshOvr(p);
    if (kind === 'breakout') p.pot = Math.min(99, Math.max(p.pot, p.ovr + 2));
    const ev = { pid: p.id, name: p.name, pos: p.pos, age: p.age, teamId: t.id, kind, deltas, before, after: p.ovr, date: (L.days[L.day] || {}).date || null };
    L.spring.events.push(ev);
    L.spring.touched[p.id] = kind;
    const user = t.id === L.userTeamId;
    const what = Object.keys(deltas).map((k) => `${k.toUpperCase()} ${deltas[k] > 0 ? '+' : ''}${deltas[k]}`).join(', ');
    if (kind === 'breakout' && (user || p.ovr - before >= 3 || p.ovr >= 66)) news(L, `Spring breakout: ${t.abbr} ${p.pos} ${p.name} (${p.age}) is turning heads (${what}).`, 'spring', t.id);
    if (kind === 'slump' && (user || p.ovr >= 68)) news(L, `Spring slump: ${t.abbr} ${p.pos} ${p.name} (${p.age}) looks a step slower (${what}).`, 'spring', t.id);
  }

  function springAfterDay(L) {
    if (L.phase !== 'spring' || !L.spring) return;
    const days = Math.max(1, L.days.length);
    for (const t of L.teams) {
      for (const id of t.roster.concat(t.reserves)) {
        const p = P(L, id);
        if (!p || L.spring.touched[id] || p.injury) continue;
        if (p.age <= 25 && rng() < 0.12 / days) springEvent(L, t, p, 'breakout');
        else if (p.age >= 31 && rng() < 0.08 / days) springEvent(L, t, p, 'slump');
      }
    }
  }
  S().hooks.afterDay.push(springAfterDay);

  // A sensible 26: the best lineup, a backup catcher, an infielder and an
  // outfielder, the best other bats to 13; five starters and eight relievers.
  function suggestRoster(L, t) {
    const org = t.roster.concat(t.reserves).map((id) => P(L, id)).filter((p) => p && !(p.injury && p.injury.il));
    const H = org.filter((p) => !isP(p)).sort(byOvr);
    const PP = org.filter(isP).sort(byOvr);
    const pick = new Set();
    for (const e of LG().bestLineup(L, { roster: H.map((p) => p.id) })) pick.add(e.pid);
    const left = () => H.filter((p) => !pick.has(p.id));
    const add = (p) => p && pick.add(p.id);
    add(left().find((p) => p.pos === 'C'));
    add(left().find((p) => p.pos === 'SS' || p.pos === '2B' || p.pos === '3B'));
    add(left().find((p) => p.pos === 'CF' || p.pos === 'LF' || p.pos === 'RF'));
    const nH = () => H.filter((p) => pick.has(p.id)).length;
    while (nH() < 13 && left().length) add(left()[0]);
    PP.filter((p) => p.pos === 'SP').slice(0, 5).forEach(add);
    PP.filter((p) => p.pos === 'RP').slice(0, 8).forEach(add);
    const leftP = () => PP.filter((p) => !pick.has(p.id));
    while (PP.filter((p) => pick.has(p.id)).length < 13 && leftP().length) add(leftP()[0]);
    while (pick.size < 26 && (left().length || leftP().length)) add(left()[0] && (!leftP()[0] || left()[0].ovr >= leftP()[0].ovr) ? left()[0] : leftP()[0]);
    return Array.from(pick).slice(0, 26);
  }

  function validateRoster(L, t, pids) {
    const errs = [];
    const ids = Array.from(new Set(pids || []));
    if (ids.length !== 26) errs.push(`Pick exactly 26 players (${ids.length} selected).`);
    const ps = ids.map((id) => P(L, id));
    if (ps.some((p) => !p || p.teamId !== t.id)) errs.push('Some of those players are not in your organization.');
    if (ps.some((p) => p && p.injury && p.injury.il)) errs.push('Players on the injured list can’t be on the Opening Day roster.');
    const pit = ps.filter((p) => p && isP(p)).length;
    if (pit < 11 || pit > 15) errs.push(`Carry 11 to 15 pitchers (${pit} selected).`);
    const orgC = D().orgCounts(L, t);
    const c = ps.filter((p) => p && p.pos === 'C').length;
    if (c < Math.min(2, orgC.C)) errs.push('Carry at least two catchers.');
    const sp = ps.filter((p) => p && p.pos === 'SP').length;
    if (sp < Math.min(5, orgC.SP)) errs.push('Carry at least five starting pitchers.');
    return errs;
  }

  // The user's Opening Day roster (validated and kept until spring ends).
  function setOpeningDay(L, pids) {
    const t = S().userTeam(L);
    const errs = validateRoster(L, t, pids);
    if (errs.length) return { ok: false, errors: errs };
    if (!L.spring) L.spring = { year: L.year, events: [], touched: {}, pick: null };
    L.spring.pick = Array.from(new Set(pids));
    return { ok: true, errors: [] };
  }

  // Move players between the active roster and the reserves to match pids.
  function applyRoster(L, t, pids) {
    const set = new Set(pids);
    for (const id of t.roster.slice()) {
      if (set.has(id)) continue;
      const p = P(L, id);
      t.roster = t.roster.filter((x) => x !== id);
      t.reserves.push(id);
      if (p) p.status = p.draft && p.age <= 23 && D().exceededRookie(p) === false ? 'prospect' : 'reserve';
    }
    for (const id of t.reserves.slice()) {
      if (!set.has(id)) continue;
      const p = P(L, id);
      t.reserves = t.reserves.filter((x) => x !== id);
      t.roster.push(id);
      if (p) p.status = 'active';
    }
    D().trimReserves(L, t);
    D().normalizeRoster(L, t, { force: true, strict: true });
    LG().autoManage(L, t, t.id !== L.userTeamId);
  }

  const coreSpring = S().phases.spring;
  S().phases.spring = {
    start(L) {
      coreSpring.start(L);
      L.spring = { year: L.year, events: [], touched: {}, pick: null };
      D().refreshRookies(L);
      for (const t of L.teams) {
        t.rec = LG().newRec();
        t.clinch = '';
        if (t.id !== L.userTeamId) ensureOrg(L, t);
      }
    },
    end(L) {
      for (const t of L.teams) {
        let pick = null;
        if (t.id === L.userTeamId && L.spring && L.spring.pick) {
          // Repair the user's choice if someone got hurt since: fill from the suggestion.
          const ok = L.spring.pick.filter((id) => {
            const p = P(L, id);
            return p && p.teamId === t.id && !(p.injury && p.injury.il);
          });
          const fill = suggestRoster(L, t).filter((id) => !ok.includes(id));
          while (ok.length < 26 && fill.length) ok.push(fill.shift());
          pick = validateRoster(L, t, ok).length ? null : ok;
        }
        applyRoster(L, t, pick || suggestRoster(L, t));
      }
      const ut = S().userTeam(L);
      news(L, `Opening Day rosters are set. The ${ut.name} carry ${ut.roster.filter((id) => isP(P(L, id))).length} pitchers and ${ut.roster.filter((id) => !isP(P(L, id))).length} position players.`, 'season', ut.id);
    },
    done: coreSpring.done,
  };

  Object.assign(O, {
    STEPS, STEP_LABEL, DRAFT_ROUNDS, FA_ROUNDS,
    advance, autoUser, runToDone, stepInfo, setStep,
    asking, fairSalary, offerScore, orgPayroll, marketFactor, spendCap, upgradeGain, trimOrg, fillActive,
    writeHistory, userFinish, retireChance, careerLine, develop, performanceNudges,
    resignPayroll, setResign, suggestResign,
    onClock, draftPick, simDraft, autoPickUser, makePick, draftOrder,
    faRound, offer, teamNeeds, isUpgrade, ensureOrg, cleanupFreeAgents, sign,
    suggestRoster, validateRoster, setOpeningDay, applyRoster,
  });
})(typeof window !== 'undefined' ? window : globalThis);
