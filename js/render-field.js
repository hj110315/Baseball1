// Top-down field view that animates a play script from BB.sim.
//
// Camera: BB.fieldView.cam = { x, y, z } is the world point (feet) at the
// middle of the play area and the zoom (1 = the whole field). js/fx.js moves
// it (follow cam, replays). The static field is cached in an offscreen canvas
// rendered for the current camera with a margin; small pans and zoom changes
// reuse it, and it is re-rendered at the exact zoom once the camera settles,
// so zooming never stays blurry and the field is not redrawn every frame.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;
  const C = {
    bg: '#25324a',
    stands: '#2d3c57',
    grass: '#4caa52',
    grassDark: '#43994a',
    dirt: '#c98a55',
    track: '#b97a47',
    chalk: '#f7f5ef',
    wall: '#1d5a3c',
  };

  const view = { W: 0, H: 0, k: 1, cx: 0, cy: 0, cache: null };
  const HOME_CAM = { x: 0, y: 205, z: 1 };
  const cam = { x: HOME_CAM.x, y: HOME_CAM.y, z: HOME_CAM.z, moving: false };

  // Current world -> screen transform (screen = X0 + x*KZ, Y0 - y*KZ).
  let X0 = 0;
  let Y0 = 0;
  let KZ = 1;
  function setXf(cx, cy, cx0, cy0, z) {
    KZ = view.k * z;
    X0 = cx - cx0 * KZ;
    Y0 = cy + cy0 * KZ;
  }
  const sx = (x) => X0 + x * KZ;
  const sy = (y) => Y0 - y * KZ;

  function layout(W, H, topInset, bottomInset) {
    view.W = W;
    view.H = H;
    const availH = H - topInset - bottomInset;
    view.k = Math.min(W / 480, availH / 470);
    view.cx = W / 2;
    view.cy = topInset + availH / 2; // world y = 205 sits here at zoom 1
    view.availH = availH;
    view.cache = null;
  }
  // Largest useful zoom: about 3.4 px per foot, at least 1.6x, at most 3x.
  function maxZoom() {
    return U.clamp(3.4 / view.k, 1.6, 3);
  }

  function fieldPath(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.closePath();
  }
  function fenceArc(rOff, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = -45 + (90 * i) / n;
      const r = BB.sim.fenceDist(th) + (rOff || 0);
      pts.push({ x: Math.sin(U.rad(th)) * r, y: Math.cos(U.rad(th)) * r });
    }
    return pts;
  }

  function drawField(ctx, w, h, big) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    // Crowd ring hint
    const outer = fenceArc(40, 48);
    ctx.fillStyle = C.stands;
    fieldPath(ctx, [{ x: -300, y: 230 }].concat(outer).concat([{ x: 300, y: 230 }, { x: 70, y: -60 }, { x: -70, y: -60 }]));
    ctx.fill();
    // Playing surface: fair territory + foul ground
    const arc = fenceArc(0, 60);
    const surface = [{ x: -48, y: -40 }, { x: 48, y: -40 }, { x: 262, y: 212 }].concat(arc.slice().reverse()).concat([{ x: -262, y: 212 }]);
    ctx.fillStyle = C.grass;
    fieldPath(ctx, surface);
    ctx.fill();
    // Mowing stripes: concentric bands from home
    ctx.save();
    fieldPath(ctx, surface);
    ctx.clip();
    ctx.fillStyle = C.grassDark;
    for (let r = 40; r < 420; r += 40) {
      ctx.beginPath();
      ctx.arc(sx(0), sy(0), (r + 20) * KZ, 0, Math.PI * 2);
      ctx.arc(sx(0), sy(0), r * KZ, 0, Math.PI * 2, true);
      ctx.fill();
    }
    ctx.restore();
    // Warning track
    ctx.fillStyle = C.track;
    fieldPath(ctx, fenceArc(0, 60).concat(fenceArc(-14, 60).reverse()));
    ctx.fill();
    // Infield dirt
    const arcPts = [];
    for (let i = 0; i <= 40; i++) {
      const a = U.rad(18.2 + (143.6 * i) / 40);
      arcPts.push({ x: Math.cos(a) * 95, y: 60.5 + Math.sin(a) * 95 });
    }
    ctx.fillStyle = C.dirt;
    fieldPath(ctx, [{ x: 0, y: -6 }, { x: 90.2, y: 90.2 }].concat(arcPts).concat([{ x: -90.2, y: 90.2 }]));
    ctx.fill();
    ctx.fillStyle = C.grass;
    fieldPath(ctx, [{ x: 0, y: 10 }, { x: 55, y: 63.6 }, { x: 0, y: 117 }, { x: -55, y: 63.6 }]);
    ctx.fill();
    ctx.fillStyle = C.dirt;
    ctx.beginPath();
    ctx.arc(sx(0), sy(60.5), 9 * KZ, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), 13 * KZ, 0, Math.PI * 2);
    ctx.fill();
    // Foul lines
    ctx.strokeStyle = C.chalk;
    ctx.lineWidth = Math.max(1, 1.2 * KZ);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx(0), sy(0));
      ctx.lineTo(sx(sgn * 233), sy(233));
      ctx.stroke();
    }
    // Fence
    ctx.strokeStyle = C.wall;
    ctx.lineWidth = Math.max(3, 5 * KZ);
    ctx.beginPath();
    arc.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.stroke();
    if (big) drawBunting(ctx);
    // Distance markers
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${Math.max(9, Math.round(Math.min(30, 11 * KZ * 1.6)))}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const th of [-45, 0, 45]) {
      const r = BB.sim.fenceDist(th) + (th === 0 ? 16 : -26);
      ctx.fillText(String(Math.round(BB.sim.fenceDist(th))), sx(Math.sin(U.rad(th)) * r), sy(Math.cos(U.rad(th)) * r));
    }
    // Bases
    for (const b of [1, 2, 3]) {
      const p = BB.sim.BASE[b];
      const s = Math.max(3, 2.2 * KZ);
      ctx.save();
      ctx.translate(sx(p.x), sy(p.y));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = C.chalk;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }
    // Home plate
    const hp = Math.max(3, 2.2 * KZ);
    const hx = sx(0);
    const hy = sy(0);
    ctx.fillStyle = C.chalk;
    ctx.beginPath();
    ctx.moveTo(hx - hp, hy - hp * 0.6);
    ctx.lineTo(hx + hp, hy - hp * 0.6);
    ctx.lineTo(hx + hp, hy + hp * 0.2);
    ctx.lineTo(hx, hy + hp);
    ctx.lineTo(hx - hp, hy + hp * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  // Postseason: bunting fans along the outfield wall and a gold rail on it.
  function drawBunting(ctx) {
    const arc = fenceArc(3.5, 60);
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = Math.max(1.5, 1.6 * KZ);
    ctx.beginPath();
    arc.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.stroke();
    const r = Math.max(3, 7 * KZ);
    for (let th = -42; th <= 42; th += 7) {
      const d = BB.sim.fenceDist(th) + 9;
      const x = sx(Math.sin(U.rad(th)) * d);
      const y = sy(Math.cos(U.rad(th)) * d);
      const a = Math.atan2(sy(0) - y, sx(0) - x); // fan opens toward home
      for (const [col, f] of [['#24427a', 1], ['#f7f5ef', 0.7], ['#d64541', 0.42]]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r * f, a - Math.PI / 2, a + Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Static field, cached for the current camera (see the note at the top).
  function background(ctx) {
    const dpr = ctx.getTransform ? ctx.getTransform().a : 1;
    const big = !!(BB.fx && BB.fx.big);
    const Cc = view.cache;
    if (Cc && Cc.dpr === dpr && Cc.big === big) {
      const s = cam.z / Cc.z;
      const lo = cam.moving ? 0.84 : 0.996;
      const hi = cam.moving ? 1.2 : 1.004;
      if (s >= lo && s <= hi) {
        const kz = view.k * cam.z;
        const X = view.cx + (Cc.x - cam.x) * kz;
        const Y = view.cy - (Cc.y - cam.y) * kz;
        const hw = (Cc.w / 2) * s;
        const hh = (Cc.h / 2) * s;
        if (X - hw <= 0 && X + hw >= view.W && Y - hh <= 0 && Y + hh >= view.H) {
          ctx.drawImage(Cc.canvas, X - hw, Y - hh, hw * 2, hh * 2);
          return;
        }
      }
    }
    // Re-render: the visible area plus a margin, at the current zoom.
    const M = Math.round(Math.max(view.W, view.H) * 0.12);
    const w = Math.ceil(view.W + M * 2);
    const h = Math.ceil(view.H + M * 2);
    let canvas = Cc && Cc.dpr === dpr && Cc.w === w && Cc.h === h ? Cc.canvas : null;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = Math.ceil(w * dpr);
      canvas.height = Math.ceil(h * dpr);
    }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    setXf(w / 2, h / 2, cam.x, cam.y, cam.z);
    drawField(g, w, h, big);
    view.cache = { canvas, dpr, big, w, h, x: cam.x, y: cam.y, z: cam.z };
    setXf(view.cx, view.cy, cam.x, cam.y, cam.z);
    ctx.drawImage(canvas, view.cx - w / 2, view.cy - h / 2, w, h);
  }

  // --- Script evaluation ------------------------------------------------------
  function interp(path, t) {
    if (!path.length) return null;
    if (t <= path[0].t) return path[0];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (t <= b.t) {
        const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
        return { x: U.lerp(a.x, b.x, u), y: U.lerp(a.y, b.y, u) };
      }
    }
    return path[path.length - 1];
  }

  function ballAt(script, t) {
    let seg = null;
    for (const s of script.ball) if (s.t0 <= t) seg = s;
    if (!seg) return { x: 0, y: 0, h: 3, seg: null };
    const tt = Math.min(t, seg.t1);
    if (seg.kind === 'batted') {
      const p = script.flight.pos(tt);
      return { x: p.x, y: p.y, h: p.h, seg };
    }
    const u = seg.t1 > seg.t0 ? (tt - seg.t0) / (seg.t1 - seg.t0) : 1;
    const d = U.dist(seg.from, seg.to);
    return {
      x: U.lerp(seg.from.x, seg.to.x, u),
      y: U.lerp(seg.from.y, seg.to.y, u),
      h: 5 + 4 * d * 0.05 * u * (1 - u),
      seg,
    };
  }

  // Tiny top-down player: dark body, team-color cap and ring, swinging arms
  // and legs while running. heading is a screen angle (0 = right, clockwise).
  // pose: { dive: 0..1 (stretched out, arms reaching), lift: feet off the
  // ground (jumping) }.
  function drawPlayer(ctx, x, y, team, heading, speed, t, alpha, glove, pose) {
    const u = Math.max(3.2, 2.5 * KZ); // px per foot, exaggerated so players read at small sizes
    const X = sx(x);
    const Y = sy(y);
    const run = U.clamp(speed / 18, 0, 1);
    const ph = Math.sin(t * 13 + x * 0.1);
    const dive = pose && pose.dive ? pose.dive : 0;
    const lift = pose && pose.lift ? pose.lift : 0;
    const a0 = alpha == null ? 1 : alpha;
    ctx.save();
    ctx.globalAlpha = a0;
    // Shadow and team ring on the ground
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(X + u * 0.6, Y + u * 0.9, u * (2.3 + dive * 1.2) * (1 - lift * 0.08), u * 1.9 * (1 - lift * 0.08), heading, 0, Math.PI * 2);
    ctx.fill();
    if (!lift) {
      ctx.fillStyle = team;
      ctx.globalAlpha = a0 * 0.3;
      ctx.beginPath();
      ctx.arc(X, Y, u * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a0 * 0.9;
      ctx.strokeStyle = team;
      ctx.lineWidth = Math.max(1.5, u * 0.5);
      ctx.stroke();
      ctx.globalAlpha = a0;
    }
    // A jump lifts the body toward the camera: up the screen and a bit bigger.
    ctx.translate(X, Y - lift * u * 0.9);
    if (lift) ctx.scale(1 + lift * 0.07, 1 + lift * 0.07);
    ctx.rotate(heading + Math.PI / 2); // local -y is forward
    ctx.lineCap = 'round';
    if (dive > 0) {
      // Laid out: body stretched forward, arms reaching, legs trailing.
      const L = u * (1.35 + dive * 1.6);
      ctx.strokeStyle = '#12151d';
      ctx.lineWidth = u * 0.7;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * u * 0.4, L * 0.3);
        ctx.lineTo(side * u * 0.55, L * 0.3 + u * 1.6);
        ctx.stroke();
      }
      ctx.strokeStyle = '#1a1e28';
      ctx.lineWidth = u * 0.55;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * u * 0.7, -L * 0.25);
        ctx.lineTo(side * u * 0.35, -L * 0.25 - u * 1.9 * dive);
        ctx.stroke();
      }
      if (glove) {
        ctx.fillStyle = '#3a2a1e';
        ctx.beginPath();
        ctx.arc(-u * 0.35, -L * 0.25 - u * 2.1 * dive, u * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#1a1e28';
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.95, L * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,238,247,0.55)';
      ctx.lineWidth = Math.max(1, u * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.95, L * 0.55, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = team;
      ctx.beginPath();
      ctx.arc(0, -L * 0.42, u * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = '#12151d';
    // Legs swing forward and back while running (tucked when jumping)
    ctx.lineWidth = u * 0.75;
    const stride = lift ? u * 0.4 : u * 1.5 * run;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * u * 0.55, 0);
      ctx.lineTo(side * u * 0.6, -ph * side * stride + u * 0.2);
      ctx.stroke();
    }
    // Arms swing opposite (thrown up when jumping)
    ctx.strokeStyle = '#1a1e28';
    ctx.lineWidth = u * 0.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * u * 1.05, 0);
      if (lift) ctx.lineTo(side * u * 2.1, -u * 0.6);
      else ctx.lineTo(side * u * 1.25, ph * side * stride * 0.8 - u * 0.4);
      ctx.stroke();
    }
    if (glove) {
      ctx.fillStyle = '#3a2a1e';
      ctx.beginPath();
      ctx.arc(-u * 1.3, -u * 0.6 - ph * stride * 0.8, u * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shoulders / torso
    ctx.fillStyle = '#1a1e28';
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 1.35, u * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rim highlight on the leading edge
    ctx.strokeStyle = 'rgba(232,238,247,0.55)';
    ctx.lineWidth = Math.max(1, u * 0.18);
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 1.35, u * 0.75, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // Cap with brim pointing forward
    ctx.fillStyle = team;
    ctx.beginPath();
    ctx.ellipse(0, -u * 0.55, u * 0.4, u * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, u * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Position, heading and speed of a path at time t.
  function motion(path, t, fallbackTo) {
    const p = interp(path, t);
    const q = interp(path, Math.max(0, t - 0.08));
    const dx = sx(p.x) - sx(q.x);
    const dy = sy(p.y) - sy(q.y);
    const speed = Math.hypot(p.x - q.x, p.y - q.y) / 0.08 || 0;
    let heading;
    if (speed > 1.5) heading = Math.atan2(dy, dx);
    else if (fallbackTo) heading = Math.atan2(sy(fallbackTo.y) - sy(p.y), sx(fallbackTo.x) - sx(p.x));
    else heading = -Math.PI / 2;
    return { x: p.x, y: p.y, heading, speed };
  }

  // Dive pose around the moment a fielder lays out for a ball (script.dive is
  // set by js/fx.js from play.fielded).
  function diveAmount(script, pos, t) {
    const d = script.dive;
    if (!d || d.pos !== pos) return 0;
    const a = t - d.t;
    if (a < -0.3 || a > 0.75) return 0;
    return a < 0 ? U.clamp((a + 0.3) / 0.25, 0, 1) : a < 0.35 ? 1 : 1 - (a - 0.35) / 0.4;
  }

  // Celebration: players run to a spot and jump around (script.celebrate is
  // set by js/fx.js): { team: 'bat'|'field', color, t, list: [{x0,y0,x1,y1,t0,dur,ph}] }.
  function drawCelebration(ctx, cel) {
    const t = cel.t;
    for (const m of cel.list) {
      const u = U.clamp((t - m.t0) / m.dur, 0, 1);
      const e = u * u * (3 - 2 * u);
      const x = U.lerp(m.x0, m.x1, e);
      const y = U.lerp(m.y0, m.y1, e);
      const moving = u > 0 && u < 1;
      const heading = moving ? Math.atan2(-(m.y1 - m.y0), m.x1 - m.x0) : Math.atan2(-(cel.cy - y), cel.cx - x + 1e-3);
      const after = t - (m.t0 + m.dur);
      const lift = after > 0 ? Math.max(0, Math.sin(after * 8.5 + m.ph)) * 1.7 : 0;
      drawPlayer(ctx, x, y, cel.color, heading, moving ? 20 : 0, t, 1, cel.team === 'field', { lift });
    }
  }

  // st: { script, t, fieldColor, batColor }
  function draw(ctx, st) {
    background(ctx);
    setXf(view.cx, view.cy, cam.x, cam.y, cam.z);
    const { script, t } = st;
    const cel = script.celebrate && script.celebrate.on ? script.celebrate : null;
    const zs = Math.sqrt(cam.z);
    // Ball trail
    if (script.flight) {
      const tEnd = Math.min(t, script.ball[0] ? script.ball[0].t1 : 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2 * zs;
      ctx.setLineDash([3 * zs, 5 * zs]);
      ctx.beginPath();
      for (let tt = 0; tt <= tEnd; tt += 0.05) {
        const p = script.flight.pos(tt);
        if (tt === 0) ctx.moveTo(sx(p.x), sy(p.y));
        else ctx.lineTo(sx(p.x), sy(p.y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const b = ballAt(script, t);
    // Fielders watch the ball when they aren't running.
    if (!(cel && cel.team === 'field')) {
      for (const pos of BB.sim.POS_ORDER) {
        const fp = script.fielders[pos];
        const home = BB.sim.FIELDER_HOME[pos];
        const m = fp ? motion(fp.path, t, b) : { x: home.x, y: home.y, speed: 0, heading: Math.atan2(sy(b.y) - sy(home.y), sx(b.x) - sx(home.x)) };
        const dive = diveAmount(script, pos, t);
        drawPlayer(ctx, m.x, m.y, st.fieldColor, m.heading, m.speed, t, 1, true, dive ? { dive } : null);
      }
    }
    // Runners
    if (!(cel && cel.team === 'bat')) {
      for (const r of script.runners) {
        if (!r.path.length) continue;
        let alpha = 1;
        if (r.outAt != null && t > r.outAt) alpha = U.clamp(1 - (t - r.outAt) / 0.9, 0, 1);
        if (r.scoredAt != null && t > r.scoredAt) alpha = U.clamp(1 - (t - r.scoredAt) / 0.8, 0, 1);
        if (alpha <= 0) continue;
        const m = motion(r.path, t, b);
        drawPlayer(ctx, m.x, m.y, st.batColor, m.heading, m.speed, t, alpha, false);
      }
    }
    if (cel) drawCelebration(ctx, cel);
    // Ball (gone once a home run lands in the stands)
    const showBall = !(script.ballHideAt != null && t > script.ballHideAt);
    if (showBall) {
      const r = Math.max(3, (1.4 + b.h * 0.035) * KZ);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(sx(b.x), sy(b.y), Math.max(2.5, 1.5 * KZ), Math.max(1.8, 1.1 * KZ), 0, 0, Math.PI * 2);
      ctx.fill();
      const lift = Math.min(b.h, 120) * 0.35 * KZ;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx(b.x), sy(b.y) - lift, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Event labels
    const fs = Math.round(Math.max(14, Math.min(34, 15 * view.k * 1.5 * zs)));
    for (const e of script.events) {
      const age = t - e.t;
      if (age < 0 || age > 1.3) continue;
      const a = U.clamp(1.3 - age, 0, 1);
      const yOff = (-18 - age * 22) * zs;
      ctx.globalAlpha = a;
      ctx.font = `800 ${fs}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const color = e.kind === 'out' ? '#ff6b57' : e.kind === 'score' || e.kind === 'hr' ? '#ffe066' : '#7ee2a8';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,26,40,0.85)';
      ctx.strokeText(e.text, sx(e.x), sy(e.y) + yOff);
      ctx.fillStyle = color;
      ctx.fillText(e.text, sx(e.x), sy(e.y) + yOff);
      ctx.globalAlpha = 1;
    }
  }

  // World point -> screen point under the current camera (for overlays).
  function toScreen(x, y) {
    const kz = view.k * cam.z;
    return { x: view.cx + (x - cam.x) * kz, y: view.cy - (y - cam.y) * kz };
  }

  BB.fieldView = { layout, draw, view, cam, HOME_CAM, maxZoom, ballAt, interp, toScreen };
})(typeof window !== 'undefined' ? window : globalThis);
