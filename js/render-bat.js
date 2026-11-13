// Behind-the-batter view: stadium, pitcher, batter, strike zone and the pitch.
// World units are feet: x toward first base, y up, z from home plate toward the mound.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;

  const CAM_Y = 5.5;
  const CAM_Z = -16;
  const ZONE = { halfW: 0.83, midY: 2.55, halfH: 0.95 };
  const MOUND_Z = 60.5;
  const COLORS = {
    sky: '#9fd8f2',
    skyLow: '#cbeaf7',
    stands: '#2d3c57',
    standsDark: '#233049',
    wall: '#1d5a3c',
    wallTop: '#f2c94c',
    grass: '#4caa52',
    grassDark: '#43994a',
    dirt: '#c98a55',
    dirtDark: '#b97a47',
    chalk: '#f7f5ef',
    pants: '#eef0f3',
  };

  const view = { W: 0, H: 0, s0: 1, f: 1, cx: 0, hY: 0, crowd: null };

  function layout(W, H) {
    view.W = W;
    view.H = H;
    view.s0 = Math.min(H * 0.1, W * 0.2);
    view.f = view.s0 * -CAM_Z;
    view.cx = W / 2;
    const plateY = Math.min(H * 0.86, H - 110);
    view.hY = plateY - CAM_Y * view.s0;
    view.crowd = null;
  }

  function proj(x, y, z) {
    const dz = Math.max(0.6, z - CAM_Z);
    const s = view.f / dz;
    return { x: view.cx + x * s, y: view.hY + (CAM_Y - y) * s, s };
  }

  function zoneToWorld(px, py) {
    return { x: px * ZONE.halfW, y: ZONE.midY + py * ZONE.halfH };
  }
  function screenToZone(sx, sy) {
    const s = view.s0;
    const x = (sx - view.cx) / s;
    const y = CAM_Y - (sy - view.hY) / s;
    return { px: x / ZONE.halfW, py: (y - ZONE.midY) / ZONE.halfH };
  }
  function zoneToScreen(px, py) {
    const w = zoneToWorld(px, py);
    return proj(w.x, w.y, 0);
  }

  function polyGround(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = proj(p.x, 0, p.z);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
  }
  function circlePts(cx, cz, r, n, a0, a1) {
    const pts = [];
    const start = a0 === undefined ? 0 : a0;
    const end = a1 === undefined ? Math.PI * 2 : a1;
    for (let i = 0; i <= n; i++) {
      const a = start + ((end - start) * i) / n;
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
    }
    return pts;
  }

  function buildCrowd() {
    // Pre-render the stands so each frame is cheap.
    const c = document.createElement('canvas');
    const top = Math.max(0, view.hY - view.H * 0.2);
    const h = Math.max(4, Math.ceil(view.hY - top + 4));
    c.width = Math.ceil(view.W);
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = COLORS.stands;
    g.fillRect(0, 0, c.width, h);
    const rows = Math.max(4, Math.floor(h / 9));
    const palette = ['#f2d5b8', '#e8b48a', '#b97d55', '#8a5a3c', '#f4f4f4', '#d64541', '#2f9bd9', '#e9b52c', '#5c6a84'];
    const rng = U.seeded(99);
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * (h / rows);
      g.fillStyle = r % 2 ? COLORS.standsDark : COLORS.stands;
      g.fillRect(0, r * (h / rows), c.width, h / rows);
      const size = 1.5 + (r / rows) * 2;
      for (let x = rng() * 6; x < c.width; x += 4 + size * 1.6) {
        g.fillStyle = palette[Math.floor(rng() * palette.length)];
        g.globalAlpha = 0.85;
        g.beginPath();
        g.arc(x, y, size, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    view.crowd = { canvas: c, top };
  }

  function drawStadium(ctx) {
    const { W, H, hY } = view;
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, hY);
    sky.addColorStop(0, COLORS.sky);
    sky.addColorStop(1, COLORS.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hY + 2);
    // Light towers
    ctx.fillStyle = '#5c6a84';
    for (const fx of [0.12, 0.88]) {
      const x = W * fx;
      const top = Math.max(8, hY - H * 0.36);
      ctx.fillRect(x - 2, top, 4, hY - top);
      ctx.fillStyle = '#fdf7d7';
      ctx.fillRect(x - 16, top - 10, 32, 12);
      ctx.fillStyle = '#5c6a84';
    }
    // Stands
    if (!view.crowd) buildCrowd();
    ctx.drawImage(view.crowd.canvas, 0, view.crowd.top);
    // Outfield wall
    const wallTop = proj(0, 9, 400).y;
    const wallBase = proj(0, 0, 400).y;
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, wallTop, W, wallBase - wallTop + 1);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(0, wallTop - 1.5, W, 2);
    // Ground
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, wallBase, W, H - wallBase);
    // Mowing stripes (projected bands)
    ctx.fillStyle = COLORS.grassDark;
    for (let z = 120; z < 400; z += 50) {
      const a = proj(0, 0, z + 25).y;
      const b = proj(0, 0, z).y;
      ctx.fillRect(0, a, W, b - a);
    }
    for (let z = -16; z < 120; z += 25) {
      const a = proj(0, 0, z + 12.5).y;
      const b = proj(0, 0, Math.max(z, -14)).y;
      ctx.fillRect(0, a, W, Math.min(H, b) - a);
    }
    // Warning track
    ctx.fillStyle = COLORS.dirtDark;
    const tA = proj(0, 0, 400).y;
    const tB = proj(0, 0, 385).y;
    ctx.fillRect(0, tA, W, tB - tA);

    // Infield dirt: fan from home out to an arc around the mound.
    const arc = circlePts(0, MOUND_Z, 95, 40, U.rad(18.2), U.rad(161.8)).reverse();
    ctx.fillStyle = COLORS.dirt;
    polyGround(ctx, [{ x: 0, z: -2 }, { x: 90.2, z: 90.2 }].concat(arc.reverse()).concat([{ x: -90.2, z: 90.2 }]));
    ctx.fill();
    // Infield grass
    ctx.fillStyle = COLORS.grass;
    polyGround(ctx, [{ x: 0, z: 10 }, { x: 55, z: 63.6 }, { x: 0, z: 117 }, { x: -55, z: 63.6 }]);
    ctx.fill();
    // Mound
    ctx.fillStyle = COLORS.dirt;
    polyGround(ctx, circlePts(0, MOUND_Z - 1, 9, 28));
    ctx.fill();
    // Home plate circle
    polyGround(ctx, circlePts(0, 0, 13, 36).map((p) => ({ x: p.x, z: Math.max(p.z, -15) })));
    ctx.fill();
    // Foul lines
    ctx.strokeStyle = COLORS.chalk;
    ctx.lineWidth = Math.max(1, view.s0 * 0.03);
    for (const sgn of [-1, 1]) {
      const a = proj(sgn * 1.2, 0, 1.2);
      const b = proj(sgn * 233, 0, 233);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Bases
    for (const [x, z] of [[63.6, 63.6], [0, 127.3], [-63.6, 63.6]]) {
      ctx.fillStyle = COLORS.chalk;
      polyGround(ctx, [{ x: x - 1.1, z }, { x, z: z + 1.1 }, { x: x + 1.1, z }, { x, z: z - 1.1 }]);
      ctx.fill();
    }
    // Rubber
    ctx.fillStyle = COLORS.chalk;
    polyGround(ctx, [{ x: -1, z: MOUND_Z }, { x: 1, z: MOUND_Z }, { x: 1, z: MOUND_Z + 0.5 }, { x: -1, z: MOUND_Z + 0.5 }]);
    ctx.fill();
    // Batter's boxes
    ctx.strokeStyle = 'rgba(247,245,239,0.85)';
    ctx.lineWidth = Math.max(1, view.s0 * 0.04);
    for (const sgn of [-1, 1]) {
      polyGround(ctx, [{ x: sgn * 1.25, z: -3 }, { x: sgn * 5.25, z: -3 }, { x: sgn * 5.25, z: 3 }, { x: sgn * 1.25, z: 3 }]);
      ctx.stroke();
    }
    // Home plate
    ctx.fillStyle = COLORS.chalk;
    polyGround(ctx, [{ x: -0.71, z: 0.71 }, { x: 0.71, z: 0.71 }, { x: 0.71, z: 0 }, { x: 0, z: -0.71 }, { x: -0.71, z: 0 }]);
    ctx.fill();
  }

  // --- Figures -------------------------------------------------------------
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = U.clamp(Math.round(r + amt * 255), 0, 255);
    g = U.clamp(Math.round(g + amt * 255), 0, 255);
    b = U.clamp(Math.round(b + amt * 255), 0, 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  // Players are skeleton rigs (js/rig.js) drawn at their spot in the 3D view.
  function drawPitcher(ctx, rig, color, hand) {
    const base = proj(0, 0.8, MOUND_Z);
    BB.rig.drawPitcher(ctx, rig, base.x, base.y, base.s, color, hand);
  }
  function drawBatter(ctx, rig, color, hand, num) {
    const dir = hand === 'L' ? -1 : 1;
    const foot = proj(-dir * 2.35, 0, 0.4);
    BB.rig.drawBatter(ctx, rig, foot.x, foot.y, foot.s, color, hand, num);
  }

  // Motion trail: fading, shrinking copies of the ball's recent positions.
  function drawTrail(ctx, trail) {
    trail.forEach((q, i) => {
      const p = proj(q.x, q.y, q.z);
      const r = Math.max(3, 0.13 * p.s) * (1 - (i + 1) * 0.12);
      ctx.fillStyle = `rgba(255,255,255,${0.42 - i * 0.075})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawBall(ctx, x, y, z, glow) {
    const p = proj(x, y, z);
    const r = Math.max(3.2, 0.13 * p.s);
    // Shadow on the ground
    const g = proj(x, 0, z);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    if (glow) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (r > 5) {
      ctx.strokeStyle = '#d64541';
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.beginPath();
      ctx.arc(p.x - r * 0.9, p.y, r * 0.7, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x + r * 0.9, p.y, r * 0.7, Math.PI - 0.9, Math.PI + 0.9);
      ctx.stroke();
    }
    return { x: p.x, y: p.y, r };
  }

  function drawZone(ctx, opts) {
    const tl = zoneToScreen(-1, 1);
    const br = zoneToScreen(1, -1);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    if (opts.aiming) {
      // Aim area: wider frame around the zone.
      const a = zoneToScreen(-2.2, 2.0);
      const b = zoneToScreen(2.2, -2.0);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(tl.x, tl.y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(tl.x + (w * i) / 3, tl.y);
        ctx.lineTo(tl.x + (w * i) / 3, br.y);
        ctx.moveTo(tl.x, tl.y + (h * i) / 3);
        ctx.lineTo(br.x, tl.y + (h * i) / 3);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = opts.aiming ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = opts.aiming ? 2.5 : 1.6;
    ctx.strokeRect(tl.x, tl.y, w, h);
  }

  function drawMarker(ctx, m, idx, faded) {
    const p = zoneToScreen(m.px, m.py);
    const r = Math.max(7, view.s0 * 0.14);
    ctx.globalAlpha = faded ? 0.55 : 1;
    ctx.fillStyle = m.strike ? '#e5533d' : '#2e9e6a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(r * 1.2)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(idx), p.x, p.y + 0.5);
    ctx.globalAlpha = 1;
  }

  function drawReticle(ctx, px, py, sigma, color) {
    const p = zoneToScreen(px, py);
    const r = Math.max(6, view.s0 * 0.1);
    const spread = sigma * ZONE.halfW * view.s0 * 1.3;
    ctx.strokeStyle = color || '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(r + 4, spread), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y);
    ctx.lineTo(p.x + r, p.y);
    ctx.moveTo(p.x, p.y - r);
    ctx.lineTo(p.x, p.y + r);
    ctx.stroke();
  }

  function drawHint(ctx, px, py, alpha) {
    const p = zoneToScreen(px, py);
    const r = Math.max(9, view.s0 * 0.16);
    ctx.strokeStyle = `rgba(255,236,140,${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawMitt(ctx, px, py, age) {
    const p = zoneToScreen(px, py);
    const r = Math.max(10, view.s0 * 0.24) * (1 + age * 0.4);
    ctx.globalAlpha = U.clamp(1 - age, 0, 1) * 0.9;
    ctx.fillStyle = '#7a4a2a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a341c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // st: { fieldColor, batColor, pitcherHand, batterHand, batterNum, pitcherRig, batterRig,
  //       ball: {x,y,z}|null, markers, aim, hint, mitt, aiming, flash }
  function draw(ctx, st) {
    drawStadium(ctx);
    if (st.pitcherRig) drawPitcher(ctx, st.pitcherRig, st.fieldColor, st.pitcherHand);
    const ballBehind = st.ball && st.ball.z > 2;
    drawZone(ctx, { aiming: st.aiming });
    if (st.markers) st.markers.forEach((m, i) => drawMarker(ctx, m, i + 1, i < st.markers.length - 1));
    if (st.hint) drawHint(ctx, st.hint.px, st.hint.py, st.hint.alpha);
    if (st.mitt) drawMitt(ctx, st.mitt.px, st.mitt.py, st.mitt.age);
    if (st.ball && ballBehind) {
      if (st.trail) drawTrail(ctx, st.trail);
      drawBall(ctx, st.ball.x, st.ball.y, st.ball.z, st.ballGlow);
    }
    if (st.batterRig) drawBatter(ctx, st.batterRig, st.batColor, st.batterHand, st.batterNum);
    if (st.ball && !ballBehind) {
      if (st.trail) drawTrail(ctx, st.trail);
      drawBall(ctx, st.ball.x, st.ball.y, st.ball.z, st.ballGlow);
    }
    if (st.aim) drawReticle(ctx, st.aim.px, st.aim.py, st.aim.sigma, st.aim.color);
    if (st.flash) {
      ctx.fillStyle = `rgba(255,255,255,${st.flash})`;
      ctx.fillRect(0, 0, view.W, view.H);
    }
  }

  BB.batView = { layout, draw, proj, zoneToWorld, screenToZone, zoneToScreen, view, ZONE, MOUND_Z, COLORS, shade };
})(typeof window !== 'undefined' ? window : globalThis);
