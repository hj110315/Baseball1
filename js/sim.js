// Play simulation: turns a swing into a batted ball, then works out the
// fielding, throws and baserunning, and returns both the result and a
// timeline (script) the field view animates. No DOM access, so it can be
// tested in Node (see tools/simtest.js).
//
// Coordinates are in feet, top-down: home plate at (0,0), +y toward center
// field, +x toward first base / right field.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;

  const G = 32.2;
  const BASE = [
    { x: 0, y: 0 }, // home (as start)
    { x: 63.64, y: 63.64 },
    { x: 0, y: 127.28 },
    { x: -63.64, y: 63.64 },
    { x: 0, y: 0 }, // home (as destination)
  ];
  const FIELDER_HOME = {
    P: { x: 0, y: 56 },
    C: { x: 0, y: -4 },
    '1B': { x: 70, y: 84 },
    '2B': { x: 36, y: 142 },
    SS: { x: -36, y: 142 },
    '3B': { x: -68, y: 86 },
    LF: { x: -150, y: 245 },
    CF: { x: 0, y: 312 },
    RF: { x: 150, y: 245 },
  };
  const POS_ORDER = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
  const OUTFIELD = { LF: 1, CF: 1, RF: 1 };
  const POS_NAME = {
    P: 'the pitcher', C: 'the catcher', '1B': 'first', '2B': 'second', SS: 'short', '3B': 'third',
    LF: 'left', CF: 'center', RF: 'right',
  };

  // Fence distance by spray angle (degrees, negative = left field).
  function fenceDist(theta) {
    return 330 + 70 * Math.cos(U.rad(U.clamp(theta, -45, 45) * 2));
  }

  // Physics settings in one place (BB.sim.PHYS), so the calibration tools can
  // try values. Every game type uses them. See DESIGN.md "Balance pass 2".
  const PHYS = {
    wallHeight: 9, // feet: a fly ball that reaches the fence lower than this plays off the wall
    infield: 1.16, // every infielder's range: higher means fewer singles
    outfield: 0.95, // every outfielder's range: lower means more balls to the wall
    // Running down a ball on the ground: an outfielder who has to cover a
    // lot of ground can't field it in stride. Each foot of his run past
    // chaseFree costs chasePer seconds, up to chaseMax. A ball within
    // wallZone feet of the fence comes back to him off the wall instead.
    // This is where gap doubles come from (Milestone 2b).
    chaseFree: 30,
    chasePer: 0.022,
    chaseMax: 1,
    wallZone: 25,
    need: 0.2, // daylight (seconds) a runner wants before trying for an extra base
  };

  // q scales range (speed), a scales throwing strength.
  function fielderStats(pos, q, a) {
    if (a == null) a = q;
    if (pos === 'P') return { speed: 14 * q, react: 0.5, reach: 4, arm: 105 * a, transfer: 0.5, catchH: 7.5 };
    if (pos === 'C') return { speed: 14 * q, react: 0.45, reach: 3.5, arm: 110 * a, transfer: 0.55, catchH: 7.5 };
    if (OUTFIELD[pos]) return { speed: 24 * PHYS.outfield * q, react: 0.5, reach: 5, arm: 115 * a, transfer: 0.95, catchH: 9 };
    return { speed: 13.5 * PHYS.infield * q, react: 0.4, reach: 4.5, arm: 122 * a, transfer: 0.45, catchH: 8.5 };
  }

  function throwTime(from, to, f) {
    const d = U.dist(from, to);
    return d / f.arm + (d > 160 ? (d - 160) / 260 : 0);
  }

  // ---------------------------------------------------------------------------
  // Contact model. delta: ms (negative = early). windows: {perfect, good, foul}.
  // loc: {px, py} pitch location in zone units (|p| <= 1 is a strike).
  // Returns { kind: 'miss' | 'foul' | 'inplay', ev, theta, phi, quality }.
  // ---------------------------------------------------------------------------
  // fx: optional { phiShift, evMul } from the pitch type (BB.game.contactFx).
  function contact(delta, windows, loc, batter, rng, powerMul, fx) {
    const off = Math.max(0, Math.max(Math.abs(loc.px), Math.abs(loc.py)) - 1);
    const scale = 1 - U.clamp(off * 0.85, 0, 0.75);
    const perfect = windows.perfect * scale;
    const good = windows.good * scale;
    const foul = windows.foul * Math.max(0.5, scale);
    const a = Math.abs(delta);
    if (a > foul) return { kind: 'miss' };
    if (a > good) {
      if (rng() < 0.82) return { kind: 'foul' };
    }
    let q;
    if (a <= perfect) q = 1;
    else if (a <= good) q = 1 - 0.72 * ((a - perfect) / Math.max(1, good - perfect));
    else q = 0.15;
    if (rng() < 0.1 + 0.28 * (1 - q)) return { kind: 'foul' };

    const pw = (batter.power || 1) * (powerMul || 1);
    let ev = (90 + 64 * q + U.gauss(rng, 0, 8)) * (0.8 + 0.2 * pw);
    if (fx) ev *= fx.evMul;
    ev = U.clamp(ev, 55, 172);
    const sign = batter.hand === 'L' ? -1 : 1;
    const e = U.clamp(delta / Math.max(1, good), -1.6, 1.6);
    const theta = sign * (e * 34) + U.gauss(rng, 0, 11);
    let phi = U.gauss(rng, 4.5 + 12 * q, 18) + loc.py * 8 + (fx ? fx.phiShift : 0);
    phi = U.clamp(phi, -25, 72);
    return { kind: 'inplay', ev, theta, phi, quality: q };
  }

  // ---------------------------------------------------------------------------
  // Batted ball flight. Returns an object with pos(t) -> {x, y, h} and helpers.
  // ---------------------------------------------------------------------------
  function makeFlight(ev, theta, phi) {
    const dir = { x: Math.sin(U.rad(theta)), y: Math.cos(U.rad(theta)) };
    const fence = fenceDist(theta);
    const fair = Math.abs(theta) <= 45;
    if (phi < 8) {
      // Ground ball (or chopper). Rolls along the ground, slowing down.
      const chop = Math.max(0, -phi) / 50;
      const v0 = ev * 0.8 * (1 - chop);
      const dec = 10;
      const tStop = v0 / dec;
      const sMax = Math.min(v0 * tStop - 0.5 * dec * tStop * tStop, fence - 4);
      const sAt = (t) => Math.min(sMax, t >= tStop ? Infinity : v0 * t - 0.5 * dec * t * t);
      return {
        type: 'ground', dir, theta, fair, hang: 0, land: 0, fence,
        pos(t) {
          const s = Math.max(0, sAt(t));
          // A few small hops on the way out.
          const h = t < 1.2 ? Math.abs(Math.sin(t * 9)) * 3 * (1 - t / 1.2) : 0;
          return { x: dir.x * s, y: dir.y * s, h };
        },
        dist: sMax,
        tStop,
      };
    }
    const sinp = Math.sin(U.rad(phi));
    const k = 0.64 * (phi > 30 ? 1 - (phi - 30) / 75 : 1);
    const D = ((ev * ev * Math.sin(U.rad(2 * phi))) / G) * k;
    const H = ((2 * ev * sinp) / G) * 0.92;
    const apex = ((ev * sinp) * (ev * sinp)) / (2 * G) * 0.75;
    const hAt = (t) => 3 + 4 * apex * (t / H) * (1 - t / H) - 3 * (t / H);
    // Does it clear the fence?
    let hr = false;
    let wallT = null;
    if (fair && D > fence) {
      wallT = (H * fence) / D;
      if (hAt(wallT) > PHYS.wallHeight) hr = true;
    }
    // After landing it bounces and rolls on.
    const vLand = (D / H) * 0.5;
    const dec = 10;
    const tRoll = vLand / dec;
    const rollMax = vLand * tRoll - 0.5 * dec * tRoll * tRoll;
    const landS = wallT !== null && !hr ? fence : D;
    const landT = wallT !== null && !hr ? wallT : H;
    return {
      type: phi < 20 ? 'line' : phi > 48 ? 'pop' : 'fly',
      dir, theta, fair, hang: landT, land: landS, fence, hr, D, H, apex,
      pos(t) {
        if (t <= landT) {
          const s = (D * t) / H;
          return { x: dir.x * s, y: dir.y * s, h: Math.max(0, hAt(t)) };
        }
        const tt = t - landT;
        let s;
        if (wallT !== null && !hr) {
          // Off the wall: bounce back toward the infield a little.
          s = fence - Math.min(18, tt * 22);
        } else {
          const r = tt >= tRoll ? rollMax : vLand * tt - 0.5 * dec * tt * tt;
          s = Math.min(landS + r, fence - 4);
        }
        const bounce = tt < 0.8 ? Math.abs(Math.sin(tt * 7)) * 5 * (1 - tt / 0.8) : 0;
        return { x: dir.x * s, y: dir.y * s, h: bounce };
      },
      airH: hAt,
    };
  }

  function timeToReach(f, from, to) {
    const d = U.dist(from, to);
    return f.react + Math.max(0, d - f.reach) / f.speed;
  }

  // Extra time an outfielder needs to field a ball on the ground at point p
  // (see PHYS.chaseFree). Nothing for a ball at the wall.
  function chaseCost(f, p, flight) {
    if (!PHYS.chasePer || Math.hypot(p.x, p.y) > flight.fence - PHYS.wallZone) return 0;
    return Math.min(PHYS.chaseMax, Math.max(0, U.dist(f.home, p) - PHYS.chaseFree) * PHYS.chasePer);
  }

  // Decide who catches or fields the ball and when.
  function fieldBall(flight, defense) {
    let best = null;
    const step = 0.03;
    if (flight.type !== 'ground' && !flight.hr) {
      // Try to catch it in the air: anywhere along the descent below catch height.
      for (const pos of POS_ORDER) {
        const f = defense[pos];
        for (let t = flight.hang; t > 0.3; t -= step) {
          const p = flight.pos(t);
          if (p.h > f.catchH) break;
          if (Math.hypot(p.x, p.y) > flight.fence - 2) continue;
          const need = timeToReach(f, f.home, p) + (flight.type === 'line' && !OUTFIELD[pos] ? 0.3 : 0);
          if (need <= t) {
            if (!best || t > best.t || (t === best.t && need < best.need)) {
              // Prefer a catch at the latest possible moment (settled under it).
              best = { pos, t, at: { x: p.x, y: p.y }, caught: true, need };
            }
            break;
          }
        }
      }
      if (best) {
        // The fielder who gets there with the most time to spare makes the catch.
        let chosen = null;
        for (const pos of POS_ORDER) {
          const f = defense[pos];
          const p = flight.pos(flight.hang - 0.05);
          const need = timeToReach(f, f.home, p);
          if (need <= flight.hang && (!chosen || need < chosen.need)) chosen = { pos, need };
        }
        if (chosen && chosen.pos !== best.pos) {
          const p = flight.pos(flight.hang - 0.05);
          best = { pos: chosen.pos, t: flight.hang - 0.05, at: { x: p.x, y: p.y }, caught: true, need: chosen.need };
        }
        return best;
      }
    }
    if (flight.hr) return null;
    // Field it on the ground.
    const t0 = flight.type === 'ground' ? 0.15 : flight.hang;
    const tEnd = t0 + 14;
    for (let t = t0; t < tEnd; t += step) {
      const p = flight.pos(t);
      if (p.h > 4) continue;
      for (const pos of POS_ORDER) {
        const f = defense[pos];
        if (pos === 'C' && Math.hypot(p.x, p.y) > 35) continue;
        const chase = OUTFIELD[pos] ? chaseCost(f, p, flight) : 0;
        const need = timeToReach(f, f.home, p) + chase;
        if (need <= t) {
          // Diving or ranging plays slow down the throw.
          const d = U.dist(f.home, p);
          const runOnly = f.react + d / f.speed + chase;
          const dive = runOnly > t + 0.05;
          const ranged = d > 22 && !OUTFIELD[pos];
          return { pos, t, at: { x: p.x, y: p.y }, caught: false, dive, ranged, need, chase };
        }
      }
    }
    const p = flight.pos(tEnd);
    return { pos: 'CF', t: tEnd, at: { x: p.x, y: p.y }, caught: false };
  }

  // ---------------------------------------------------------------------------
  // Runner geometry.
  // ---------------------------------------------------------------------------
  const RUN_V = 28; // ft/s for a speed rating of 1.0
  function legTime(spd) {
    return 90 / (RUN_V * spd);
  }
  // Point along the base paths: base index b (0..4) plus fraction.
  function pathPoint(b, frac) {
    const a = BASE[Math.min(4, Math.floor(b))];
    const c = BASE[Math.min(4, Math.floor(b) + 1)] || BASE[4];
    return { x: U.lerp(a.x, c.x, frac), y: U.lerp(a.y, c.y, frac) };
  }

  // Arrival times at each base for a runner starting at `from` (0 = batter)
  // who starts moving at `start` seconds with `lead` feet already covered.
  function arrivals(from, spd, start, lead) {
    const out = {};
    const leg = legTime(spd);
    let t = start + (from === 0 ? 1.0 : 0) - (lead / 90) * leg;
    for (let b = from + 1; b <= 4; b++) {
      t += leg + (b > from + 1 ? 0.15 : 0);
      out[b] = t;
    }
    return out;
  }

  // quality: one number for the whole team, or a per-position map { SS: { q, arm }, ... }.
  function makeDefense(quality) {
    const d = {};
    for (const pos of POS_ORDER) {
      let q = 1;
      let a = 1;
      if (typeof quality === 'number') q = a = quality;
      else if (quality && quality[pos]) {
        q = quality[pos].q;
        a = quality[pos].arm;
      }
      d[pos] = Object.assign({ pos, home: FIELDER_HOME[pos] }, fielderStats(pos, q, a));
    }
    return d;
  }

  // ---------------------------------------------------------------------------
  // Script building helpers for the animation.
  // ---------------------------------------------------------------------------
  function newScript() {
    return { ball: [], fielders: {}, runners: [], events: [], end: 0 };
  }
  function addEvent(script, t, kind, text, at) {
    script.events.push({ t, kind, text, x: at ? at.x : 0, y: at ? at.y : 0 });
    script.end = Math.max(script.end, t + 0.6);
  }
  function fielderPath(script, pos, home) {
    if (!script.fielders[pos]) script.fielders[pos] = { pos, path: [{ t: 0, x: home.x, y: home.y }] };
    return script.fielders[pos];
  }
  // exact: arrive at tLatest and not before (a long run to cut a ball off).
  function moveFielder(script, defense, pos, to, tStart, tLatest, exact) {
    const f = defense[pos];
    const fp = fielderPath(script, pos, f.home);
    const last = fp.path[fp.path.length - 1];
    const from = { x: last.x, y: last.y };
    const t0 = Math.max(last.t, tStart);
    const d = U.dist(from, to);
    let t1 = t0 + d / f.speed;
    if (tLatest !== undefined) t1 = exact ? Math.max(tLatest, t0 + 0.05) : Math.min(Math.max(t0 + 0.05, t1), Math.max(tLatest, t0 + 0.05));
    if (t0 > last.t) fp.path.push({ t: t0, x: from.x, y: from.y });
    fp.path.push({ t: t1, x: to.x, y: to.y });
    return t1;
  }
  function throwBall(script, from, to, t0, dur) {
    script.ball.push({ kind: 'throw', t0, t1: t0 + dur, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } });
    script.end = Math.max(script.end, t0 + dur + 0.4);
  }

  // Who covers each base on a play.
  function coverers(fielderPos, theta) {
    const c = {};
    c[1] = fielderPos === '1B' ? 'P' : '1B';
    const second = theta > 0 ? 'SS' : '2B';
    c[2] = fielderPos === second ? (second === 'SS' ? '2B' : 'SS') : second;
    c[3] = fielderPos === '3B' ? 'SS' : '3B';
    if (c[3] === c[2]) c[3] = 'P';
    c[4] = fielderPos === 'C' ? 'P' : 'C';
    return c;
  }

  // ---------------------------------------------------------------------------
  // Main entry point.
  // ctx: {
  //   swing: result of contact() with kind 'inplay',
  //   batter: {idx, name, speed, hand}, bases: [r1, r2, r3] (runner objects or null),
  //   outs, defenseQuality, rng, stealing: base index of a runner already going (or 0)
  // }
  // Returns a play object. If play.tagUp is set, call resolveTagUp(play, send)
  // before reading play.result.
  // ---------------------------------------------------------------------------
  function simulate(ctx) {
    const { swing, batter } = ctx;
    const defense = makeDefense(ctx.defenseQuality || 1);
    const flight = makeFlight(swing.ev, swing.theta, swing.phi);
    const script = newScript();
    script.flight = flight;
    const play = { script, flight, defense, ctx, result: null, tagUp: null };

    // Runners on base, lead runner last in the array.
    const runners = [];
    runners.push({ id: batter.idx, name: batter.name, from: 0, spd: batter.speed || 1, isBatter: true });
    for (let b = 1; b <= 3; b++) {
      const r = ctx.bases[b - 1];
      if (r) runners.push({ id: r.idx, name: r.name, from: b, spd: r.speed || 1, stealing: ctx.stealing === b });
    }

    // Foul ball: only matters if someone catches it.
    if (!flight.fair) {
      if (flight.type === 'ground' || flight.type === 'line') return foul(play);
      const land = flight.pos(flight.hang);
      const lineDist = Math.abs(Math.abs(land.x) - Math.abs(land.y)) * Math.SQRT1_2;
      if (lineDist > 55 || flight.land > 260) return foul(play);
      let best = null;
      for (const pos of POS_ORDER) {
        const f = defense[pos];
        const need = timeToReach(f, f.home, land);
        if (need <= flight.hang && (!best || need < best.need)) best = { pos, need };
      }
      if (!best) return foul(play);
      script.ball.push({ kind: 'batted', t0: 0, t1: flight.hang });
      moveFielder(script, defense, best.pos, land, defense[best.pos].react, flight.hang);
      addEvent(script, flight.hang, 'out', 'OUT', land);
      runnersHold(script, runners, flight.hang);
      play.result = {
        label: 'FOUL OUT', kind: 'out', outs: 1, hit: false, batterBase: 0, scored: [],
        bases: ctx.bases.slice(), rbi: 0,
        desc: `${batter.name} fouls out to ${POS_NAME[best.pos]}.`, fielder: best.pos, ab: true,
      };
      script.end = Math.max(script.end, flight.hang + 1.2);
      return play;
    }

    // Home run.
    if (flight.hr) {
      const wallT = (flight.H * flight.fence) / flight.D;
      // The ball flies all the way into the stands, then disappears.
      script.ball.push({ kind: 'batted', t0: 0, t1: flight.H });
      script.ballHideAt = flight.H + 0.25;
      const nearestOF = ['LF', 'CF', 'RF'].reduce((a, p) =>
        U.dist(defense[p].home, flight.pos(wallT)) < U.dist(defense[a].home, flight.pos(wallT)) ? p : a, 'CF');
      const wallPt = flight.pos(wallT);
      const toWall = { x: wallPt.x * 0.97, y: wallPt.y * 0.97 };
      moveFielder(script, defense, nearestOF, toWall, defense[nearestOF].react);
      addEvent(script, wallT, 'hr', 'HOME RUN!', wallPt);
      const scored = [];
      const trot = 34;
      for (const r of runners) {
        const pts = [];
        let t = r.isBatter ? 0.5 : 0.3;
        pts.push({ t, b: r.from });
        for (let b = r.from + 1; b <= 4; b++) {
          t += 90 / trot;
          pts.push({ t, b });
        }
        script.runners.push(runnerTrack(r, pts, null));
        scored.push(r.id);
        addEvent(script, t, 'score', 'RUN', BASE[4]);
      }
      play.result = {
        label: runners.length === 4 ? 'GRAND SLAM!' : 'HOME RUN!', kind: 'hr', outs: 0, hit: true, batterBase: 4,
        scored, bases: [null, null, null], rbi: scored.length, ab: true,
        desc: `${batter.name} homers to ${zoneName(flight.theta)}` + (scored.length > 1 ? ` (${scored.length} runs).` : '.'),
        hrDist: Math.round(flight.D),
      };
      return play;
    }

    const fielded = fieldBall(flight, defense);
    const fpos = fielded.pos;
    const fielder = defense[fpos];
    play.fielded = fielded;
    script.ball.push({ kind: 'batted', t0: 0, t1: fielded.t });
    moveFielder(script, defense, fpos, fielded.at, fielder.react, fielded.t, fielded.chase > 0);
    // Outfielders not making the play drift over to back it up.
    for (const p of ['LF', 'CF', 'RF']) {
      if (p === fpos) continue;
      const h = defense[p].home;
      const to = { x: U.lerp(h.x, fielded.at.x, 0.35), y: U.lerp(h.y, fielded.at.y, 0.35) };
      moveFielder(script, defense, p, to, defense[p].react + 0.2);
    }
    const cover = coverers(fpos, flight.theta);
    for (let b = 1; b <= 4; b++) {
      const p = cover[b];
      if (p && p !== fpos) moveFielder(script, defense, p, BASE[b], defense[p].react + 0.1);
    }
    play.cover = cover;

    if (fielded.caught) return caughtInAir(play, runners);
    return ballOnGround(play, runners);
  }

  function foul(play) {
    play.result = { label: 'FOUL', kind: 'foul', foul: true };
    return play;
  }

  function zoneName(theta) {
    if (theta < -28) return 'left field';
    if (theta < -12) return 'left-center';
    if (theta <= 12) return 'center field';
    if (theta <= 28) return 'right-center';
    return 'right field';
  }

  // pts: [{t, b}] where b is a base position (may be fractional).
  function runnerTrack(r, pts, outAt) {
    const last = pts[pts.length - 1];
    return {
      id: r.id, name: r.name, isBatter: !!r.isBatter,
      scoredAt: outAt == null && last.b === 4 ? last.t : null,
      path: pts.map((p) => {
        const whole = Math.floor(p.b);
        const pt = pathPoint(whole, p.b - whole);
        return { t: p.t, x: pt.x, y: pt.y };
      }),
      outAt,
    };
  }

  function runnersHold(script, runners, tEnd) {
    for (const r of runners) {
      if (r.isBatter) {
        script.runners.push(runnerTrack(r, [{ t: 0, b: 0 }, { t: 0.9, b: 0.25 }, { t: tEnd, b: 0.3 }], tEnd));
      } else {
        const lead = r.stealing ? 0.45 : 0.12;
        script.runners.push(runnerTrack(r, [{ t: 0, b: r.from + 0.08 }, { t: 0.8, b: r.from + lead }, { t: tEnd + 0.8, b: r.from }], null));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Caught in the air.
  // ---------------------------------------------------------------------------
  function caughtInAir(play, runners) {
    const { script, flight, ctx, fielded } = play;
    const tC = fielded.t;
    const fpos = fielded.pos;
    const outsAfter = ctx.outs + 1;
    addEvent(script, tC, 'out', 'OUT', fielded.at);
    const kindLabel = flight.type === 'line' ? 'LINE OUT' : flight.type === 'pop' || flight.land < 150 ? 'POP OUT' : 'FLY OUT';
    const batter = runners.find((r) => r.isBatter);
    script.runners.push(runnerTrack(batter, [{ t: 0, b: 0 }, { t: tC, b: Math.min(0.8, tC / 4.3) }], tC));

    play.caught = { tC, at: fielded.at, fpos, outsAfter, kindLabel };
    const others = runners.filter((r) => !r.isBatter).sort((a, b) => b.from - a.from);
    play.caught.others = others;
    // Placeholder tracks until the tag-up decision is made.
    for (const r of others) {
      const t = runnerTrack(r, [{ t: 0, b: r.from + 0.08 }, { t: tC * 0.6, b: r.from + 0.2 }, { t: tC, b: r.from }], null);
      t.provisional = true;
      script.runners.push(t);
    }

    // Runners who were stealing (hit-and-run) must get back.
    // Tag-up chance for the lead runner on a ball caught in the outfield.
    const deep = Math.hypot(fielded.at.x, fielded.at.y) > 150;
    const lead = others[0];
    if (outsAfter < 3 && deep && lead && (lead.from === 3 || (lead.from === 2 && !others.some((o) => o.from === 3)))) {
      const target = lead.from + 1;
      const runT = tC + 0.15 + legTime(lead.spd);
      const ballT = tC + play.defense[fpos].transfer + throwTime(fielded.at, BASE[target], play.defense[fpos]);
      play.tagUp = { runner: lead, target, margin: ballT - runT, tC };
    }
    if (!play.tagUp) finishCaught(play, false);
    return play;
  }

  function resolveTagUp(play, send) {
    if (!play.tagUp) return play;
    finishCaught(play, !!send);
    return play;
  }

  function finishCaught(play, send) {
    const { script, ctx, defense } = play;
    const { tC, at, fpos, outsAfter, kindLabel, others } = play.caught;
    script.runners = script.runners.filter((r) => !r.provisional);
    const rng = ctx.rng;
    let outs = 1;
    const bases = ctx.bases.slice();
    const scored = [];
    let label = kindLabel;
    let desc = `${ctx.batter.name} ${kindLabel === 'LINE OUT' ? 'lines out' : kindLabel === 'POP OUT' ? 'pops out' : 'flies out'} to ${POS_NAME[fpos]}.`;
    const f = defense[fpos];
    let throwDone = false;

    for (const r of others) {
      const tag = play.tagUp && send && r === play.tagUp.runner;
      if (r.stealing && !tag) {
        // Hit-and-run runner caught off base: race back.
        const ran = Math.min(85, (tC + 1.0) * RUN_V * r.spd);
        const back = tC + 0.3 + ran / (RUN_V * r.spd);
        const ballT = tC + f.transfer + throwTime(at, BASE[r.from], f) + U.gauss(rng, 0, 0.12);
        const pts = [{ t: 0, b: r.from + 0.15 }, { t: tC, b: r.from + ran / 90 }, { t: back, b: r.from }];
        if (outsAfter + (outs - 1) < 3 && ballT < back && !throwDone) {
          throwBall(script, at, BASE[r.from], tC + f.transfer, ballT - tC - f.transfer);
          throwDone = true;
          outs++;
          bases[r.from - 1] = null;
          addEvent(script, ballT, 'out', 'DOUBLED OFF', BASE[r.from]);
          script.runners.push(runnerTrack(r, pts.slice(0, 2).concat([{ t: ballT, b: r.from + 0.08 }]), ballT));
          label = 'DOUBLE PLAY';
          desc += ` ${r.name} is doubled off.`;
        } else {
          script.runners.push(runnerTrack(r, pts, null));
        }
        continue;
      }
      if (tag) {
        const target = r.from + 1;
        const runT = tC + 0.15 + legTime(r.spd);
        const ballT = tC + f.transfer + throwTime(at, BASE[target], f) + U.gauss(rng, 0, 0.18);
        throwBall(script, at, BASE[target], tC + f.transfer, ballT - tC - f.transfer);
        throwDone = true;
        const safe = runT < ballT + 0.05;
        const pts = [{ t: 0, b: r.from + 0.1 }, { t: tC * 0.6, b: r.from + 0.25 }, { t: tC, b: r.from }];
        bases[r.from - 1] = null;
        if (safe) {
          pts.push({ t: runT, b: target });
          script.runners.push(runnerTrack(r, pts, null));
          if (target === 4) {
            scored.push(r.id);
            addEvent(script, runT, 'score', 'SAFE!', BASE[4]);
            label = 'SAC FLY';
            desc += ` ${r.name} tags and scores.`;
          } else {
            bases[target - 1] = { idx: r.id, name: r.name, speed: r.spd };
            addEvent(script, runT, 'safe', 'SAFE', BASE[target]);
            desc += ` ${r.name} tags and takes ${U.ordinal(target)}.`;
          }
        } else {
          const tOut = Math.max(ballT + 0.05, tC + 0.5);
          pts.push({ t: tOut, b: r.from + 0.92 });
          script.runners.push(runnerTrack(r, pts, tOut));
          outs++;
          addEvent(script, tOut, 'out', 'OUT AT ' + (target === 4 ? 'HOME' : U.ordinal(target).toUpperCase()), BASE[target]);
          label = 'DOUBLE PLAY';
          desc += ` ${r.name} is thrown out ${target === 4 ? 'at the plate' : 'at ' + U.ordinal(target)}.`;
        }
        continue;
      }
      // Holding runners drift off and come back.
      script.runners.push(runnerTrack(r, [{ t: 0, b: r.from + 0.08 }, { t: tC * 0.6, b: r.from + 0.2 }, { t: tC + 0.9, b: r.from }], null));
    }
    if (!throwDone) {
      const cut = BASE[2];
      throwBall(script, at, cut, tC + f.transfer, throwTime(at, cut, f));
    }
    // Sac fly run doesn't count if the double play made the third out before it scored.
    if (ctx.outs + outs >= 3 && scored.length) {
      const ev = script.events.find((e) => e.kind === 'out' && e.text !== 'OUT');
      const scoreEv = script.events.find((e) => e.kind === 'score');
      if (ev && scoreEv && ev.t < scoreEv.t) scored.length = 0;
    }
    play.result = {
      label, kind: 'out', outs, hit: false, batterBase: 0, scored, bases, rbi: label === 'SAC FLY' ? scored.length : 0,
      desc, fielder: fpos, ab: label !== 'SAC FLY', sac: label === 'SAC FLY',
    };
    script.end = Math.max(script.end, tC + 1.4);
    play.tagUp = play.tagUp ? Object.assign(play.tagUp, { resolved: true, sent: !!send }) : null;
    return play;
  }

  // ---------------------------------------------------------------------------
  // Ball on the ground (grounders, and hits that drop in).
  // ---------------------------------------------------------------------------
  function ballOnGround(play, runners) {
    const { script, flight, ctx, defense, fielded, cover } = play;
    const rng = ctx.rng;
    const tF = fielded.t;
    const fpos = fielded.pos;
    const f = defense[fpos];
    const at = fielded.at;
    const infield = !OUTFIELD[fpos];
    const grounder = flight.type === 'ground';
    const transfer = f.transfer + (fielded.dive ? 0.35 : 0) + (fielded.ranged ? 0.1 : 0) + (OUTFIELD[fpos] ? 0.45 : 0);
    const twoOuts = ctx.outs === 2;

    // Expected time the ball can reach each base.
    const ballAt = {};
    for (let b = 1; b <= 4; b++) ballAt[b] = tF + transfer + throwTime(at, BASE[b], f);

    // Runner starts: forced runners and two-out runners go right away.
    const occupied = { 1: !!ctx.bases[0], 2: !!ctx.bases[1], 3: !!ctx.bases[2] };
    const forced = (from) => {
      if (from === 0) return true;
      for (let b = 1; b <= from; b++) if (!occupied[b] && b !== from) return false;
      return occupied[from] && (from === 1 || (occupied[1] && (from === 2 || occupied[2])));
    };

    const plans = [];
    let aheadLimit = 4; // runners can't pass the runner ahead
    const sorted = runners.slice().sort((a, b) => b.from - a.from);
    for (const r of sorted) {
      const isForced = r.isBatter || forced(r.from);
      let start;
      let lead = 0;
      if (r.isBatter) start = 0;
      else if (r.stealing) { start = -1.0; lead = 12; }
      else if (twoOuts) { start = 0.1; lead = 12; }
      else if (grounder && isForced) { start = 0.3; lead = 10; }
      else if (grounder) { start = 0.35; lead = 10; }
      else { start = Math.max(0.3, Math.min(tF, flight.hang || 0) - 0.4); lead = 22; }
      const arr = arrivals(r.from, r.spd, start, lead);
      const minBase = isForced ? r.from + 1 : r.from;
      // Aggressiveness margin: runners need this much daylight to try for a base.
      let target = minBase;
      for (let b = r.from + 1; b <= Math.min(4, aheadLimit); b++) {
        if (b <= minBase) continue;
        if (arr[b] + PHYS.need < ballAt[b]) target = b;
        else break;
      }
      if (target > aheadLimit) target = aheadLimit;
      // A runner can only stay put if the runner behind isn't forcing them.
      plans.push({ r, arr, start, lead, target, forced: isForced, minBase });
      aheadLimit = target === 4 ? 4 : target - 1;
      if (aheadLimit < r.from && !isForced) aheadLimit = r.from;
    }
    // Make sure trailing runners never end on the same base as someone ahead.
    for (let i = 1; i < plans.length; i++) {
      const ahead = plans[i - 1];
      const me = plans[i];
      if (ahead.target !== 4 && me.target >= ahead.target) me.target = Math.max(me.r.from, ahead.target - 1);
    }

    // The defense looks for an out, lead runner first.
    const jeopardy = [];
    for (const p of plans) {
      if (p.target === p.r.from) continue; // holding
      const tArr = p.arr[p.target];
      const tBall = ballAt[p.target];
      jeopardy.push({ p, base: p.target, margin: tArr - tBall });
    }
    jeopardy.sort((a, b) => b.margin - a.margin || b.base - a.base);
    // Prefer the lead runner when there's a real play on them.
    let throwTo = null;
    const playable = jeopardy.filter((j) => j.margin > -0.25);
    if (playable.length) {
      playable.sort((a, b) => (b.margin > 0) - (a.margin > 0) || b.base - a.base);
      throwTo = playable[0];
      if (throwTo.margin < 0.3 && infield && grounder) {
        // No chance at the lead runner. Take the sure out at first if there is one.
        const atFirst = playable.find((j) => j.base === 1 && j.margin > 0);
        if (atFirst) throwTo = atFirst;
      }
    }

    let outs = 0;
    const outEvents = [];
    const scoredTimes = [];
    let forceThird = false;
    const noise = U.gauss(rng, 0, infield ? 0.1 : 0.16);
    let throwArrive = null;
    if (throwTo) {
      const b = throwTo.base;
      throwArrive = ballAt[b] + noise;
      throwBall(script, at, BASE[b], tF + transfer, throwArrive - tF - transfer);
    } else {
      // No play: get the ball back to the infield.
      const lead = plans.filter((p) => p.target < 4).sort((a, b) => b.target - a.target)[0];
      const b = lead ? Math.max(2, lead.target) : 2;
      throwBall(script, at, BASE[b], tF + transfer, throwTime(at, BASE[b], f));
    }

    const outcome = new Map();
    for (const p of plans) {
      let out = false;
      let tOut = null;
      if (throwTo && throwTo.p === p) {
        const tagNeeded = !p.forced || p.target > p.minBase ? 0.12 : 0;
        if (p.arr[p.target] > throwArrive + tagNeeded) {
          out = true;
          tOut = Math.max(throwArrive + tagNeeded, 0.2);
        }
      }
      outcome.set(p, { out, tOut });
      if (out) {
        outs++;
        outEvents.push({ t: tOut, base: p.target, forced: p.forced && p.target === p.minBase });
        if (ctx.outs + outs === 3 && p.forced && p.target === p.minBase) forceThird = true;
      }
    }

    // Double play: force at a base, then relay to first for the batter.
    let dp = false;
    if (throwTo && outcome.get(throwTo.p).out && throwTo.base !== 1 && grounder && infield && ctx.outs + outs < 3) {
      const batterPlan = plans.find((p) => p.r.isBatter);
      if (throwTo.p.forced && batterPlan && batterPlan.target === 1) {
        const pivot = defense[cover[throwTo.base]] || f;
        const relay = throwArrive + 0.9 + throwTime(BASE[throwTo.base], BASE[1], pivot) + U.gauss(rng, 0, 0.15);
        throwBall(script, BASE[throwTo.base], BASE[1], throwArrive + 0.9, relay - throwArrive - 0.9);
        if (batterPlan.arr[1] > relay) {
          outcome.set(batterPlan, { out: true, tOut: relay });
          outs++;
          dp = true;
          outEvents.push({ t: relay, base: 1, forced: true });
          if (ctx.outs + outs === 3) forceThird = true;
        }
      }
    }

    // Build runner tracks and the final base state.
    const bases = [null, null, null];
    const scored = [];
    const thirdOutT = ctx.outs + outs >= 3 ? Math.max(...outEvents.map((e) => e.t)) : Infinity;
    for (const p of plans) {
      const o = outcome.get(p);
      const pts = [];
      const r = p.r;
      if (r.isBatter) pts.push({ t: 0, b: 0 });
      else pts.push({ t: Math.max(0, Math.min(0.1, p.start)), b: r.from + (p.start < 0 ? 0.35 : 0.08) });
      if (o.out) {
        // Runs up to the base and is out there.
        const tEnd = o.tOut;
        let lastT = pts[0].t;
        for (let b = r.from + 1; b < p.target; b++) {
          if (p.arr[b] < tEnd) { pts.push({ t: p.arr[b], b }); lastT = p.arr[b]; }
        }
        const prevB = pts[pts.length - 1].b;
        const legT = p.arr[p.target] - lastT;
        const frac = U.clamp((tEnd - lastT) / Math.max(0.1, legT), 0, 0.97);
        pts.push({ t: tEnd, b: Math.floor(prevB) + Math.min(0.97, (p.target - Math.floor(prevB)) * frac) });
        script.runners.push(runnerTrack(r, pts, tEnd));
        addEvent(script, tEnd, 'out', 'OUT', BASE[p.target]);
        continue;
      }
      if (p.target === r.from) {
        script.runners.push(runnerTrack(r, [pts[0], { t: 0.9, b: r.from + 0.18 }, { t: 1.8, b: r.from }], null));
        bases[r.from - 1] = { idx: r.id, name: r.name, speed: r.spd };
        continue;
      }
      for (let b = r.from + 1; b <= p.target; b++) pts.push({ t: p.arr[b], b });
      script.runners.push(runnerTrack(r, pts, null));
      if (p.target === 4) {
        const t = p.arr[4];
        if (!(forceThird || t > thirdOutT)) {
          scored.push(r.id);
          scoredTimes.push(t);
          addEvent(script, t, 'score', 'RUN', BASE[4]);
        }
      } else if (ctx.outs + outs < 3) {
        bases[p.target - 1] = { idx: r.id, name: r.name, speed: r.spd };
        if (throwTo && throwTo.p === p) addEvent(script, p.arr[p.target], 'safe', 'SAFE', BASE[p.target]);
      }
    }
    if (ctx.outs + outs >= 3) {
      bases[0] = bases[1] = bases[2] = null;
    }

    // Describe it.
    const batterPlan = plans.find((p) => p.r.isBatter);
    const batterOut = outcome.get(batterPlan).out;
    const bb = batterOut ? 0 : batterPlan.target;
    const leadOut = plans.find((p) => outcome.get(p).out && !p.r.isBatter);
    let label;
    let kind;
    let hit = false;
    const where = infield ? POS_NAME[fpos] : zoneName(flight.theta);
    const name = ctx.batter.name;
    let desc;
    if (dp) {
      label = 'DOUBLE PLAY';
      kind = 'out';
      desc = `${name} grounds into a double play.`;
    } else if (batterOut) {
      label = infield ? 'GROUND OUT' : 'THROWN OUT';
      kind = 'out';
      desc = `${name} grounds out to ${where}.`;
      if (!infield) desc = `${name} is thrown out trying for ${U.ordinal(batterPlan.target)}.`;
    } else if (leadOut && leadOut.forced && leadOut.target === leadOut.minBase) {
      label = "FIELDER'S CHOICE";
      kind = 'fc';
      desc = `${name} reaches on a fielder's choice. ${leadOut.r.name} is out at ${leadOut.target === 4 ? 'home' : U.ordinal(leadOut.target)}.`;
    } else {
      hit = true;
      kind = ['', 'single', 'double', 'triple', 'hr'][bb];
      label = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'INSIDE-THE-PARK HR!'][bb];
      if (bb === 1 && infield) label = 'INFIELD HIT';
      const verb = ['', 'singles', 'doubles', 'triples', 'circles the bases'][bb];
      desc = `${name} ${verb} ${bb === 4 ? 'for an inside-the-park home run' : 'to ' + where}.`;
      if (leadOut) desc += ` ${leadOut.r.name} is thrown out at ${leadOut.target === 4 ? 'the plate' : U.ordinal(leadOut.target)}.`;
    }
    if (scored.length && !dp) {
      const names = plans.filter((p) => scored.includes(p.r.id) && !p.r.isBatter).map((p) => p.r.name);
      if (names.length) desc += ` ${names.join(', ')} ${names.length > 1 ? 'score' : 'scores'}.`;
    }
    const rbi = dp ? 0 : scored.length;
    if (!batterOut && bb >= 1 && bb <= 3) addEvent(script, batterPlan.arr[bb], 'safe', label, BASE[bb]);
    script.end = Math.max(script.end, ...plans.map((p) => (outcome.get(p).out ? 0 : p.arr[p.target] || 0)), tF + 1) + 0.3;
    play.result = {
      label, kind, outs, hit, batterBase: bb, scored, bases, rbi, desc, fielder: fpos, ab: true, dp,
    };
    return play;
  }

  // ---------------------------------------------------------------------------
  // Steal attempt resolution (pitch not put in play).
  // ---------------------------------------------------------------------------
  function stealResult(runner, base, pitchKey, catcherPenalty, rng) {
    const delivery = 1.35 + (pitchKey === 'fb' ? 0 : 0.1);
    const pop = (base === 2 ? 1.98 : 1.82) + (catcherPenalty || 0);
    const ballT = delivery + pop + U.gauss(rng, 0, 0.13);
    const runT = (base === 2 ? 3.35 : 3.42) / (runner.speed || 1) + U.gauss(rng, 0, 0.08);
    return { safe: runT < ballT, margin: ballT - runT };
  }

  BB.sim = {
    BASE, FIELDER_HOME, POS_ORDER, PHYS, fenceDist, contact, makeFlight, simulate, resolveTagUp, stealResult, zoneName,
    makeDefense,
  };
})(typeof window !== 'undefined' ? window : globalThis);
