// Presentation: player reactions, the follow cam in the field view, replays
// of big moments, and big-game dressing (postseason / All-Star).
// Owned by the animation agent. See ARCHITECTURE.md.
//
// main.js calls into this module at a few marked points ("// fx:"):
//   BB.fx.update(S, dt)               every frame (game time; not while paused)
//   BB.fx.drawOverlay(ctx, S)         after the frame is rendered
//   BB.fx.atPlate(S)                  batter to draw (stays during his reaction)
//   BB.fx.onContact(S, play) -> sec   extra hold before cutting to the field view
//   BB.fx.onPitchResult(S, ev)        strikeout / walk reactions
//   BB.fx.onPlayEnd(S, play, ev, done) may show a replay, then calls done()
//   BB.fx.onGameOver(S, ev) -> sec    celebration; extra time for the final banner
// The renderers read BB.fx.big (dress the park), BB.fx.flashes (camera
// flashes in the stands) and BB.fieldView.cam (the follow cam).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;
  const fx = (BB.fx = BB.fx || {});
  fx.big = false;
  fx.flashes = 0;

  const F = {
    game: null, // game these states belong to
    timers: [],
    shown: null, // batter object drawn at the plate
    shownKey: '',
    lastView: 'bat',
    pendingPitcher: null, // reaction to play when the view returns to the batter
    replay: null,
    vel: { x: 0, y: 0, z: 0 },
    lastPlay: null,
    lastPlayT: 0,
    excite: 0, // crowd flashes
    champs: 0, // seconds left of the champions celebration
    els: null,
    log: [], // replay kinds shown (for tests)
  };

  function after(sec, fn) {
    F.timers.push({ t: sec, fn });
  }
  function runTimers(dt) {
    if (!F.timers.length) return;
    const due = [];
    for (const tm of F.timers) {
      tm.t -= dt;
      if (tm.t <= 0) due.push(tm);
    }
    if (due.length) {
      F.timers = F.timers.filter((tm) => tm.t > 0);
      due.forEach((tm) => tm.fn());
    }
  }
  const audio = () => BB.audio || {};
  function replaysOn() {
    try {
      return !BB.store || BB.store.settings().replays !== false;
    } catch (e) {
      return true;
    }
  }
  function isBig(g) {
    const t = g && g.meta && g.meta.type;
    return t === 'post' || t === 'allstar';
  }

  // ---------------------------------------------------------------------------
  // DOM: game label, replay badge, champions banner (inside #hud).
  // ---------------------------------------------------------------------------
  function els() {
    if (F.els) return F.els;
    if (typeof document === 'undefined') return null;
    const hud = document.getElementById('hud');
    if (!hud) return null;
    const mk = (cls, html) => {
      const d = document.createElement('div');
      d.className = cls;
      d.hidden = true;
      if (html) d.innerHTML = html;
      hud.appendChild(d);
      return d;
    };
    F.els = {
      label: mk('fx-label'),
      replay: mk('fx-replay', '<b>REPLAY</b><span>Tap to skip</span>'),
      champs: mk('fx-champs', '<div class="fx-champs-main">CHAMPIONS</div><div class="fx-champs-sub"></div>'),
    };
    return F.els;
  }

  // ---------------------------------------------------------------------------
  // Particles: fireworks and confetti in screen space (pooled, no per-frame
  // allocation).
  // ---------------------------------------------------------------------------
  const MAXP = 700;
  const P = {
    n: 0,
    x: new Float32Array(MAXP), y: new Float32Array(MAXP),
    vx: new Float32Array(MAXP), vy: new Float32Array(MAXP),
    life: new Float32Array(MAXP), max: new Float32Array(MAXP),
    rot: new Float32Array(MAXP), vr: new Float32Array(MAXP),
    kind: new Uint8Array(MAXP), // 1 shell, 2 spark, 3 confetti
    col: new Array(MAXP),
  };
  const SPARK = ['#ffe066', '#ff6b57', '#7ee2a8', '#8fd3ff', '#ffffff', '#f2c94c', '#ff8ad8'];
  const CONF = ['#f2c94c', '#ffffff', '#d64541', '#2f9bd9', '#7ee2a8', '#ff8ad8'];
  function spawn(kind, x, y, vx, vy, life, col) {
    if (P.n >= MAXP) return -1;
    const i = P.n++;
    P.kind[i] = kind;
    P.x[i] = x;
    P.y[i] = y;
    P.vx[i] = vx;
    P.vy[i] = vy;
    P.life[i] = life;
    P.max[i] = life;
    P.rot[i] = Math.random() * 6.28;
    P.vr[i] = (Math.random() - 0.5) * 12;
    P.col[i] = col;
    return i;
  }
  function kill(i) {
    const j = --P.n;
    if (i === j) return;
    P.kind[i] = P.kind[j];
    P.x[i] = P.x[j];
    P.y[i] = P.y[j];
    P.vx[i] = P.vx[j];
    P.vy[i] = P.vy[j];
    P.life[i] = P.life[j];
    P.max[i] = P.max[j];
    P.rot[i] = P.rot[j];
    P.vr[i] = P.vr[j];
    P.col[i] = P.col[j];
  }
  let VW = 800;
  let VH = 600;
  // A volley of fireworks over the top part of the screen.
  function fireworks(n, spread) {
    for (let k = 0; k < n; k++) {
      const x = VW * (0.15 + Math.random() * 0.7);
      const tgt = VH * (0.08 + Math.random() * 0.22);
      const vy = -Math.sqrt(2 * 900 * Math.max(40, VH * 0.75 - tgt));
      const i = spawn(1, x, VH * 0.75, (Math.random() - 0.5) * 60, vy, 3, SPARK[(Math.random() * SPARK.length) | 0]);
      if (i >= 0) P.rot[i] = k * (spread || 0.35) + Math.random() * 0.15; // shells use rot as the launch delay
    }
  }
  function burst(x, y, col) {
    const n = 46;
    const sp = 170 + Math.random() * 90;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.1;
      const v = sp * (0.55 + Math.random() * 0.45);
      spawn(2, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.9 + Math.random() * 0.6, Math.random() < 0.25 ? '#ffffff' : col);
    }
    const A = audio();
    if (A.crack) A.crack(0.15);
  }
  function confetti(n) {
    for (let k = 0; k < n; k++) {
      spawn(3, Math.random() * VW, -20 - Math.random() * VH * 0.6, (Math.random() - 0.5) * 60, 60 + Math.random() * 80, 7 + Math.random() * 3, CONF[(Math.random() * CONF.length) | 0]);
    }
  }
  function stepParticles(dt) {
    for (let i = P.n - 1; i >= 0; i--) {
      const kd = P.kind[i];
      if (kd === 1) {
        if (P.rot[i] > 0) {
          P.rot[i] -= dt; // waiting to launch
          continue;
        }
        P.vy[i] += 900 * dt;
        P.x[i] += P.vx[i] * dt;
        P.y[i] += P.vy[i] * dt;
        if (P.vy[i] > -40) {
          const x = P.x[i];
          const y = P.y[i];
          const c = P.col[i];
          kill(i);
          burst(x, y, c);
        }
        continue;
      }
      P.life[i] -= dt;
      if (P.life[i] <= 0) {
        kill(i);
        continue;
      }
      if (kd === 2) {
        P.vx[i] *= 1 - 1.6 * dt;
        P.vy[i] = P.vy[i] * (1 - 1.6 * dt) + 140 * dt;
      } else {
        // Confetti flutters down.
        P.vx[i] += Math.sin(P.life[i] * 3 + i) * 40 * dt;
        P.vy[i] += (70 - P.vy[i]) * 1.5 * dt;
        P.rot[i] += P.vr[i] * dt;
        if (P.y[i] > VH + 20) {
          kill(i);
          continue;
        }
      }
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
    }
  }
  function drawParticles(ctx) {
    for (let i = 0; i < P.n; i++) {
      const kd = P.kind[i];
      if (kd === 1) {
        if (P.rot[i] > 0) continue;
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(P.x[i] - 1.5, P.y[i] - 3, 3, 6);
        continue;
      }
      const a = U.clamp(P.life[i] / P.max[i], 0, 1);
      if (kd === 2) {
        ctx.globalAlpha = a;
        ctx.fillStyle = P.col[i];
        const s = 1.5 + a * 2;
        ctx.fillRect(P.x[i] - s / 2, P.y[i] - s / 2, s, s);
      } else {
        ctx.globalAlpha = Math.min(1, P.life[i]);
        ctx.fillStyle = P.col[i];
        const c = Math.cos(P.rot[i]) * DPR;
        const sn = Math.sin(P.rot[i]) * DPR;
        const f = Math.cos(P.rot[i] * 1.7); // flipping paper
        ctx.setTransform(c, sn, -sn * f, c * f, P.x[i] * DPR, P.y[i] * DPR);
        ctx.fillRect(-4, -2.5, 8, 5);
      }
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  let DPR = 1;

  // ---------------------------------------------------------------------------
  // Follow cam (field view). Frames the ball, where a fly ball will come down,
  // the fielder making the play, the throw's target and the runners still
  // moving; zooms out for deep flies and in for infield plays. Smoothed with a
  // critically damped spring so it never jitters.
  // ---------------------------------------------------------------------------
  // Critically damped spring step (Game Programming Gems 4 "SmoothDamp").
  function damp(cur, target, velObj, key, smoothTime, dt) {
    const omega = 2 / Math.max(0.05, smoothTime);
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = cur - target;
    const temp = (velObj[key] + omega * change) * dt;
    velObj[key] = (velObj[key] - omega * temp) * e;
    return target + (change + temp) * e;
  }

  const box = { x0: 0, y0: 0, x1: 0, y1: 0, n: 0 };
  function add(x, y) {
    if (!box.n) {
      box.x0 = box.x1 = x;
      box.y0 = box.y1 = y;
    } else {
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y;
      if (y > box.y1) box.y1 = y;
    }
    box.n++;
  }

  // Interest points for a play at time t. tight: replay framing (only the
  // ball and the players in the key action).
  function frame(play, t, tight, key, kind) {
    const fv = BB.fieldView;
    const script = play.script;
    box.n = 0;
    const cel = script.celebrate && script.celebrate.on ? script.celebrate : null;
    if (cel) {
      add(cel.cx - 30, cel.cy - 25);
      add(cel.cx + 30, cel.cy + 25);
      return;
    }
    const b = fv.ballAt(script, t);
    const hidden = script.ballHideAt != null && t > script.ballHideAt;
    if (!hidden) add(b.x, b.y);
    const first = script.ball[0];
    if (first && first.kind === 'batted' && t < first.t1 && script.flight) {
      // Lead a ball in the air: include where it comes down.
      const land = script.flight.pos(first.t1);
      if (!tight || first.t1 - t < 1.6) add(land.x, land.y);
    }
    if (b.seg && b.seg.kind === 'throw' && t < b.seg.t1 + 0.2) add(b.seg.to.x, b.seg.to.y);
    if (play.fielded) {
      const fp = script.fielders[play.fielded.pos];
      if (fp && (!tight || Math.abs(t - play.fielded.t) < 1.2)) {
        const p = fv.interp(fp.path, t);
        add(p.x, p.y);
      }
    }
    for (const r of script.runners) {
      if (!r.path.length) continue;
      if (r.outAt != null && t > r.outAt + 0.5) continue;
      if (r.scoredAt != null && t > r.scoredAt + 0.3) continue;
      const p = fv.interp(r.path, t);
      const q = fv.interp(r.path, t + 0.5);
      const moving = Math.abs(p.x - q.x) + Math.abs(p.y - q.y) > 0.5;
      const near = key != null && Math.abs(t - key) < 1.0;
      // Home run replays stay on the ball until it is gone.
      if (moving && (!tight || (near && kind !== 'hr') || hidden)) add(p.x, p.y);
    }
    if (!box.n) add(0, 60);
  }

  function camTarget(out, tight, zoomMul) {
    const fv = BB.fieldView;
    const v = fv.view;
    const minSize = tight ? 95 : 150;
    const pad = tight ? 1.25 : 1.35;
    const bw = Math.max(minSize, (box.x1 - box.x0) * pad + 30);
    const bh = Math.max(minSize, (box.y1 - box.y0) * pad + 30);
    const zMax = fv.maxZoom() * (tight ? 1.15 : 1);
    let z = Math.min(v.W / (v.k * bw), v.availH / (v.k * bh)) * (zoomMul || 1);
    z = U.clamp(z, 1, zMax);
    let x = (box.x0 + box.x1) / 2;
    let y = (box.y0 + box.y1) / 2;
    // Keep the view over the ballpark.
    const wv = v.W / (v.k * z);
    const hv = v.availH / (v.k * z);
    x = wv >= 590 ? 0 : U.clamp(x, -295 + wv / 2, 295 - wv / 2);
    y = hv >= 495 ? fv.HOME_CAM.y : U.clamp(y, -50 + hv / 2, 445 - hv / 2);
    out.x = x;
    out.y = y;
    out.z = z;
    return out;
  }

  const tgt = { x: 0, y: 205, z: 1 };
  function resetCam() {
    const cam = BB.fieldView.cam;
    const h = BB.fieldView.HOME_CAM;
    cam.x = h.x;
    cam.y = h.y;
    cam.z = h.z;
    cam.moving = false;
    F.vel.x = F.vel.y = F.vel.z = 0;
  }
  function updateCam(S, dt) {
    const fv = BB.fieldView;
    if (!fv || !fv.cam) return;
    const cam = fv.cam;
    if (S.view !== 'field' || !S.play) {
      if (cam.z !== 1 || cam.x !== 0) resetCam();
      return;
    }
    const R = F.replay;
    if (R) {
      frame(S.play, S.playT, true, R.seg.key, R.seg.kind);
      camTarget(tgt, true, 1.15 + 0.15 * U.clamp((S.playT - R.seg.t0) / (R.seg.t1 - R.seg.t0 + 1e-6), 0, 1));
    } else {
      frame(S.play, S.playT, false, null);
      camTarget(tgt, false, 1);
    }
    // Faster settling when the play is sped up or replayed.
    const speed = R ? 1.6 : U.clamp(S.playSpeed || 1, 1, 3);
    const st = (R ? 0.32 : 0.55) / speed;
    cam.x = damp(cam.x, tgt.x, F.vel, 'x', st, dt);
    cam.y = damp(cam.y, tgt.y, F.vel, 'y', st, dt);
    const lz = damp(Math.log(cam.z), Math.log(tgt.z), F.vel, 'z', st * 1.15, dt);
    cam.z = Math.exp(lz);
    cam.moving = Math.abs(F.vel.z) > 0.03 || Math.abs(F.vel.x) + Math.abs(F.vel.y) > 6;
  }

  // ---------------------------------------------------------------------------
  // Replays: which plays get one, and the part of the play to show.
  // ---------------------------------------------------------------------------
  function near(p, q, d) {
    return Math.abs(p.x - q.x) < d && Math.abs(p.y - q.y) < d;
  }
  const HOME = { x: 0, y: 0 };
  // A highlight-reel dive: a long-range dive that still gets an out, or a
  // catch in the air made at the last possible moment after a long run.
  function bigDive(play) {
    const f = play.fielded;
    if (!f || !play.result) return false;
    const home = BB.sim.FIELDER_HOME[f.pos];
    const d = home ? U.dist(home, f.at) : 0;
    if (f.dive) return d > 27 && play.result.outs > 0;
    return !!f.caught && f.need != null && f.t - f.need < 0.07 && d > 38;
  }
  function replaySegment(play, ev) {
    const sc = play.script;
    const r = play.result || {};
    const end = sc.end;
    if (r.kind === 'hr') {
      const e = sc.events.find((x) => x.kind === 'hr');
      const key = e ? e.t : sc.ball[0] ? sc.ball[0].t1 * 0.85 : 2;
      const t1 = Math.min(sc.ballHideAt != null ? sc.ballHideAt + 0.35 : key + 0.8, key + 0.9);
      return { kind: 'hr', key, t0: Math.max(0, key - 2.3), t1 };
    }
    // Play at the plate: a throw home that arrives with a runner.
    for (const s of sc.ball) {
      if (s.kind !== 'throw' || !near(s.to, HOME, 3)) continue;
      // Close: the runner and the ball get there within a moment of each other.
      const e = sc.events.find((x) => (x.kind === 'out' || x.kind === 'score') && near(x, HOME, 4) && Math.abs(x.t - s.t1) < 0.45);
      if (e) return { kind: 'plate', key: s.t1, t0: Math.max(0, s.t0 - 0.9), t1: Math.min(end, Math.max(s.t1, e.t) + 0.7) };
    }
    if (bigDive(play)) {
      const key = play.fielded.t;
      return { kind: 'dive', key, t0: Math.max(0, key - 1.1), t1: Math.min(end, key + 0.9) };
    }
    if (r.dp || r.label === 'DOUBLE PLAY') {
      const outs = sc.events.filter((x) => x.kind === 'out').map((x) => x.t).sort((a, b) => a - b);
      if (outs.length) return { kind: 'dp', key: outs[0], t0: Math.max(0, outs[0] - 1.0), t1: Math.min(end, outs[outs.length - 1] + 0.5) };
    }
    if (ev && ev.gameOver) {
      const evs = sc.events.filter((x) => x.kind === 'out' || x.kind === 'score' || x.kind === 'safe');
      const key = evs.length ? evs[evs.length - 1].t : end - 0.5;
      return { kind: 'final', key, t0: Math.max(0, key - 2.0), t1: Math.min(end, key + 0.6) };
    }
    return null;
  }
  // Replay speed in game seconds per real second: brisk lead-in, slow motion
  // around the key moment.
  function replaySpeed(R, t) {
    const d = (t - R.seg.key) / 0.55;
    return 1.6 - 1.2 * Math.exp(-d * d);
  }

  // ---------------------------------------------------------------------------
  // Replay runner, with a TV-style wipe in and out.
  // ---------------------------------------------------------------------------
  function wipe(dur, mid) {
    F.wipe = { w: 0, dur, mid };
  }
  function stepWipe(dt) {
    const w = F.wipe;
    w.w += dt / w.dur;
    if (w.w >= 0.5 && w.mid) {
      const m = w.mid;
      w.mid = null;
      m();
    }
    if (w.w >= 1 && F.wipe === w) F.wipe = null;
  }
  function badge(on) {
    const e = els();
    if (e) e.replay.hidden = !on;
  }
  function startReplay(S, play, ev, seg, done) {
    const R = { play, ev, seg, done, phase: 'wait', skip: false };
    F.log.push(seg.kind);
    F.replay = R;
    S.phase = 'replay';
    wipe(0.42, () => {
      if (R.skip) return endReplay(S, R, true);
      S.view = 'field';
      S.playT = seg.t0;
      // Start the replay camera on its framing instead of panning to it.
      frame(play, seg.t0, true, seg.key, seg.kind);
      camTarget(tgt, true, 1.15);
      const cam = BB.fieldView.cam;
      cam.x = tgt.x;
      cam.y = tgt.y;
      cam.z = tgt.z;
      F.vel.x = F.vel.y = F.vel.z = 0;
      R.phase = 'run';
      badge(true);
    });
  }
  function stepReplay(S, dt) {
    const R = F.replay;
    if (R.skip) return endReplay(S, R, false);
    S.playT = Math.min(R.seg.t1, S.playT + dt * replaySpeed(R, S.playT));
    if (S.playT >= R.seg.t1) endReplay(S, R, false);
  }
  function endReplay(S, R, now) {
    if (R.phase === 'end') return;
    R.phase = 'end';
    const finish = () => {
      badge(false);
      if (F.replay === R) F.replay = null;
      S.playT = R.play.script.end + 1.5;
      S.phase = 'playresult';
      R.done();
    };
    if (now) finish();
    else wipe(R.skip ? 0.26 : 0.42, finish);
  }

  // ---------------------------------------------------------------------------
  // Celebrations (field view) and the champions finale.
  // ---------------------------------------------------------------------------
  function startCelebration(S, ev) {
    const G = BB.game;
    const gm = S.g;
    const battingWon = gm.winner === gm.half;
    const team = battingWon ? 'bat' : 'field';
    const color = battingWon ? G.battingTeam(gm).color : G.fieldingTeam(gm).color;
    const dugoutX = gm.winner === 1 ? 84 : -84; // home dugout on the first-base side
    const cx = 0;
    const cy = battingWon ? 3 : 57; // home plate for a walk-off, the mound otherwise
    let play = F.lastPlay && F.lastEv === ev ? F.lastPlay : null;
    if (!play) play = { script: { ball: [], fielders: {}, runners: [], events: [], end: 0, ballHideAt: -1 }, synthetic: true };
    const sc = play.script;
    const t = play.synthetic ? 0 : sc.end + 1.5;
    const fv = BB.fieldView;
    const list = [];
    const member = (x, y, delay) => list.push({ x0: x, y0: y, delay: delay || Math.random() * 0.25 });
    if (team === 'field') {
      for (const pos of BB.sim.POS_ORDER) {
        const fp = sc.fielders[pos];
        const p = fp ? fv.interp(fp.path, t) : BB.sim.FIELDER_HOME[pos];
        member(p.x, p.y);
      }
    } else {
      for (const r of sc.runners) if (r.path.length) member(fv.interp(r.path, t).x, fv.interp(r.path, t).y);
    }
    while (list.length < 14) member(dugoutX + (Math.random() - 0.5) * 34, -16 + (Math.random() - 0.5) * 18, 0.25 + Math.random() * 0.6);
    list.forEach((m, i) => {
      const a = (i / list.length) * Math.PI * 2 + Math.random() * 0.4;
      const r = i === 0 ? 1 : 4 + Math.random() * 8;
      m.x1 = cx + Math.cos(a) * r;
      m.y1 = cy + Math.sin(a) * r * 0.85;
      m.t0 = m.delay;
      m.dur = Math.max(0.35, Math.hypot(m.x1 - m.x0, m.y1 - m.y0) / 26);
      m.ph = Math.random() * 6.28;
    });
    sc.celebrate = { on: true, t: 0, team, color, cx, cy, list };
    S.view = 'field';
    S.play = play;
    S.playT = t;
  }

  function champions(S) {
    const gm = S.g;
    const me = gm.teams[gm.playerIdx];
    F.champs = 5.5;
    confetti(170);
    fireworks(8, 0.4);
    const e = els();
    if (e) {
      e.champs.querySelector('.fx-champs-sub').textContent = me.name || '';
      e.champs.style.setProperty('--team', me.color || '#f2c94c');
      e.champs.hidden = false;
      void e.champs.offsetWidth;
      e.champs.classList.add('show');
    }
    const A = audio();
    if (A.organ) A.organ();
    if (A.charge) setTimeout(() => A.charge(), 900);
  }

  // ---------------------------------------------------------------------------
  // Hooks called from main.js
  // ---------------------------------------------------------------------------
  // The batter drawn at the plate: whoever is in the box until the next
  // batter walks in, so reactions are drawn with the right number and side.
  fx.atPlate = function (S) {
    return S.g && F.game === S.g && F.shown ? F.shown : null;
  };

  // Ball in play. Returns extra seconds to stay on the batter (home runs).
  fx.onContact = function (S, play) {
    resetCam();
    F.lastPlay = null;
    if (bigDive(play)) play.script.dive = { pos: play.fielded.pos, t: play.fielded.t };
    if (!(play.result && play.result.kind === 'hr' && play.flight && play.flight.hr)) return 0;
    const dir = F.shown && F.shown.hand === 'L' ? -1 : 1;
    after(0.28, () => S.batterRig.play('hr', 0.22, { dir }));
    after(0.34, () => S.pitcherRig.play('watch', 0.3));
    F.pendingPitcher = 'frustrate';
    if (fx.big) {
      F.excite = 1;
      const A = audio();
      if (A.cheer) A.cheer(0.9);
    }
    return 1.15;
  };

  // Pitch result that didn't put the ball in play.
  fx.onPitchResult = function (S, ev) {
    const gm = S.g;
    if (!gm || !ev) return;
    const A = audio();
    if (ev.type === 'strikeout') {
      const looking = !!(S.pitch && !S.pitch.swung);
      after(looking ? 0.2 : 0.3, () => S.batterRig.play('kWalk', 0.35, { looking }));
      const risp = gm.bases[1] || gm.bases[2];
      if (ev.gameOver || ev.halfOver || risp) after(0.18, () => S.pitcherRig.play('pump', 0.22, { final: !!ev.gameOver }));
      if (fx.big) {
        F.excite = Math.max(F.excite, 0.7);
        if (A.cheer) A.cheer(ev.halfOver ? 0.8 : 0.5);
      }
    } else if (ev.type === 'walk') {
      if (ev.runs || Math.random() < 0.7) after(0.45, () => S.pitcherRig.play('frustrate', 0.35));
      if (fx.big && A.cheer) A.cheer(0.4);
    }
  };

  // The play is over and its banner has shown: maybe replay it, then done().
  fx.onPlayEnd = function (S, play, ev, done) {
    F.lastPlay = play;
    F.lastEv = ev;
    const seg = replaysOn() ? replaySegment(play, ev) : null;
    if (!seg || seg.t1 - seg.t0 < 0.3) {
      done();
      return;
    }
    startReplay(S, play, ev, seg, done);
  };

  // The game just ended. Returns extra seconds for the final banner.
  fx.onGameOver = function (S, ev) {
    const gm = S.g;
    if (!gm) return 0;
    let extra = 0;
    if (gm.winner != null) {
      startCelebration(S, ev);
      extra = 0.9;
    }
    const userWon = gm.winner === gm.playerIdx;
    if (fx.big && gm.winner != null) {
      fireworks(userWon ? 7 : 4);
      F.excite = 1;
      const A = audio();
      if (A.cheer) A.cheer(1);
    }
    if (gm.meta && gm.meta.clinch === true && userWon) {
      champions(S);
      extra = 4.2;
    }
    return extra;
  };

  fx.camera = function () {
    return BB.fieldView ? BB.fieldView.cam : null;
  };

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------
  function newGame(S) {
    F.game = S.g;
    F.timers = [];
    F.shown = null;
    F.shownKey = '';
    F.replay = null;
    F.wipe = null;
    F.pendingPitcher = null;
    F.lastPlay = null;
    F.watchPlay = null;
    F.pitcher = null;
    F.excite = 0;
    F.champs = 0;
    P.n = 0;
    resetCam();
    fx.big = isBig(S.g);
    const e = els();
    if (e) {
      e.replay.hidden = true;
      e.champs.hidden = true;
      e.champs.classList.remove('show');
      const label = S.g && S.g.meta && S.g.meta.label;
      e.label.textContent = fx.big ? label || (S.g.meta.type === 'allstar' ? 'All-Star Game' : 'Postseason') : '';
      e.label.hidden = !fx.big;
    }
  }

  // Each rig wears the look of the player it shows.
  function syncLooks(S) {
    const G = BB.game;
    const gm = S.g;
    const p = G.fieldingTeam(gm).pitcher;
    const pr = S.pitcherRig;
    if (F.pitcher !== p) {
      // New pitcher (change or new half): drop any reaction of the last one.
      if (F.pitcher && pr.reacting()) pr.play('sign', 0.25, null, true);
      F.pitcher = p;
    }
    if (pr.lookSrc !== p.look && !pr.reacting()) {
      pr.lookSrc = p.look;
      pr.setLook(p.look);
    }
    const cur = G.currentBatter(gm);
    const key = gm.half + ':' + gm.inning;
    const br = S.batterRig;
    if (!F.shown || br.name === 'enter' || key !== F.shownKey) {
      F.shown = cur;
      F.shownKey = key;
    }
    if (br.lookSrc !== F.shown.look) {
      br.lookSrc = F.shown.look;
      br.setLook(F.shown.look);
    }
  }

  // Crowd and fireworks for events in the field view (big games only).
  function watchField(S) {
    if (S.play !== F.watchPlay) {
      F.watchPlay = S.play;
      F.lastPlayT = S.playT;
      return;
    }
    const t0 = F.lastPlayT;
    const t1 = S.playT;
    F.lastPlayT = t1;
    if (!fx.big || F.replay || t1 <= t0) return;
    const A = audio();
    for (const e of S.play.script.events) {
      if (e.t <= t0 || e.t > t1) continue;
      if (e.kind === 'hr') {
        fireworks(5);
        F.excite = 1;
        if (A.cheer) A.cheer(1);
      } else if (e.kind === 'score') {
        F.excite = Math.max(F.excite, 0.6);
        if (A.cheer) A.cheer(0.6);
      }
    }
  }

  fx.update = function (S, dt) {
    if (S.g !== F.game) newGame(S);
    const fv = BB.fieldView && BB.fieldView.view;
    if (fv && fv.W) {
      VW = fv.W;
      VH = fv.H;
    }
    runTimers(dt);
    const inGame = S.screen === 'game' && S.g;
    if (inGame) syncLooks(S);
    if (F.wipe) stepWipe(dt);
    if (F.replay && F.replay.phase === 'run') stepReplay(S, dt);
    // Back to the batter after a play: the pitcher's delayed reaction.
    if (inGame && S.view === 'bat' && F.lastView === 'field' && F.pendingPitcher) {
      const name = F.pendingPitcher;
      F.pendingPitcher = null;
      after(0.15, () => S.pitcherRig.play(name, 0.35));
    }
    F.lastView = S.view;
    if (S.view === 'field' && S.play) {
      watchField(S);
      const cel = S.play.script.celebrate;
      if (cel && cel.on) cel.t += dt;
    }
    updateCam(S, dt);
    stepParticles(dt);
    if (F.champs > 0) {
      F.champs -= dt;
      if (Math.floor((F.champs + dt) / 0.6) !== Math.floor(F.champs / 0.6)) confetti(26);
      if (F.champs <= 0 || S.screen !== 'game') {
        const e = els();
        if (e) e.champs.classList.remove('show');
      }
    }
    F.excite = Math.max(0, F.excite - dt * 0.35);
    fx.flashes = fx.big ? Math.round(F.excite * 9) : 0;
  };

  // ---------------------------------------------------------------------------
  // Overlay: replay letterbox, particles, the wipe.
  // ---------------------------------------------------------------------------
  function drawWipe(ctx) {
    const w = F.wipe.w;
    const W = VW;
    const H = VH;
    const slant = H * 0.35;
    // 0..0.5 the panel slides in from the left, 0.5..1 it leaves to the right.
    const e = w < 0.5 ? U.easeInOut(w * 2) : U.easeInOut((w - 0.5) * 2);
    const left = w < 0.5 ? -W - slant + e * (W + slant) : e * (W + slant);
    const right = left + W + slant;
    ctx.fillStyle = '#1d2433';
    ctx.beginPath();
    ctx.moveTo(left + slant, 0);
    ctx.lineTo(right + slant, 0);
    ctx.lineTo(right, H);
    ctx.lineTo(left, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(right + slant, 0);
    ctx.lineTo(right + slant + 14, 0);
    ctx.lineTo(right + 14, H);
    ctx.lineTo(right, H);
    ctx.closePath();
    ctx.fill();
    const cx = (left + right + slant) / 2;
    ctx.fillStyle = '#f7f5ef';
    ctx.font = `800 ${Math.round(Math.min(64, W * 0.11))}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('REPLAY', cx, H * 0.45);
  }

  fx.drawOverlay = function (ctx, S) {
    DPR = ctx.getTransform ? ctx.getTransform().a : 1;
    if (!VW || VW === 800) {
      VW = ctx.canvas.width / DPR;
      VH = ctx.canvas.height / DPR;
    }
    if (F.replay && F.replay.phase === 'run' && S.view === 'field') {
      const bar = Math.round(VH * 0.05);
      ctx.fillStyle = 'rgba(10,14,22,0.55)';
      ctx.fillRect(0, 0, VW, bar);
      ctx.fillRect(0, VH - bar, VW, bar);
    }
    if (P.n) drawParticles(ctx);
    if (F.wipe) drawWipe(ctx);
  };

  // Tap, click or Space skips a replay.
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const skip = () => {
      if (F.replay && F.replay.phase === 'run') F.replay.skip = true;
    };
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') skip();
    });
    const cv = document.getElementById('game');
    (cv || window).addEventListener('pointerdown', skip);
  }

  // For tests and the contact sheet.
  fx.fireworks = (n) => fireworks(n || 5);
  fx.confetti = (n) => confetti(n || 120);
  fx.state = F;
})(typeof window !== 'undefined' ? window : globalThis);
