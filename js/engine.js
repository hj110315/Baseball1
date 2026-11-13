// Engine: builds a BB.game from league teams, runs games without graphics
// (pitch by pitch, same physics as the playable game), and produces box
// scores. No DOM access (Node-testable).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;
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
      return alt.length === 9 ? alt : LG().bestLineup(L, team);
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
    return result.length === 9 ? result : LG().bestLineup(L, team, exclude).length === 9 ? LG().bestLineup(L, team, exclude) : LG().bestLineup(L, team);
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

  // TeamDef for BB.game.createGame (see ARCHITECTURE.md).
  function teamDef(L, team, opts) {
    const o = opts || {};
    const lineup = lineupFor(L, team);
    const starter = o.starterPid ? { p: P(L, o.starterPid), idx: team.rotIdx } : pickStarter(L, team);
    const staff = [];
    if (starter && starter.p) staff.push(LG().toGamePitcher(starter.p, 'SP'));
    // Bullpen: rested relievers, weakest first (they pitch the middle innings),
    // the closer last.
    // Relievers who pitched yesterday sit unless it was a short outing and the
    // bullpen is thin.
    let pen = team.bullpen.map((id) => P(L, id)).filter((p) => p && !p.injury && (!starter || p.id !== starter.p.id));
    const rested = pen.filter((p) => p.arm.rest >= 1 && !(p.arm.rest === 1 && p.arm.last > 30));
    pen = rested.length >= 4 ? rested : pen.filter((p) => !(p.arm.rest === 0 && p.arm.last > 25));
    pen.sort((a, b) => a.ovr - b.ovr);
    for (const p of pen) staff.push(LG().toGamePitcher(p, p.id === team.closer ? 'CL' : 'RP'));
    // Move the closer to the end.
    staff.sort((a, b) => (a.role === 'SP' ? -1 : b.role === 'SP' ? 1 : (a.role === 'CL') - (b.role === 'CL')));
    const defense = { P: { q: 1, arm: 1 } };
    for (const e of lineup) if (e.pos !== 'DH') defense[e.pos] = LG().fieldDef(P(L, e.pid));
    return {
      id: team.id,
      name: team.city + ' ' + team.name,
      abbr: team.abbr,
      color: team.color,
      lineup: lineup.map((e, i) => LG().toGameBatter(P(L, e.pid), e.pos, i)),
      staff,
      defense,
      starterIdx: starter ? starter.idx : 0,
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
    const g = G().createGame({
      innings: 9,
      difficulty: userSide ? L.difficulty : 'medium',
      away: o.awayDef || teamDef(L, away),
      home: o.homeDef || teamDef(L, home),
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

  BB.engine = { teamDef, pickStarter, lineupFor, createGame, playPitch, runHeadless, finishHeadless, isKeyMoment, box, simGame };
})(typeof window !== 'undefined' ? window : globalThis);
