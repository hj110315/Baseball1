// Engine: builds a BB.game from league teams, runs games without graphics
// (pitch by pitch, same physics as the playable game), and produces box
// scores. No DOM access (Node-testable).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const G = () => BB.game;
  const LG = () => BB.league;

  // ---------------------------------------------------------------------------
  // Team definitions for one game
  // ---------------------------------------------------------------------------
  const P = (L, id) => L.players[id];

  // Starter for today: next healthy, rested pitcher in the rotation.
  function pickStarter(L, team) {
    const rot = team.rotation;
    for (let k = 0; k < rot.length; k++) {
      const idx = (team.rotIdx + k) % rot.length;
      const p = P(L, rot[idx]);
      if (p && !p.injury && p.arm.rest >= 4) return { p, idx };
    }
    // Everyone is tired: the most rested rotation arm, or a bullpen game.
    let best = null;
    for (let k = 0; k < rot.length; k++) {
      const p = P(L, rot[k]);
      if (p && !p.injury && (!best || p.arm.rest > best.p.arm.rest)) best = { p, idx: k };
    }
    if (best) return best;
    const pen = team.bullpen.map((id) => P(L, id)).filter((p) => p && !p.injury);
    return pen.length ? { p: pen[0], idx: team.rotIdx } : null;
  }

  // Lineup for today: injured players are replaced, and tired regulars
  // (fatigue > 0.85) sit when a healthy backup exists.
  function lineupFor(L, team) {
    const out = (p) => !p || p.injury || p.fatigue > 0.85;
    const base = team.lineup.filter((e) => P(L, e.pid));
    if (base.length === 9 && !base.some((e) => out(P(L, e.pid)))) return base;
    const exclude = new Set(base.filter((e) => out(P(L, e.pid))).map((e) => e.pid));
    if (!team.manual) {
      const alt = LG().bestLineup(L, team, exclude);
      if (alt.length === 9) return alt;
      const all = LG().bestLineup(L, team);
      return all.length === 9 ? all : fillLineup(L, team, all);
    }
    // The user's lineup: swap only the missing spots and keep their order.
    const inUse = new Set(base.map((e) => e.pid));
    const result = [];
    for (const e of base) {
      if (!exclude.has(e.pid)) {
        result.push(e);
        continue;
      }
      const sub = bestSub(L, team, e.pos, inUse, exclude);
      if (sub) {
        inUse.add(sub.id);
        result.push({ pid: sub.id, pos: e.pos });
      }
    }
    if (result.length === 9) return result;
    const alt = LG().bestLineup(L, team, exclude);
    return alt.length === 9 ? alt : fillLineup(L, team, LG().bestLineup(L, team));
  }

  // Last resort for a team without 9 healthy hitters: anyone available bats.
  function fillLineup(L, team, lineup) {
    const used = new Set(lineup.map((e) => e.pid));
    const pool = team.roster.concat(team.reserves).map((id) => P(L, id)).filter((p) => p && !p.injury && !used.has(p.id));
    pool.sort((a, b) => LG().isPitcher(a) - LG().isPitcher(b) || b.ovr - a.ovr);
    const taken = new Set(lineup.map((e) => e.pos));
    const open = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].filter((pos) => !taken.has(pos));
    const out = lineup.slice();
    while (out.length < 9 && pool.length) out.push({ pid: pool.shift().id, pos: open.shift() || 'DH' });
    return out;
  }

  function bestSub(L, team, pos, inUse, exclude) {
    let best = null;
    let score = -1e9;
    for (const id of team.roster) {
      const p = P(L, id);
      if (!p || LG().isPitcher(p) || p.injury || inUse.has(id) || exclude.has(id)) continue;
      const s = LG().ovrAt(p, pos);
      if (s > score) {
        score = s;
        best = p;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Bullpen workload (see DESIGN.md, "Bullpen workload").
  // arm.rest is days since the last appearance (1 = yesterday), arm.last the
  // pitches thrown then, arm.streak the days in a row that appearance made.
  // ---------------------------------------------------------------------------
  const PEN = { minArms: 3, setup: 2, backToBack: 8 };
  // Days off after an outing: a long one needs extra rest.
  function restNeeded(pitches) {
    return pitches > 50 ? 4 : pitches > 35 ? 3 : pitches > 20 ? 2 : 1;
  }
  // Hard rule: nobody pitches a third day in a row.
  function thirdDay(p) {
    return !!p.arm && p.arm.rest === 1 && (p.arm.streak || 1) >= 2;
  }
  function relieverReady(p) {
    if (!p.arm) return true;
    return !thirdDay(p) && p.arm.rest >= restNeeded(p.arm.last);
  }

  // Outs pitched so far this season (all of this year's games).
  function seasonOuts(p) {
    const s = p.stats || {};
    return (s.reg ? s.reg.pit.outs : 0) + (s.post ? s.post.pit.outs : 0) + (s.spring ? s.spring.pit.outs : 0);
  }

  // Today's bullpen: [{ p, pen: 'CL' | 'SU' | 'MR' }], middle relief first
  // (freshest first), then the setup men, the closer last.
  function bullpenFor(L, team, starterId) {
    const all = team.bullpen.map((id) => P(L, id)).filter((p) => p && !p.injury && p.id !== starterId);
    let ready = all.filter(relieverReady);
    if (ready.length < PEN.minArms) {
      // Nobody (or almost nobody) is rested: the least tired go, but never on a third straight day.
      const tired = all.filter((p) => !ready.includes(p) && !thirdDay(p));
      tired.sort((a, b) => b.arm.rest - restNeeded(b.arm.last) - (a.arm.rest - restNeeded(a.arm.last)) || a.arm.last - b.arm.last);
      ready = ready.concat(tired.slice(0, PEN.minArms - ready.length));
    }
    // Roles for today: the closer if he's available, then the best arms. A
    // reliever who pitched yesterday drops a little, so the late innings rotate.
    const score = (p) => (p.id === team.closer ? 1000 : 0) + p.ovr - (p.arm && p.arm.rest === 1 ? PEN.backToBack : 0);
    ready.sort((a, b) => score(b) - score(a));
    const out = ready.map((p, i) => ({ p, pen: i === 0 ? 'CL' : i <= PEN.setup ? 'SU' : 'MR' }));
    const tier = { MR: 0, SU: 1, CL: 2 };
    out.sort((a, b) => tier[a.pen] - tier[b.pen] || b.p.arm.rest - a.p.arm.rest || b.p.ovr - a.p.ovr);
    return out;
  }

  // TeamDef for BB.game.createGame (see ARCHITECTURE.md).
  function teamDef(L, team, opts) {
    const o = opts || {};
    const lineup = lineupFor(L, team);
    const starter = o.starterPid ? { p: P(L, o.starterPid), idx: team.rotIdx } : pickStarter(L, team);
    // In-season form (form.js) only in regular-season and postseason games.
    const fm = (p) => (o.form && BB.form ? BB.form.points(L, p) : 0);
    const staff = [];
    if (starter && starter.p) staff.push(LG().toGamePitcher(starter.p, 'SP', fm(starter.p)));
    for (const e of bullpenFor(L, team, starter && starter.p ? starter.p.id : null)) {
      const gp = LG().toGamePitcher(e.p, e.pen === 'CL' ? 'CL' : 'RP', fm(e.p));
      gp.pen = e.pen; // bullpen role today, for the CPU manager
      gp.rest = e.p.arm ? e.p.arm.rest : 9;
      gp.ovr = e.p.ovr;
      gp.load = seasonOuts(e.p); // innings so far, to share out the low-leverage work
      staff.push(gp);
    }
    const defense = { P: { q: 1, arm: 1 } };
    for (const e of lineup) if (e.pos !== 'DH') defense[e.pos] = LG().fieldDef(P(L, e.pid), e.pos);
    return {
      id: team.id,
      name: team.city + ' ' + team.name,
      abbr: team.abbr,
      color: team.color,
      lineup: lineup.map((e, i) => LG().toGameBatter(P(L, e.pid), e.pos, i, fm(P(L, e.pid)))),
      staff,
      defense,
    };
  }

  // ---------------------------------------------------------------------------
  // Create a game
  // ---------------------------------------------------------------------------
  function createGame(L, game, opts) {
    const o = opts || {};
    const away = L.teams.find((t) => t.id === game.away);
    const home = L.teams.find((t) => t.id === game.home);
    const userSide = o.userSide || null;
    const formOn = game.type === 'regular' || game.type === 'post';
    const g = G().createGame({
      innings: 9,
      difficulty: userSide ? L.difficulty : 'medium',
      away: o.awayDef || teamDef(L, away, { form: formOn }),
      home: o.homeDef || teamDef(L, home, { form: formOn }),
      userSide,
      ghostRunner: game.type === 'regular' || game.type === 'spring',
      meta: Object.assign({ type: game.type, gameId: game.id }, game.meta || {}),
    });
    return g;
  }

  // ---------------------------------------------------------------------------
  // Headless play
  // ---------------------------------------------------------------------------
  // One pitch with CPU decisions on both sides. Returns the game event.
  function playPitch(g, rng) {
    const game = G();
    // Bullpen moves happen between batters.
    if (g.balls === 0 && g.strikes === 0) {
      const ch = game.cpuPitchingChange(g, true);
      if (ch >= 0) game.changePitcher(g, game.fieldingTeam(g), ch);
    }
    const ft = game.fieldingTeam(g);
    const choice = game.cpuChoosePitch(g, rng);
    const loc = game.applyCommand(choice.target, choice.sigma, rng);
    const spec = game.pitchSpec(g, ft.pitcher, choice.type, false);
    const pitch = { type: choice.type, loc, q: spec.q, velo: spec.velo, fatigue: spec.fatigue };
    const stealBase = game.cpuStealDecision(g, rng);
    const delta = game.cpuSwing(g, pitch, rng);
    const b = game.currentBatter(g);
    let ev;
    let swing = null;
    if (delta !== null) swing = BB.sim.contact(delta, BB.CPU_WINDOWS, loc, b, rng, 1, game.contactFx(pitch));
    if (!swing) ev = game.takePitch(g, game.isStrike(loc), pitch.type);
    else if (swing.kind === 'miss') ev = game.swingMiss(g, pitch.type);
    else if (swing.kind === 'foul') ev = game.foulBall(g, pitch.type);
    else {
      const play = BB.sim.simulate({
        swing,
        batter: { idx: b.slot, name: b.name, speed: b.speed, hand: b.hand },
        bases: g.bases,
        outs: g.outs,
        defenseQuality: game.defenseQuality(g),
        rng,
        stealing: stealBase ? stealBase - 1 : 0,
      });
      if (play.result && play.result.foul) ev = game.foulBall(g, pitch.type);
      else {
        if (play.tagUp) BB.sim.resolveTagUp(play, game.cpuTagUp(play.tagUp.margin));
        ev = game.inPlay(g, play.result, pitch.type);
      }
    }
    const inPlayOrFoul = ev.type === 'inplay' || ev.type === 'foul';
    if (stealBase && !inPlayOrFoul && ev.type !== 'walk' && !ev.halfOver && game.stealableBase(g) === stealBase) {
      const r = g.bases[stealBase - 2];
      const res = BB.sim.stealResult(r, stealBase, pitch.type, 0, rng);
      const sev = game.steal(g, stealBase, res.safe);
      if (sev) ev = sev;
    }
    return ev;
  }

  // Sim until the game ends, or until stopWhen(g) is true at the start of a
  // half-inning (the state is then ready for the playable view).
  function runHeadless(g, opts) {
    const o = opts || {};
    const rng = o.rng || Math.random;
    // Simulated stretches use neutral (Medium) physics for the CPU on both sides.
    const savedDiff = g.diff;
    g.diff = BB.DIFFICULTIES.medium;
    let guard = 0;
    try {
      while (!g.over) {
        if (++guard > 20000) throw new Error('runaway game');
        const ev = playPitch(g, rng);
        if (ev.halfOver && !g.over) {
          G().startNextHalf(g);
          if (o.stopWhen && o.stopWhen(g)) break;
        }
      }
    } finally {
      g.diff = savedDiff;
    }
    return g;
  }

  function finishHeadless(g, rng) {
    return runHeadless(g, { rng });
  }

  // Late and close (7th inning on, within 3 runs) or extra innings.
  function isKeyMoment(g) {
    if (g.inning > g.innings) return true;
    return g.inning >= 7 && Math.abs(g.teams[0].runs - g.teams[1].runs) <= 3;
  }

  // ---------------------------------------------------------------------------
  // Box score
  // ---------------------------------------------------------------------------
  function box(g, withLog) {
    const pid = (x) => (x ? x.pid || null : null);
    const dec = g.decisions || { w: null, l: null, sv: null };
    const out = {
      score: [g.teams[0].runs, g.teams[1].runs],
      hits: [g.teams[0].hits, g.teams[1].hits],
      line: [g.line[0].slice(), g.line[1].slice()],
      innings: g.inning,
      bat: [],
      pit: [],
      wp: pid(dec.w),
      lp: pid(dec.l),
      sv: pid(dec.sv),
      log: withLog ? g.log.map((l) => (l.half ? 'B' : 'T') + l.inning + ': ' + l.text) : null,
      // Splits for season stats; dropped before the box is stored.
      splits: { bat: [], pit: [] },
    };
    g.teams.forEach((t, i) => {
      out.bat.push(
        t.lineup.map((b) => ({
          pid: b.pid || null, name: b.name, pos: b.pos,
          ab: b.stats.ab, r: b.stats.r, h: b.stats.h, d: b.stats.d, t: b.stats.t, hr: b.stats.hr,
          rbi: b.stats.rbi, bb: b.stats.bb, k: b.stats.k, sb: b.stats.sb, cs: b.stats.cs, pa: b.stats.pa,
        })),
      );
      out.pit.push(
        t.appear.map((p, k) => ({
          pid: p.pid || null, name: p.name, gs: k === 0 ? 1 : 0,
          outs: p.stats.outs, h: p.stats.h, r: p.stats.r, er: p.stats.r, bb: p.stats.bb, k: p.stats.k,
          hr: p.stats.hr, pitches: p.stats.pitches,
          dec: p === dec.w ? 'W' : p === dec.l ? 'L' : p === dec.sv ? 'S' : '',
        })),
      );
      out.splits.bat.push(t.lineup.map((b) => ({ pid: b.pid, L: b.split.L, R: b.split.R })));
      out.splits.pit.push(t.appear.map((p) => ({ pid: p.pid, L: p.split.L, R: p.split.R })));
    });
    return out;
  }

  function simGame(L, game, rng) {
    const g = createGame(L, game, {});
    runHeadless(g, { rng });
    return { g, box: box(g, false) };
  }

  BB.engine = { teamDef, pickStarter, lineupFor, bullpenFor, relieverReady, restNeeded, createGame, playPitch, runHeadless, finishHeadless, isKeyMoment, box, simGame };
})(typeof window !== 'undefined' ? window : globalThis);
