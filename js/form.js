// In-season form: hot and cold streaks, and lasting mid-season changes
// (small steps, big breakouts, prospect busts). Logic only; no DOM access.
//
// Player fields (all optional, so old saves load as neutral):
//   p.form  = { v }    form in rating points (+ hot, - cold), capped at ±CAP
//   p.notes = [{ year, date, kind, text, deltas, ovr: [before, after], pot: [before, after] }]
// League field: L.formFit, the running fit of results against ratings that
// says what "normal" is for a player of each rating.
(function (root) {
  const BB = (root.BB = root.BB || {});
  const U = BB.U;
  const LG = () => BB.league;
  const S = () => BB.season;
  const rng = Math.random;

  // Form settings (Claude's defaults; see DESIGN.md "In-season form").
  const F = {
    cap: 6, // form never goes past ±6 rating points
    fade: 0.944, // daily fade: half of today's form is gone in about 12 days
    luck: 0.5, // daily random drift (rating points)
    perPA: 0.3, // how much each plate appearance (or batter faced) above or below normal moves form
    icon: 2.8, // form at which the hot or cold icon shows (about the top and bottom 10%)
    sdPA: 0.5, // spread of one plate appearance's value, to standardize results
    springLuck: 1.0, // luck in the Opening Day form
    fitDecay: 0.995, // daily decay of the league-wide results fit
  };
  // Lasting changes per regular season across all 30 teams (Claude's defaults).
  const RATES = { up: 9, down: 8, breakout: 2, bust: 2 };
  const HIT_MAIN = ['con', 'pow', 'eye'];
  const PIT_MAIN = ['stf', 'ctl', 'vel'];
  const NAMES = { con: 'contact', pow: 'power', eye: 'eye', spd: 'speed', fld: 'fielding', arm: 'arm', vel: 'velocity', ctl: 'control', sta: 'stamina', stf: 'stuff' };
  const LABEL = { up: 'Step forward', down: 'Step back', breakout: 'Breakout', bust: 'Prospect bust' };

  const isP = (p) => p.pos === 'SP' || p.pos === 'RP';
  const formOf = (p) => (p && p.form && typeof p.form.v === 'number' ? p.form.v : 0);

  // ---------------------------------------------------------------------------
  // Results against ratings
  // ---------------------------------------------------------------------------
  // Value of a batting line, per plate appearance (a wOBA-like scale).
  function batValue(l) {
    const singles = (l.h || 0) - (l.d || 0) - (l.t || 0) - (l.hr || 0);
    return 0.7 * (l.bb || 0) + 0.9 * singles + 1.25 * (l.d || 0) + 1.6 * (l.t || 0) + 2.0 * (l.hr || 0);
  }
  // Value allowed by a pitching line, per batter faced, on the same scale.
  function pitValue(l) {
    return 0.7 * (l.bb || 0) + 0.95 * ((l.h || 0) - (l.hr || 0)) + 2.0 * (l.hr || 0);
  }
  const batFaced = (l) => (l.outs || 0) + (l.h || 0) + (l.bb || 0);
  // The rating a result is measured against.
  const hitX = (p) => LG().offense(p);
  const pitX = (p) => p.ovr;

  // League fit: value per PA = a + b * (rating - 60). Starts from a prior and
  // follows the league, so it stays centered if the balance settings change.
  function newFit(a, b) {
    const w = 3000;
    return { sw: w, sx: w * 60, sy: w * a, sxx: w * (3600 + 64), sxy: w * (60 * a + 8 * b) };
  }
  function fitOf(L) {
    if (!L.formFit) L.formFit = { h: newFit(0.31, 0.004), p: newFit(0.31, -0.003) };
    return L.formFit;
  }
  function expect(f, x) {
    const mx = f.sx / f.sw;
    const my = f.sy / f.sw;
    const vx = f.sxx / f.sw - mx * mx;
    const b = vx > 1e-6 ? (f.sxy / f.sw - mx * my) / vx : 0;
    return my + b * (x - mx);
  }
  function addFit(f, x, yPer, n) {
    f.sw += n;
    f.sx += n * x;
    f.sy += yPer * n;
    f.sxx += n * x * x;
    f.sxy += n * x * yPer;
  }
  function decayFit(f, k) {
    for (const key in f) f[key] *= k;
  }

  // Results above (+) or below (-) normal, in standardized units summed over
  // the plate appearances: a big sample moves form more than one at-bat.
  function residual(L, p, line, pitcher) {
    const fit = fitOf(L)[pitcher ? 'p' : 'h'];
    const n = pitcher ? batFaced(line) : line.pa || 0;
    if (!n) return null;
    const x = pitcher ? pitX(p) : hitX(p);
    const y = pitcher ? pitValue(line) : batValue(line);
    const e = expect(fit, x) * n;
    return { r: ((pitcher ? -1 : 1) * (y - e)) / F.sdPA, n, x, y };
  }

  function setForm(p, v) {
    if (!p.form) p.form = { v: 0 };
    p.form.v = +U.clamp(v, -F.cap, F.cap).toFixed(2);
  }

  // ---------------------------------------------------------------------------
  // Form in games
  // ---------------------------------------------------------------------------
  const formGame = (type) => type === 'regular' || type === 'post';
  const showPhase = (L) => L && (L.phase === 'regular' || L.phase === 'postseason');

  // Form in rating points for today's game (0 outside the regular season and postseason).
  function points(L, p) {
    if (!showPhase(L)) return 0;
    return formOf(p);
  }
  // 'hot' | 'cold' | null: the icon shown next to the name.
  function status(L, p) {
    if (!p || !showPhase(L) || !p.teamId) return null;
    const v = formOf(p);
    return v >= F.icon ? 'hot' : v <= -F.icon ? 'cold' : null;
  }

  function afterGame(L, gm, box) {
    if (!gm || !formGame(gm.type) || !box) return;
    const fit = fitOf(L);
    for (let i = 0; i < 2; i++) {
      for (const line of box.bat[i] || []) {
        const p = line.pid && L.players[line.pid];
        if (!p) continue;
        const res = residual(L, p, line, false);
        if (!res) continue;
        addFit(fit.h, res.x, res.y / res.n, res.n);
        setForm(p, formOf(p) + F.perPA * res.r);
      }
      for (const line of box.pit[i] || []) {
        const p = line.pid && L.players[line.pid];
        if (!p) continue;
        const res = residual(L, p, line, true);
        if (!res) continue;
        addFit(fit.p, res.x, res.y / res.n, res.n);
        setForm(p, formOf(p) + F.perPA * res.r);
      }
    }
  }

  // Every day: form fades and drifts a little (luck), for players on active rosters.
  function afterDay(L, d) {
    if (L.phase !== 'regular' && L.phase !== 'postseason') return;
    const fit = fitOf(L);
    decayFit(fit.h, F.fitDecay);
    decayFit(fit.p, F.fitDecay);
    for (const t of L.teams) {
      for (const id of t.roster) {
        const p = L.players[id];
        if (!p) continue;
        setForm(p, formOf(p) * F.fade + U.gauss(rng, 0, F.luck));
      }
      // Off the active roster, form just fades.
      for (const id of t.reserves.concat(t.il || [])) {
        const p = L.players[id];
        if (p && p.form && p.form.v) setForm(p, p.form.v * F.fade);
      }
    }
    if (L.phase === 'regular') lastingDay(L, d);
  }

  // Opening Day: spring results (and a little luck) set each player's form.
  // A player with no spring games starts neutral.
  function openingForm(L) {
    let hot = 0;
    let cold = 0;
    for (const id in L.players) {
      const p = L.players[id];
      const s = p.stats && p.stats.spring;
      let v = 0;
      const bat = s && s.bat && s.bat.pa ? residual(L, p, s.bat, false) : null;
      const pit = s && s.pit && s.pit.outs ? residual(L, p, s.pit, true) : null;
      const res = isP(p) ? pit : bat;
      if (res) v = F.perPA * res.r + U.gauss(rng, 0, F.springLuck);
      if (v || p.form) setForm(p, v);
      if (v >= F.icon) hot++;
      if (v <= -F.icon) cold++;
    }
    return { hot, cold };
  }

  // ---------------------------------------------------------------------------
  // Lasting changes
  // ---------------------------------------------------------------------------
  function changedThisYear(p, year) {
    return !!(p.notes && p.notes.some((n) => n.year === year));
  }
  function poisson(lam) {
    let k = 0;
    let t = Math.exp(-lam);
    let s = t;
    const u = rng();
    while (u > s && k < 20) {
      k++;
      t *= lam / k;
      s += t;
    }
    return k;
  }
  function weightedPick(list) {
    let tot = 0;
    for (const e of list) tot += e.w;
    if (tot <= 0) return null;
    let r = rng() * tot;
    for (const e of list) {
      r -= e.w;
      if (r <= 0) return e.p;
    }
    return list[list.length - 1].p;
  }
  const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));

  // Who can get each kind of change today, and how likely each one is.
  function candidates(L, kind) {
    const out = [];
    const year = L.year;
    for (const t of L.teams) {
      const active = new Set(t.roster);
      for (const id of t.roster.concat(t.reserves)) {
        const p = L.players[id];
        if (!p || p.injury || changedThisYear(p, year)) continue;
        const v = active.has(id) ? formOf(p) : 0;
        const a = p.age;
        let w = 0;
        if (kind === 'up') {
          if (active.has(id) && v >= F.icon) w = a <= 25 ? 3 : a <= 29 ? 1.5 : a <= 32 ? 0.5 : 0.15;
        } else if (kind === 'down') {
          if (active.has(id) && v <= -F.icon) w = a >= 33 ? 3 : a >= 30 ? 2 : a >= 27 ? 0.6 : 0.2;
        } else if (kind === 'breakout') {
          // Mostly 27 and under; a rare late bloomer up to about 31 (owner's choice).
          if (active.has(id) && v >= F.icon) w = a <= 24 ? 3 : a <= 27 ? 2 : a <= 31 ? 0.25 : 0;
        } else if (kind === 'bust') {
          // Young prospects: cold big-leaguers, or prospects still in the organization.
          if (a <= 24 && p.pot > p.ovr + 3) w = active.has(id) ? (v <= -F.icon ? 3 : 0) : 0.15;
        }
        if (w > 0) out.push({ p, w });
      }
    }
    return out;
  }

  function lastingDay(L, d) {
    const days = Math.max(1, (L.days || []).length || 180);
    for (const kind of ['breakout', 'bust', 'up', 'down']) {
      const n = poisson(RATES[kind] / days);
      for (let i = 0; i < n; i++) {
        const p = weightedPick(candidates(L, kind));
        if (p) lastingChange(L, p, kind, d && d.date);
      }
    }
  }

  // Apply one lasting change and leave a note on the player's profile.
  function lastingChange(L, p, kind, date) {
    const main = isP(p) ? PIT_MAIN : HIT_MAIN;
    const extra = isP(p) ? [] : ['spd', 'fld'];
    const big = kind === 'breakout' || kind === 'bust';
    const sign = kind === 'up' || kind === 'breakout' ? 1 : -1;
    const n = big ? rint(2, 3) : rint(1, 3);
    const pool = main.slice();
    if (!big && kind === 'down') pool.push(...extra);
    const keys = [];
    while (keys.length < n && pool.length) keys.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    const before = { ovr: p.ovr, pot: p.pot };
    const deltas = {};
    for (const k of keys) {
      const size = big ? rint(5, 10) : rint(1, 3);
      const v = Math.round(U.clamp(p.r[k] + sign * size, 20, 99));
      if (v !== p.r[k]) deltas[k] = v - p.r[k];
      p.r[k] = v;
    }
    LG().refreshOvr(p); // a breakout past potential raises potential to match
    if (kind === 'bust') {
      // The ceiling drops too: about as far as the ratings, plus a little.
      const drop = before.ovr - p.ovr + rint(2, 6);
      p.pot = Math.max(p.ovr, before.pot - drop);
    }
    const what = Object.keys(deltas)
      .map((k) => `${deltas[k] > 0 ? '+' : ''}${deltas[k]} ${NAMES[k]}`)
      .join(', ');
    const note = {
      year: L.year,
      date: date || null,
      kind,
      text: `${LABEL[kind]}: ${what || 'no change'}${kind === 'bust' ? `, potential ${before.pot} → ${p.pot}` : ''}`,
      deltas,
      ovr: [before.ovr, p.ovr],
      pot: [before.pot, p.pot],
    };
    if (!p.notes) p.notes = [];
    p.notes.push(note);
    if (p.notes.length > 30) p.notes.splice(0, p.notes.length - 30);
    // Hot streak spent: a breakout or bust resets form toward neutral.
    if (big) setForm(p, formOf(p) * 0.4);
    return note;
  }

  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------
  if (S()) {
    S().hooks.afterGame.push(afterGame);
    S().hooks.afterDay.push(afterDay);
    const coreRegular = S().phases.regular;
    S().phases.regular = Object.assign({}, coreRegular, {
      start(L) {
        coreRegular.start(L);
        L.formOpening = Object.assign({ year: L.year }, openingForm(L));
      },
    });
  }

  BB.form = { F, RATES, points, status, value: formOf, afterGame, afterDay, openingForm, lastingChange, changedThisYear, formGame, NAMES, LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
