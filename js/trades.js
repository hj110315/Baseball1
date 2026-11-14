// Trades: player values, evaluating offers (with roster-size and position
// checks), executing trades, the trade deadline, and occasional CPU-to-CPU
// trades. No DOM access. Owned by the depth agent.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;
  const LG = () => BB.league;
  const S = () => BB.season;
  const D = () => BB.depth;
  const O = () => BB.offseason;
  const T = (BB.trades = BB.trades || {});

  const rng = () => BB.depth.rng();
  const r1 = (x) => Math.round(x * 10) / 10;
  const P = (L, id) => L.players[id] || null;
  const isP = (p) => p.pos === 'SP' || p.pos === 'RP';
  const teamById = (L, id) => L.teams.find((t) => t.id === id) || null;
  const news = (L, text, kind, teamId) => D().news(L, text, kind, teamId);

  // How much more the CPU wants back than it gives, and how much a second,
  // third or fourth player adds (two fair pieces aren't one star).
  const MARGIN = { easy: 1.0, medium: 1.08, hard: 1.2 };
  const DEPTH_W = { easy: [1, 0.8, 0.65, 0.5], medium: [1, 0.7, 0.5, 0.35], hard: [1, 0.6, 0.4, 0.25] };
  const MAX_SIDE = 4;

  // ---------------------------------------------------------------------------
  // Values
  // ---------------------------------------------------------------------------
  const ability = (ovr, p) => (Math.pow(Math.max(0, ovr - 45), 1.6) / 4) * (p.pos === 'RP' ? 0.6 : 1);

  // Expected overall next year (same curve as offseason development, no noise).
  function project(ovr, pot, age) {
    if (age <= 27 && pot > ovr) return ovr + (pot - ovr) * (age <= 22 ? 0.32 : age <= 24 ? 0.27 : age <= 26 ? 0.2 : 0.12);
    if (age >= 31) return ovr - (0.4 + (age - 31) * 0.45) * 0.95;
    return ovr;
  }

  // Team mode: contenders want help now, rebuilding teams want youth.
  function mode(L, t) {
    const g = t.rec.w + t.rec.l;
    if (g < 20) return 'neutral';
    const pct = t.rec.w / g;
    return pct >= 0.535 ? 'contend' : pct <= 0.45 ? 'rebuild' : 'neutral';
  }

  // BB.trades.value(L, pid, forTeamId): overall, age, potential, contract
  // surplus and the receiving team's need at the position.
  function value(L, pid, forTeamId) {
    const p = P(L, pid);
    if (!p) return 0;
    const t = forTeamId ? teamById(L, forTeamId) : null;
    const m = t ? mode(L, t) : 'neutral';
    const yrs = U.clamp(p.contract && p.contract.years ? p.contract.years : 1, 1, 5);
    let v = 0;
    let ovr = p.ovr;
    for (let y = 0; y < yrs; y++) {
      const w = Math.pow(0.85, y) * (y > 0 && m === 'contend' ? 0.8 : y > 0 && m === 'rebuild' ? 1.15 : 1);
      v += ability(ovr, p) * w;
      ovr = project(ovr, p.pot, p.age + y + 1);
    }
    // Young players stay under team control past their deal.
    if (p.age <= 25) v += ability(Math.max(ovr, p.pot - 3), p) * 0.6 * (m === 'rebuild' ? 1.25 : m === 'contend' ? 0.8 : 1);
    // Contract surplus (value above salary) over the remaining years.
    const fair = O() ? O().fairSalary(p) : LG().salaryFor(p);
    v += U.clamp((fair - p.contract.salary) * yrs * 0.9, -25, 25);
    if (p.injury) v *= U.clamp(1 - p.injury.days / 200, 0.25, 1);
    // Need: an upgrade at a position matters more to the team getting him.
    if (t && p.teamId !== t.id && O()) v *= O().isUpgrade(L, t, p, O().teamNeeds(L, t)) ? 1.12 : 0.92;
    return Math.max(0, r1(v));
  }

  // ---------------------------------------------------------------------------
  // Deadline
  // ---------------------------------------------------------------------------
  function deadlineDay(L) {
    return L.phase === 'regular' ? Math.floor((L.days.length * 2) / 3) : null;
  }
  function deadlineDate(L) {
    const i = deadlineDay(L);
    return i != null && L.days[i] ? L.days[i].date : null;
  }
  // Is trading open? { open, reason, deadline }
  function windowOpen(L) {
    if (L.phase === 'postseason') return { open: false, reason: 'No trades during the postseason. Trading reopens in the offseason.' };
    if (L.phase === 'regular') {
      const date = deadlineDate(L);
      if (L.day > deadlineDay(L)) return { open: false, reason: `The trade deadline (${date}) has passed. Trading reopens in the offseason.`, deadline: date };
      return { open: true, deadline: date };
    }
    return { open: true, deadline: null };
  }

  // ---------------------------------------------------------------------------
  // Evaluating
  // ---------------------------------------------------------------------------
  // Organization checks after a trade: at most 40, two catchers, five
  // starters, 12 pitchers and 12 position players (injured list excluded).
  function rosterCheck(L, t, out, inn) {
    const outSet = new Set(out);
    const ids = t.roster.concat(t.reserves).filter((id) => !outSet.has(id));
    const incoming = inn.map((id) => P(L, id)).filter((p) => p && !(p.injury && p.injury.il));
    const org = ids.map((id) => P(L, id)).filter(Boolean).concat(incoming);
    const healthy = org.filter((p) => !(p.injury && p.injury.il));
    const c = { C: 0, SP: 0, P: 0, H: 0 };
    for (const p of healthy) {
      if (isP(p)) {
        c.P++;
        if (p.pos === 'SP') c.SP++;
      } else {
        c.H++;
        if (p.pos === 'C') c.C++;
      }
    }
    const name = t.id === L.userTeamId ? 'You' : t.abbr;
    if (org.length > D().ORG_MAX) return `${name} would have more than ${D().ORG_MAX} players in the organization.`;
    if (c.C < 2) return `${name} would be left with fewer than two healthy catchers.`;
    if (c.SP < 5) return `${name} would be left with fewer than five healthy starting pitchers.`;
    if (c.P < 12) return `${name} would be left with fewer than 12 healthy pitchers.`;
    if (c.H < 12) return `${name} would be left with fewer than 12 healthy position players.`;
    return null;
  }

  function weighted(vals, w) {
    const s = vals.slice().sort((a, b) => b - a);
    let sum = 0;
    s.forEach((v, i) => (sum += v * (w[i] != null ? w[i] : w[w.length - 1] * 0.7)));
    return sum;
  }

  // offer = { fromTeamId, toTeamId, give: [pids from fromTeam], get: [pids from toTeam] }.
  // The 'to' team decides. Returns { accept, reason, delta, recv, lose }, where
  // delta > 0 means the deal works for them.
  function evaluate(L, offer, opts) {
    const o = opts || {};
    const from = teamById(L, offer.fromTeamId);
    const to = teamById(L, offer.toTeamId);
    const give = Array.from(new Set(offer.give || []));
    const get = Array.from(new Set(offer.get || []));
    const no = (reason) => ({ accept: false, reason, delta: 0, recv: 0, lose: 0 });
    if (!from || !to || from === to) return no('Pick a trade partner.');
    const win = windowOpen(L);
    if (!win.open) return no(win.reason);
    if (!give.length && !get.length) return no('Add players to the trade.');
    if (give.length > MAX_SIDE || get.length > MAX_SIDE) return no(`At most ${MAX_SIDE} players on each side.`);
    const owns = (t, id) => t.roster.includes(id) || t.reserves.includes(id) || t.il.includes(id);
    if (give.some((id) => !owns(from, id))) return no(`Some of those players aren't with ${from.abbr} anymore.`);
    if (get.some((id) => !owns(to, id))) return no(`Some of those players aren't with ${to.abbr} anymore.`);
    const problem = rosterCheck(L, from, give, get) || rosterCheck(L, to, get, give);
    if (problem) return no(problem);
    const diff = o.difficulty || (from.id === L.userTeamId || to.id === L.userTeamId ? L.difficulty : 'medium');
    const margin = o.margin != null ? o.margin : MARGIN[diff] || 1.08;
    const recv = weighted(give.map((id) => value(L, id, to.id)), DEPTH_W[diff] || DEPTH_W.medium);
    const lose = get.reduce((s, id) => s + value(L, id, to.id), 0);
    const delta = recv - lose * margin;
    let accept = delta >= 0 && (recv > 0 || lose === 0);
    let reason;
    if (!get.length && recv < 1) {
      accept = false;
      reason = `${to.abbr} have no use for that.`;
    } else if (accept) reason = `${to.abbr} accept.`;
    else if (delta > -6) reason = `${to.abbr} are close: add a little more.`;
    else if (delta > -25) reason = `${to.abbr} want more in return.`;
    else reason = `${to.abbr} aren't interested at that price.`;
    return { accept, reason, delta: r1(delta), recv: r1(recv), lose: r1(lose * margin) };
  }

  // The cheapest player from the offering team that would get the deal done.
  function balance(L, offer) {
    const from = teamById(L, offer.fromTeamId);
    if (!from) return null;
    const used = new Set(offer.give || []);
    const cands = from.roster.concat(from.reserves).filter((id) => !used.has(id)).map((id) => ({ id, v: value(L, id, offer.toTeamId) })).sort((a, b) => a.v - b.v);
    for (const c of cands) {
      if (c.v <= 0) continue;
      const ev = evaluate(L, Object.assign({}, offer, { give: (offer.give || []).concat(c.id) }));
      if (ev.accept) return c.id;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Executing
  // ---------------------------------------------------------------------------
  function move(L, a, b, p) {
    const where = a.il.includes(p.id) ? 'il' : a.reserves.includes(p.id) ? 'reserves' : 'roster';
    D().removeFromTeam(a, p.id);
    p.teamId = b.id;
    b[where].push(p.id);
    if (where === 'roster') p.status = 'active';
    D().assignNumber(L, b, p);
  }

  function fixRoster(L, t) {
    if (L.phase === 'regular' || L.phase === 'postseason') D().normalizeRoster(L, t);
    else if (L.phase === 'spring') D().normalizeRoster(L, t);
    D().trimReserves(L, t);
    D().manage(L, t, t.id !== L.userTeamId);
  }

  const list = (L, ids) => ids.map((id) => P(L, id)).filter(Boolean).map((p) => `${p.pos} ${p.name}`).join(' and ');

  // Execute an accepted offer (opts.force skips evaluation, for CPU trades
  // already checked). Returns { ok, reason }.
  function execute(L, offer, opts) {
    const o = opts || {};
    const ev = o.force ? { accept: true } : evaluate(L, offer);
    if (!ev.accept) return { ok: false, reason: ev.reason };
    const a = teamById(L, offer.fromTeamId);
    const b = teamById(L, offer.toTeamId);
    const give = Array.from(new Set(offer.give || []));
    const get = Array.from(new Set(offer.get || []));
    const giveText = list(L, give);
    const getText = list(L, get);
    for (const id of give) move(L, a, b, P(L, id));
    for (const id of get) move(L, b, a, P(L, id));
    fixRoster(L, a);
    fixRoster(L, b);
    const text = get.length ? `Trade: the ${a.abbr} send ${giveText || 'nothing'} to the ${b.abbr} for ${getText}.` : `Trade: the ${a.abbr} send ${giveText} to the ${b.abbr}.`;
    news(L, text, 'trade', a.id === L.userTeamId || b.id === L.userTeamId ? L.userTeamId : a.id);
    L.trades = L.trades || [];
    const d = L.days[L.day];
    L.trades.unshift({ year: L.year, phase: L.phase, date: d ? d.date : L.off && L.off.date, a: a.id, b: b.id, aGave: give.map((id) => P(L, id).name), bGave: get.map((id) => P(L, id).name), text });
    if (L.trades.length > 60) L.trades.length = 60;
    return { ok: true, reason: text };
  }

  // ---------------------------------------------------------------------------
  // CPU-to-CPU trades: a contender buys a veteran from a seller with youth.
  // ---------------------------------------------------------------------------
  function pct(t) {
    const g = t.rec.w + t.rec.l;
    return g ? t.rec.w / g : 0.5;
  }

  function tryCpuTrade(L) {
    const cpu = L.teams.filter((t) => t.id !== L.userTeamId).sort((a, b) => pct(b) - pct(a));
    const buyer = U.pick(rng, cpu.slice(0, 10));
    const seller = U.pick(rng, cpu.slice(-12).filter((t) => t !== buyer));
    if (!buyer || !seller) return false;
    const needs = O().teamNeeds(L, buyer);
    const targets = seller.roster
      .map((id) => P(L, id))
      .filter((p) => p && !p.injury && p.age >= 26 && p.ovr >= 60 && O().isUpgrade(L, buyer, p, needs))
      .sort((x, y) => value(L, y.id, buyer.id) - value(L, x.id, buyer.id));
    const target = targets[0];
    if (!target) return false;
    // The buyer's core (top 12 by overall) is off the table.
    const core = new Set(buyer.roster.map((id) => P(L, id)).filter(Boolean).sort((x, y) => y.ovr - x.ovr).slice(0, 12).map((p) => p.id));
    const chips = buyer.roster
      .concat(buyer.reserves)
      .map((id) => P(L, id))
      .filter((p) => p && !core.has(p.id) && !p.injury && p.age <= 27)
      .sort((x, y) => value(L, y.id, seller.id) - value(L, x.id, seller.id));
    const give = [];
    const offer = { fromTeamId: buyer.id, toTeamId: seller.id, give, get: [target.id] };
    for (const c of chips) {
      if (give.length >= 3) break;
      give.push(c.id);
      const ev = evaluate(L, offer, { margin: 1.0, difficulty: 'medium' });
      if (ev.accept) {
        // The buyer must like it too.
        const back = evaluate(L, { fromTeamId: seller.id, toTeamId: buyer.id, give: [target.id], get: give.slice() }, { margin: 0.95, difficulty: 'medium' });
        if (!back.accept) return false;
        return execute(L, offer, { force: true }).ok;
      }
    }
    return false;
  }

  function cpuTrades(L, n) {
    let made = 0;
    for (let i = 0; i < n * 3 && made < n; i++) if (tryCpuTrade(L)) made++;
    return made;
  }

  // Weekly chance of a CPU trade before the deadline.
  S().hooks.afterDay.push((L) => {
    if (L.phase !== 'regular' || L.day > deadlineDay(L) || L.day < 14) return;
    if (L.day % 7 === 5 && rng() < 0.4) cpuTrades(L, 1);
  });

  Object.assign(T, { MARGIN, value, evaluate, execute, balance, windowOpen, deadlineDay, deadlineDate, cpuTrades, rosterCheck, mode });
})(typeof window !== 'undefined' ? window : globalThis);
