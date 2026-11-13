// Top-down field view that animates a play script from BB.sim.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;
  const C = {
    bg: '#25324a',
    grass: '#4caa52',
    grassDark: '#43994a',
    dirt: '#c98a55',
    track: '#b97a47',
    chalk: '#f7f5ef',
    wall: '#1d5a3c',
  };

  const view = { W: 0, H: 0, k: 1, ox: 0, oy: 0, cache: null };

  function layout(W, H, topInset, bottomInset) {
    view.W = W;
    view.H = H;
    const availH = H - topInset - bottomInset;
    view.k = Math.min(W / 520, availH / 470);
    view.ox = W / 2;
    view.oy = topInset + availH / 2 + 205 * view.k; // world y = 205 at the middle
    view.cache = null;
  }

  const sx = (x) => view.ox + x * view.k;
  const sy = (y) => view.oy - y * view.k;

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

  function drawField(ctx) {
    const { W, H } = view;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    // Crowd ring hint
    const outer = fenceArc(40, 48);
    ctx.fillStyle = '#2d3c57';
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
      ctx.arc(sx(0), sy(0), (r + 20) * view.k, 0, Math.PI * 2);
      ctx.arc(sx(0), sy(0), r * view.k, 0, Math.PI * 2, true);
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
    ctx.arc(sx(0), sy(60.5), 9 * view.k, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), 13 * view.k, 0, Math.PI * 2);
    ctx.fill();
    // Foul lines
    ctx.strokeStyle = C.chalk;
    ctx.lineWidth = Math.max(1, 1.2 * view.k);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx(0), sy(0));
      ctx.lineTo(sx(sgn * 233), sy(233));
      ctx.stroke();
    }
    // Fence
    ctx.strokeStyle = C.wall;
    ctx.lineWidth = Math.max(3, 5 * view.k);
    ctx.beginPath();
    arc.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.stroke();
    // Distance markers
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${Math.max(9, Math.round(11 * view.k * 1.6))}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const th of [-45, 0, 45]) {
      const r = BB.sim.fenceDist(th) + 16;
      ctx.fillText(String(Math.round(BB.sim.fenceDist(th))), sx(Math.sin(U.rad(th)) * r), sy(Math.cos(U.rad(th)) * r));
    }
    // Bases
    for (const b of [1, 2, 3]) {
      const p = BB.sim.BASE[b];
      const s = Math.max(3, 2.2 * view.k);
      ctx.save();
      ctx.translate(sx(p.x), sy(p.y));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = C.chalk;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }
    // Home plate
    const hp = Math.max(3, 2.2 * view.k);
    ctx.fillStyle = C.chalk;
    ctx.beginPath();
    ctx.moveTo(sx(0) - hp, sy(0) - hp * 0.6);
    ctx.lineTo(sx(0) + hp, sy(0) - hp * 0.6);
    ctx.lineTo(sx(0) + hp, sy(0) + hp * 0.2);
    ctx.lineTo(sx(0), sy(0) + hp);
    ctx.lineTo(sx(0) - hp, sy(0) + hp * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  function background(ctx) {
    // Cache the static field in an offscreen canvas.
    const dpr = ctx.getTransform ? ctx.getTransform().a : 1;
    if (!view.cache || view.cache.dpr !== dpr) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(view.W * dpr);
      c.height = Math.ceil(view.H * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawField(g);
      view.cache = { canvas: c, dpr };
    }
    ctx.drawImage(view.cache.canvas, 0, 0, view.W, view.H);
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
    if (!seg) return { x: 0, y: 0, h: 3 };
    const tt = Math.min(t, seg.t1);
    if (seg.kind === 'batted') return script.flight.pos(tt);
    const u = seg.t1 > seg.t0 ? (tt - seg.t0) / (seg.t1 - seg.t0) : 1;
    const d = U.dist(seg.from, seg.to);
    return {
      x: U.lerp(seg.from.x, seg.to.x, u),
      y: U.lerp(seg.from.y, seg.to.y, u),
      h: 5 + 4 * d * 0.05 * u * (1 - u),
    };
  }

  function drawPlayer(ctx, x, y, color, ring, label, alpha) {
    const r = Math.max(7, 6 * view.k);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx(x) + 1.5, sy(y) + 2, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx(x), sy(y), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (label && r >= 8) {
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(r * 0.95)}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, sx(x), sy(y) + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // st: { script, t, fieldColor, batColor, defense }
  function draw(ctx, st) {
    background(ctx);
    const { script, t } = st;
    // Ball trail
    if (script.flight) {
      const tEnd = Math.min(t, script.ball[0] ? script.ball[0].t1 : 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      for (let tt = 0; tt <= tEnd; tt += 0.05) {
        const p = script.flight.pos(tt);
        if (tt === 0) ctx.moveTo(sx(p.x), sy(p.y));
        else ctx.lineTo(sx(p.x), sy(p.y));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Fielders
    for (const pos of BB.sim.POS_ORDER) {
      const fp = script.fielders[pos];
      const home = BB.sim.FIELDER_HOME[pos];
      const p = fp ? interp(fp.path, t) : home;
      drawPlayer(ctx, p.x, p.y, st.fieldColor, '#ffffff', pos, 1);
    }
    // Runners
    for (const r of script.runners) {
      const p = interp(r.path, t);
      if (!p) continue;
      let alpha = 1;
      if (r.outAt != null && t > r.outAt) alpha = U.clamp(1 - (t - r.outAt) / 0.9, 0, 1);
      if (r.scoredAt != null && t > r.scoredAt) alpha = U.clamp(1 - (t - r.scoredAt) / 0.8, 0, 1);
      if (alpha <= 0) continue;
      drawPlayer(ctx, p.x, p.y, st.batColor, '#1d2433', null, alpha);
    }
    // Ball
    const b = ballAt(script, t);
    const r = Math.max(3, (1.4 + b.h * 0.035) * view.k);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx(b.x), sy(b.y), Math.max(2.5, 1.5 * view.k), Math.max(1.8, 1.1 * view.k), 0, 0, Math.PI * 2);
    ctx.fill();
    const lift = Math.min(b.h, 120) * 0.35 * view.k;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx(b.x), sy(b.y) - lift, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Event labels
    for (const e of script.events) {
      const age = t - e.t;
      if (age < 0 || age > 1.3) continue;
      const a = U.clamp(1.3 - age, 0, 1);
      const yOff = -18 - age * 22;
      ctx.globalAlpha = a;
      ctx.font = `800 ${Math.round(Math.max(14, 15 * view.k * 1.5))}px "Barlow Condensed", sans-serif`;
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

  BB.fieldView = { layout, draw, view };
})(typeof window !== 'undefined' ? window : globalThis);
