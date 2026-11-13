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
    skin: '#e8b48a',
    skin2: '#b97d55',
    pants: '#eef0f3',
    bat: '#d9a35f',
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
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
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

  // Pitcher facing the camera. phase: 0 set, 0..1 windup, >=1 follow-through.
  function drawPitcher(ctx, color, hand, phase, skin) {
    const base = proj(0, 0.8, MOUND_Z);
    const s = base.s;
    const x = base.x;
    const y = base.y;
    const dir = hand === 'L' ? -1 : 1; // throwing arm on screen left for a righty
    const p = U.clamp(phase, 0, 1.6);
    const lift = p > 0.15 && p < 0.75 ? Math.sin(((p - 0.15) / 0.6) * Math.PI) : 0;
    const stride = p >= 0.75 ? U.clamp((p - 0.75) / 0.25, 0, 1) : 0;
    const lean = stride * 0.35;
    const hipY = y - 3.1 * s + lift * 0.15 * s + stride * 0.35 * s;
    const pants = COLORS.pants;
    // Legs
    const plantX = x - dir * 0.55 * s;
    limb(ctx, plantX, y, x - dir * 0.3 * s, hipY, 0.55 * s, pants);
    const freeFootX = x + dir * (0.55 - stride * 0.2) * s;
    const freeFootY = y - lift * 2.0 * s + stride * 0.3 * s;
    limb(ctx, x + dir * 0.3 * s, hipY, freeFootX, freeFootY, 0.55 * s, pants);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(plantX - 0.35 * s, y - 0.2 * s, 0.7 * s, 0.25 * s);
    // Torso
    const shoulderY = hipY - 2.0 * s + lean * s;
    ctx.fillStyle = color;
    roundRect(ctx, x - 0.75 * s, shoulderY, 1.5 * s, hipY - shoulderY + 0.2 * s, 0.35 * s);
    ctx.fill();
    // Glove arm
    const gx = x + dir * 0.9 * s;
    const gy = shoulderY + (p < 0.75 ? 0.9 * s - lift * 0.4 * s : 0.6 * s);
    limb(ctx, x + dir * 0.6 * s, shoulderY + 0.3 * s, gx, gy, 0.42 * s, color);
    ctx.fillStyle = '#6b3f22';
    ctx.beginPath();
    ctx.arc(gx, gy, 0.42 * s, 0, Math.PI * 2);
    ctx.fill();
    // Throwing arm: down in the set, back during the windup, over the top at release.
    let ang;
    if (p <= 0.15) ang = Math.PI * 0.55;
    else if (p < 0.75) ang = U.lerp(Math.PI * 0.55, Math.PI * 1.1, (p - 0.15) / 0.6);
    else ang = U.lerp(Math.PI * 1.1, Math.PI * 2.2, U.clamp((p - 0.75) / 0.35, 0, 1));
    const sx = x - dir * 0.6 * s;
    const sy = shoulderY + 0.3 * s;
    const hx = sx - dir * Math.cos(ang) * 1.9 * s;
    const hy = sy - Math.sin(ang) * 1.9 * s;
    limb(ctx, sx, sy, hx, hy, 0.42 * s, color);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 0.22 * s, 0, Math.PI * 2);
    ctx.fill();
    // Head and cap
    const headY = shoulderY - 0.55 * s;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x, headY, 0.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(color, -0.12);
    ctx.beginPath();
    ctx.arc(x, headY - 0.1 * s, 0.52 * s, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 0.6 * s, headY - 0.12 * s, 1.2 * s, 0.16 * s);
    return { handX: hx, handY: hy };
  }

  // Batter seen from behind the plate. swing: null or progress 0..1.
  function drawBatter(ctx, color, hand, swing, num, skin) {
    const dir = hand === 'L' ? -1 : 1;
    const footP = proj(-dir * 2.35, 0, 0.4);
    const s = footP.s;
    const x = footP.x;
    const y = footP.y;
    const sp = swing == null ? 0 : U.clamp(swing, 0, 1);
    const twist = Math.sin(sp * Math.PI * 0.9);
    const pants = COLORS.pants;
    // Legs: wide stance
    const hipY = y - 3.0 * s;
    limb(ctx, x - 0.75 * s, y, x - 0.35 * s, hipY, 0.62 * s, pants);
    limb(ctx, x + 0.75 * s + dir * twist * 0.2 * s, y, x + 0.35 * s, hipY, 0.62 * s, pants);
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 1.15 * s, y - 0.22 * s, 0.75 * s, 0.3 * s);
    ctx.fillRect(x + 0.4 * s, y - 0.22 * s, 0.75 * s, 0.3 * s);
    // Torso (back to camera)
    const shoulderY = hipY - 2.3 * s;
    ctx.fillStyle = color;
    roundRect(ctx, x - 0.95 * s + dir * twist * 0.15 * s, shoulderY, 1.9 * s, hipY - shoulderY + 0.25 * s, 0.45 * s);
    ctx.fill();
    // Jersey number
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `700 ${Math.round(0.95 * s)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), x + dir * twist * 0.15 * s, shoulderY + 1.05 * s);
    // Bat: hands near the back shoulder, sweeps through the zone.
    let ang;
    // Angles in screen space for a right-handed batter (mirrored for lefties).
    const stance = -2.1; // up and back
    const contactA = 0.38; // barrel dips through the zone
    const finish = -1.3;
    if (sp < 0.45) ang = U.lerp(stance, contactA, U.easeInOut(sp / 0.45));
    else ang = U.lerp(contactA, finish - Math.PI * 0.6, U.easeOut((sp - 0.45) / 0.55));
    const handX = x + dir * U.lerp(0.4, 1.1, twist) * s;
    const handY = shoulderY + U.lerp(0.1, 1.7, twist) * s;
    // Arms
    limb(ctx, x + dir * 0.6 * s, shoulderY + 0.35 * s, handX, handY, 0.45 * s, color);
    limb(ctx, x - dir * 0.6 * s, shoulderY + 0.35 * s, handX, handY, 0.45 * s, shade(color, -0.1));
    const bx = Math.cos(ang) * dir;
    const by = Math.sin(ang);
    const L = 2.9 * s;
    ctx.strokeStyle = COLORS.bat;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.22 * s;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(handX + bx * L * 0.55, handY + by * L * 0.55);
    ctx.stroke();
    ctx.lineWidth = 0.34 * s;
    ctx.beginPath();
    ctx.moveTo(handX + bx * L * 0.5, handY + by * L * 0.5);
    ctx.lineTo(handX + bx * L, handY + by * L);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(handX, handY, 0.2 * s, 0, Math.PI * 2);
    ctx.fill();
    // Head with helmet
    const headY = shoulderY - 0.62 * s;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x, headY + 0.08 * s, 0.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(color, -0.18);
    ctx.beginPath();
    ctx.arc(x, headY, 0.58 * s, Math.PI * 0.95, Math.PI * 2.05);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - dir * 0.35 * s, headY + 0.1 * s, 0.3 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBall(ctx, x, y, z, glow) {
    const p = proj(x, y, z);
    const r = Math.max(2.4, 0.13 * p.s);
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

  // st: { fieldColor, batColor, pitcherHand, batterHand, batterNum, pitchPhase, swing,
  //       ball: {x,y,z}|null, markers, aim, hint, mitt, aiming, flash }
  function draw(ctx, st) {
    drawStadium(ctx);
    drawPitcher(ctx, st.fieldColor, st.pitcherHand, st.pitchPhase, st.pitcherSkin || COLORS.skin);
    const ballBehind = st.ball && st.ball.z > 2;
    drawZone(ctx, { aiming: st.aiming });
    if (st.markers) st.markers.forEach((m, i) => drawMarker(ctx, m, i + 1, i < st.markers.length - 1));
    if (st.hint) drawHint(ctx, st.hint.px, st.hint.py, st.hint.alpha);
    if (st.mitt) drawMitt(ctx, st.mitt.px, st.mitt.py, st.mitt.age);
    if (st.ball && ballBehind) drawBall(ctx, st.ball.x, st.ball.y, st.ball.z, st.ballGlow);
    drawBatter(ctx, st.batColor, st.batterHand, st.swing, st.batterNum, st.batterSkin || COLORS.skin);
    if (st.ball && !ballBehind) drawBall(ctx, st.ball.x, st.ball.y, st.ball.z, st.ballGlow);
    if (st.aim) drawReticle(ctx, st.aim.px, st.aim.py, st.aim.sigma, st.aim.color);
    if (st.flash) {
      ctx.fillStyle = `rgba(255,255,255,${st.flash})`;
      ctx.fillRect(0, 0, view.W, view.H);
    }
  }

  BB.batView = { layout, draw, proj, zoneToWorld, screenToZone, zoneToScreen, view, ZONE, MOUND_Z, COLORS, shade };
})(typeof window !== 'undefined' ? window : globalThis);
