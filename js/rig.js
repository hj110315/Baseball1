// Silhouette player rigs: a 2D skeleton posed with keyframes and inverse
// kinematics, blended smoothly between animations, drawn as a dark figure
// with team-color trim and a light rim highlight.
//
// Figure space is in feet: origin on the ground between the feet, +y up,
// +x to the right of the screen. Poses are authored for a right-handed player
// and mirrored for lefties at draw time.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;

  const BODY = '#1a1e28';
  const BODY_FAR = '#12151d';
  const RIM = 'rgba(232, 238, 247, 0.6)';

  // Bone lengths (feet)
  const L = { torso: 1.95, neck: 0.5, head: 0.36, upper: 1.02, fore: 0.98, thigh: 1.48, shin: 1.5, bat: 2.8 };

  // Numeric pose channels. Every pose is a plain object with these keys.
  const KEYS = ['hipX', 'hipY', 'lean', 'tw', 'headX', 'headY', 'hLx', 'hLy', 'hRx', 'hRy', 'fLx', 'fLy', 'fRx', 'fRy', 'bat', 'bl', 'toeL', 'toeR'];
  // Discrete channels: elbow and knee bend directions (+1 = counter-clockwise).
  const SIGNS = ['eL', 'eR', 'kL', 'kR'];

  function pose(base, over) {
    return Object.assign({}, base, over || {});
  }

  // ---------------------------------------------------------------------------
  // Interpolation
  // ---------------------------------------------------------------------------
  function lerpPose(a, b, u) {
    const out = {};
    for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * u;
    for (const k of SIGNS) out[k] = u < 0.5 ? a[k] : b[k];
    return out;
  }
  function catmull(p0, p1, p2, p3, u) {
    const u2 = u * u;
    const u3 = u2 * u;
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }
  // Smooth spline through keyframes [{t, p}] so motion never stops at a key.
  function sampleKeys(keys, t) {
    if (t <= keys[0].t) return keys[0].p;
    const n = keys.length;
    if (t >= keys[n - 1].t) return keys[n - 1].p;
    let i = 0;
    while (i < n - 2 && t > keys[i + 1].t) i++;
    const k1 = keys[i];
    const k2 = keys[i + 1];
    const k0 = keys[Math.max(0, i - 1)];
    const k3 = keys[Math.min(n - 1, i + 2)];
    const u = (t - k1.t) / Math.max(1e-6, k2.t - k1.t);
    const out = {};
    for (const k of KEYS) out[k] = catmull(k0.p[k], k1.p[k], k2.p[k], k3.p[k], u);
    for (const k of SIGNS) out[k] = u < 0.5 ? k1.p[k] : k2.p[k];
    return out;
  }

  // ---------------------------------------------------------------------------
  // Rig controller
  // ---------------------------------------------------------------------------
  class Rig {
    constructor(lib, start) {
      this.lib = lib;
      this.time = 0; // global clock for idle motion
      this.cur = null;
      this.play(start, 0);
    }
    play(name, blend, opts) {
      const anim = this.lib[name];
      if (!anim) return;
      this.from = this.cur ? Object.assign({}, this.cur) : null;
      this.blendDur = this.from ? (blend == null ? 0.25 : blend) : 0;
      this.blendT = 0;
      this.anim = anim;
      this.name = name;
      this.t = 0;
      this.opts = opts || {};
      this.update(0);
    }
    // Seconds left in a one-shot routine (0 for loops and held poses).
    remaining() {
      return this.anim.next ? Math.max(0, this.anim.dur - this.t) : 0;
    }
    busy() {
      return !!this.anim.next && this.t < this.anim.dur;
    }
    update(dt) {
      this.t += dt;
      this.time += dt;
      this.blendT += dt;
      if (this.anim.next && this.t >= this.anim.dur) {
        this.play(this.anim.next, 0.3);
        return;
      }
      let p = this.anim.keys ? sampleKeys(this.anim.keys, this.t) : this.anim.pose;
      if (this.anim.mod) p = this.anim.mod(Object.assign({}, p), this.t, this.opts);
      if (this.anim.idle) p = breathe(Object.assign({}, p), this.time, this.anim.idle);
      if (this.from && this.blendT < this.blendDur) p = lerpPose(this.from, p, U.easeInOut(this.blendT / this.blendDur));
      this.cur = p;
    }
  }

  // Additive breathing and sway so figures never freeze.
  function breathe(p, t, amt) {
    const b = Math.sin(t * 2.1) * 0.035 * amt;
    const sway = Math.sin(t * 0.9) * 0.03 * amt;
    p.hipY += b * 0.5;
    p.hipX += sway;
    p.headY += b;
    p.hLy += b * 0.8;
    p.hRy += b * 0.8;
    p.hLx += sway;
    p.hRx += sway;
    return p;
  }

  // ---------------------------------------------------------------------------
  // Skeleton solve
  // ---------------------------------------------------------------------------
  function ik(rootP, target, a, b, sign) {
    let dx = target.x - rootP.x;
    let dy = target.y - rootP.y;
    let d = Math.hypot(dx, dy) || 1e-6;
    dx /= d;
    dy /= d;
    d = U.clamp(d, Math.abs(a - b) + 0.02, a + b - 0.002);
    const cosA = U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const A = Math.acos(cosA) * (sign || 1);
    const c = Math.cos(A);
    const s = Math.sin(A);
    const mid = { x: rootP.x + (dx * c - dy * s) * a, y: rootP.y + (dx * s + dy * c) * a };
    const end = { x: rootP.x + dx * d, y: rootP.y + dy * d };
    return { mid, end };
  }

  function solve(p) {
    const up = { x: Math.sin(p.lean), y: Math.cos(p.lean) };
    const perp = { x: Math.cos(p.lean), y: -Math.sin(p.lean) };
    const hip = { x: p.hipX, y: p.hipY };
    const neck = { x: hip.x + up.x * L.torso, y: hip.y + up.y * L.torso };
    const sw = 0.16 + 0.52 * p.tw;
    const hw = 0.13 + 0.25 * p.tw;
    const sh = (side) => ({ x: neck.x + perp.x * sw * side - up.x * 0.14, y: neck.y + perp.y * sw * side - up.y * 0.14 });
    const hp = (side) => ({ x: hip.x + perp.x * hw * side, y: hip.y + perp.y * hw * side });
    const shL = sh(-1);
    const shR = sh(1);
    const hipL = hp(-1);
    const hipR = hp(1);
    const head = { x: neck.x + up.x * L.neck + p.headX, y: neck.y + up.y * L.neck + p.headY };
    const armL = ik(shL, { x: p.hLx, y: p.hLy }, L.upper, L.fore, p.eL);
    const armR = ik(shR, { x: p.hRx, y: p.hRy }, L.upper, L.fore, p.eR);
    const legL = ik(hipL, { x: p.fLx, y: p.fLy }, L.thigh, L.shin, p.kL);
    const legR = ik(hipR, { x: p.fRx, y: p.fRy }, L.thigh, L.shin, p.kR);
    return { up, perp, hip, neck, head, shL, shR, hipL, hipR, armL, armR, legL, legR };
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------
  function shade(hex, amt) {
    return BB.batView ? BB.batView.shade(hex, amt) : hex;
  }

  // Tapered limb between two points.
  function limb(ctx, T, a, b, w0, w1) {
    const A = T(a);
    const B = T(b);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / len;
    const ny = dx / len;
    const r0 = (w0 * T.s) / 2;
    const r1 = (w1 * T.s) / 2;
    ctx.beginPath();
    ctx.moveTo(A.x + nx * r0, A.y + ny * r0);
    ctx.lineTo(B.x + nx * r1, B.y + ny * r1);
    ctx.arc(B.x, B.y, r1, Math.atan2(ny, nx), Math.atan2(ny, nx) - Math.PI, true);
    ctx.lineTo(A.x - nx * r0, A.y - ny * r0);
    ctx.arc(A.x, A.y, r0, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) - Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }
  function disc(ctx, T, p, r) {
    const P = T(p);
    ctx.beginPath();
    ctx.arc(P.x, P.y, r * T.s, 0, Math.PI * 2);
    ctx.fill();
  }
  const along = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

  function drawArm(ctx, T, sh, arm, color, trim, far) {
    ctx.fillStyle = far ? BODY_FAR : color;
    limb(ctx, T, sh, arm.mid, 0.4, 0.31);
    limb(ctx, T, arm.mid, arm.end, 0.3, 0.22);
    disc(ctx, T, arm.end, 0.14);
    if (trim) {
      ctx.fillStyle = far ? shade(trim, -0.18) : trim;
      limb(ctx, T, sh, along(sh, arm.mid, 0.42), 0.43, 0.38);
    }
  }
  function drawLeg(ctx, T, hp, leg, toe, color, trim, far) {
    ctx.fillStyle = far ? BODY_FAR : color;
    limb(ctx, T, hp, leg.mid, 0.56, 0.42);
    limb(ctx, T, leg.mid, leg.end, 0.42, 0.28);
    // Shoe
    limb(ctx, T, { x: leg.end.x - toe * 0.15, y: leg.end.y }, { x: leg.end.x + toe, y: leg.end.y - 0.04 }, 0.26, 0.2);
    if (trim) {
      ctx.fillStyle = far ? shade(trim, -0.18) : trim;
      limb(ctx, T, along(leg.mid, leg.end, 0.55), along(leg.mid, leg.end, 0.9), 0.36, 0.3);
    }
  }
  function drawTorso(ctx, T, j, color) {
    const { shL, shR, hipL, hipR, neck, up } = j;
    const pts = [
      shL,
      { x: neck.x + up.x * 0.12, y: neck.y + up.y * 0.12 },
      shR,
      { x: hipR.x + j.perp.x * 0.06, y: hipR.y + j.perp.y * 0.06 },
      { x: hipL.x - j.perp.x * 0.06, y: hipL.y - j.perp.y * 0.06 },
    ];
    ctx.fillStyle = color;
    ctx.beginPath();
    const P0 = T(pts[0]);
    ctx.moveTo(P0.x, P0.y);
    const P1 = T(pts[1]);
    const P2 = T(pts[2]);
    ctx.quadraticCurveTo(P1.x, P1.y, P2.x, P2.y);
    for (let i = 3; i < pts.length; i++) {
      const P = T(pts[i]);
      ctx.lineTo(P.x, P.y);
    }
    ctx.closePath();
    ctx.fill();
    // Rounded shoulders
    disc(ctx, T, shL, 0.22);
    disc(ctx, T, shR, 0.22);
    // Neck
    limb(ctx, T, neck, j.head, 0.3, 0.26);
  }

  function drawBat(ctx, T, grip, ang, bl, color) {
    const len = L.bat * bl;
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    const knob = { x: grip.x - dir.x * 0.18, y: grip.y - dir.y * 0.18 };
    const mid = { x: grip.x + dir.x * len * 0.42, y: grip.y + dir.y * len * 0.42 };
    const tip = { x: grip.x + dir.x * len, y: grip.y + dir.y * len };
    ctx.fillStyle = color;
    limb(ctx, T, knob, mid, 0.1, 0.12);
    limb(ctx, T, mid, tip, 0.13, 0.21);
    disc(ctx, T, knob, 0.08);
    return { tip, mid };
  }

  // kind: 'pitcher' | 'batter'
  function drawFigure(ctx, T, p, o) {
    const j = solve(p);
    const team = o.color;
    // Pass 1: rim light (offset toward the light, upper right)
    const r = Math.max(1, T.s * 0.035);
    const passes = [
      { dx: r, dy: -r, body: RIM, trim: null, far: false, rim: true },
      { dx: 0, dy: 0, body: BODY, trim: team, far: true, rim: false },
    ];
    // Ground shadow
    const g0 = T({ x: (p.fLx + p.fRx) / 2, y: Math.min(p.fLy, p.fRy) });
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(g0.x, g0.y + 0.04 * T.s, (Math.abs(p.fRx - p.fLx) / 2 + 0.55) * T.s, 0.28 * T.s, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const pass of passes) {
      const PT = (q) => {
        const s = T(q);
        return { x: s.x + pass.dx, y: s.y + pass.dy };
      };
      PT.s = T.s;
      const body = pass.body;
      const far = pass.far && !pass.rim;
      const trim = pass.rim ? null : team;
      // Far side first.
      const farArm = o.farArm || 'R';
      const farLeg = o.farLeg || farArm;
      if (o.kind === 'batter' && o.batBehind && !pass.rim) drawBat(ctx, PT, { x: p.hLx, y: p.hLy }, p.bat, p.bl, o.batColor);
      if (o.kind === 'batter' && o.batBehind && pass.rim) drawBat(ctx, PT, { x: p.hLx, y: p.hLy }, p.bat, p.bl, RIM);
      drawLeg(ctx, PT, farLeg === 'L' ? j.hipL : j.hipR, farLeg === 'L' ? j.legL : j.legR, (farLeg === 'L' ? p.toeL : p.toeR), body, trim, far);
      drawArm(ctx, PT, farArm === 'L' ? j.shL : j.shR, farArm === 'L' ? j.armL : j.armR, body, trim, far);
      if (o.glove === farArm) drawGlove(ctx, PT, farArm === 'L' ? j.armL.end : j.armR.end, pass.rim ? RIM : '#2a1f17');
      drawTorso(ctx, PT, j, body);
      if (!pass.rim) drawTorsoTrim(ctx, PT, j, p, team, o);
      drawLeg(ctx, PT, farLeg === 'L' ? j.hipR : j.hipL, farLeg === 'L' ? j.legR : j.legL, (farLeg === 'L' ? p.toeR : p.toeL), body, trim, false);
      ctx.fillStyle = body;
      disc(ctx, PT, j.head, L.head);
      if (!pass.rim) drawHeadgear(ctx, PT, j, p, team, o);
      drawArm(ctx, PT, farArm === 'L' ? j.shR : j.shL, farArm === 'L' ? j.armR : j.armL, body, trim, false);
      if (o.glove && o.glove !== farArm) drawGlove(ctx, PT, o.glove === 'L' ? j.armL.end : j.armR.end, pass.rim ? RIM : '#2a1f17');
      if (o.ball) {
        ctx.fillStyle = pass.rim ? RIM : '#f4f1ea';
        disc(ctx, PT, o.ball === 'L' ? j.armL.end : j.armR.end, 0.12);
      }
      if (o.kind === 'batter' && !o.batBehind) {
        const res = drawBat(ctx, PT, { x: p.hLx, y: p.hLy }, p.bat, p.bl, pass.rim ? RIM : o.batColor);
        if (!pass.rim) {
          // Hands over the grip
          ctx.fillStyle = BODY;
          disc(ctx, PT, { x: p.hLx, y: p.hLy }, 0.15);
          disc(ctx, PT, { x: p.hRx, y: p.hRy }, 0.15);
          o.batTip = res.tip;
        }
      }
    }
    return j;
  }

  function drawGlove(ctx, T, at, color) {
    const P = T(at);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(P.x, P.y, 0.3 * T.s, 0.36 * T.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTorsoTrim(ctx, T, j, p, team, o) {
    // Belt
    ctx.fillStyle = team;
    const bl = { x: j.hipL.x - j.perp.x * 0.05 + j.up.x * 0.12, y: j.hipL.y - j.perp.y * 0.05 + j.up.y * 0.12 };
    const br = { x: j.hipR.x + j.perp.x * 0.05 + j.up.x * 0.12, y: j.hipR.y + j.perp.y * 0.05 + j.up.y * 0.12 };
    limb(ctx, T, bl, br, 0.13, 0.13);
    // Number on the back (batter) or a chest stripe (pitcher facing us)
    if (p.tw > 0.55) {
      const c = { x: j.hip.x + j.up.x * 1.15, y: j.hip.y + j.up.y * 1.15 };
      const C = T(c);
      if (o.number != null) {
        ctx.save();
        ctx.translate(C.x, C.y);
        ctx.rotate(p.lean * (o.mirror || 1));
        ctx.fillStyle = team;
        ctx.globalAlpha = U.clamp((p.tw - 0.55) * 4, 0, 1);
        ctx.font = `800 ${Math.round(0.85 * T.s)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(o.number), 0, 0);
        ctx.restore();
      } else {
        ctx.globalAlpha = U.clamp((p.tw - 0.55) * 4, 0, 1);
        const a = { x: c.x - j.perp.x * 0.32 + j.up.x * 0.25, y: c.y - j.perp.y * 0.32 + j.up.y * 0.25 };
        const b = { x: c.x + j.perp.x * 0.32 + j.up.x * 0.38, y: c.y + j.perp.y * 0.32 + j.up.y * 0.38 };
        limb(ctx, T, a, b, 0.1, 0.1);
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawHeadgear(ctx, T, j, p, team, o) {
    const H = T(j.head);
    const r = L.head * T.s;
    const tilt = p.lean;
    ctx.save();
    ctx.translate(H.x, H.y);
    ctx.scale(o.mirror || 1, 1);
    ctx.rotate(tilt);
    ctx.fillStyle = team;
    if (o.kind === 'batter') {
      // Batting helmet: covers the top and back of the head, with an ear flap.
      ctx.beginPath();
      ctx.arc(0, -r * 0.05, r * 1.12, Math.PI * 0.92, Math.PI * 2.08);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-r * 0.55, r * 0.15, r * 0.42, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(r * 0.1, -r * 0.45, r * 0.5, Math.PI * 1.15, Math.PI * 1.6);
      ctx.lineTo(r * 0.1, -r * 0.45);
      ctx.fill();
    } else {
      // Cap: crown plus a brim that points where the pitcher is facing.
      ctx.beginPath();
      ctx.arc(0, -r * 0.08, r * 1.04, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
      ctx.fill();
      const face = o.facing == null ? 0 : o.facing; // -1 left, 0 toward us, 1 right
      ctx.fillStyle = shade(team, -0.15);
      if (Math.abs(face) > 0.5) {
        ctx.beginPath();
        ctx.ellipse(face * r * 1.05, -r * 0.1, r * 0.6, r * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.05, r * 1.0, r * 0.2, 0, 0, Math.PI);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Pitcher animations (right-handed: throwing hand = hL on screen-left
  // when facing us; glove = hR).
  // ---------------------------------------------------------------------------
  const P_BASE = {
    hipX: 0, hipY: 2.95, lean: 0, tw: 1, headX: 0, headY: 0,
    hLx: -0.5, hLy: 2.7, hRx: 0.55, hRy: 2.55, fLx: -0.45, fLy: 0, fRx: 0.45, fRy: 0,
    bat: 0, bl: 1, toeL: 0.25, toeR: 0.25, eL: -1, eR: 1, kL: 1, kR: -1,
  };
  const P_SIGN = pose(P_BASE, { hipY: 2.82, headY: -0.12, lean: 0.04, hLx: -0.35, hLy: 2.75, hRx: 0.62, hRy: 2.35 });
  const P_SET = pose(P_BASE, { hipY: 2.96, hLx: -0.08, hLy: 3.95, hRx: 0.1, hRy: 4.0, eL: 1, eR: -1 });
  const P_PIVOT = pose(P_SET, { tw: 0.55, hipX: 0.05, hLx: -0.05, hLy: 4.15, hRx: 0.05, hRy: 4.2, fRx: 0.2, fRy: 0.08, toeL: -0.3, toeR: -0.35, kL: -1, kR: -1 });
  const P_KICK = pose(P_PIVOT, {
    tw: 0.3, hipX: 0.12, hipY: 3.05, hLx: 0.05, hLy: 4.05, hRx: 0.0, hRy: 4.1, eL: 1, eR: 1,
    fLx: 0.0, fLy: 0, fRx: -0.35, fRy: 1.55, toeL: -0.5, toeR: -0.45, kL: -1, kR: -1,
  });
  const P_STRIDE = pose(P_KICK, {
    tw: 0.38, hipX: -0.15, hipY: 2.72, lean: 0.05,
    hLx: 1.15, hLy: 3.2, hRx: -1.05, hRy: 3.9, eL: 1, eR: -1,
    fLx: 0.1, fLy: 0.02, fRx: -0.95, fRy: 0.35, toeR: -0.55,
  });
  const P_COCK = pose(P_STRIDE, {
    tw: 0.62, hipX: -0.05, hipY: 2.55, lean: 0.1, headX: 0.05,
    hLx: -0.25, hLy: 5.75, hRx: -0.8, hRy: 3.75, eL: -1, eR: 1,
    fLx: -0.15, fLy: 0.12, fRx: 0.25, fRy: -0.55, toeL: -0.3, toeR: 0.25, kL: 1, kR: -1,
  });
  // Release point roughly matches where the ball starts in the 3D view.
  const P_RELEASE = pose(P_COCK, {
    tw: 1, hipX: 0.05, hipY: 2.5, lean: 0.2, headX: 0.12, headY: -0.05,
    hLx: -1.55, hLy: 5.2, hRx: 0.55, hRy: 3.75, eL: -1, eR: 1,
    fLx: -0.35, fLy: 0.25, fRx: 0.35, fRy: -0.6, toeL: 0.15, toeR: 0.25,
  });
  const P_FOLLOW = pose(P_RELEASE, {
    hipX: 0.15, hipY: 2.3, lean: 0.32, headX: 0.15, headY: -0.15,
    hLx: 0.6, hLy: 1.75, hRx: 0.75, hRy: 3.2, eL: 1, eR: 1,
    fLx: -0.95, fLy: 0.75, fRx: 0.38, fRy: -0.6, toeL: -0.3, kL: 1, kR: -1,
  });
  const P_FIELD = pose(P_BASE, {
    hipX: 0.05, hipY: 2.55, lean: 0.05, headY: -0.05,
    hLx: -0.38, hLy: 3.0, hRx: 0.42, hRy: 3.1, eL: -1, eR: 1,
    fLx: -0.6, fLy: -0.35, fRx: 0.55, fRy: -0.55, kL: -1, kR: 1,
  });

  const WINDUP = 0.85; // seconds from the start of the windup to release (main.js matches)
  const W = WINDUP; // windup keyframes below are written as fractions of it
  const PITCHER = {
    sign: { pose: P_SIGN, idle: 1 },
    set: { pose: P_SET, idle: 0.6 },
    windup: {
      keys: [
        { t: 0, p: P_SET },
        { t: 0.16 * W, p: P_SET },
        { t: 0.34 * W, p: P_PIVOT },
        { t: 0.52 * W, p: P_KICK },
        { t: 0.7 * W, p: P_STRIDE },
        { t: 0.86 * W, p: P_COCK },
        { t: W, p: P_RELEASE },
        { t: W + 0.17, p: P_FOLLOW },
        { t: W + 0.5, p: P_FIELD },
      ],
    },
    field: { pose: P_FIELD, idle: 0.5 },
  };

  // ---------------------------------------------------------------------------
  // Batter animations (right-handed, facing the plate to the right, seen from
  // behind). The bat is held at hL; hR is the top hand.
  // ---------------------------------------------------------------------------
  const B_STANCE = {
    hipX: 0, hipY: 2.78, lean: 0.12, tw: 0.75, headX: 0.08, headY: 0,
    hLx: -0.5, hLy: 4.55, hRx: -0.42, hRy: 4.68, fLx: -0.95, fLy: 0, fRx: 0.95, fRy: 0,
    bat: 1.85, bl: 1, toeL: 0.38, toeR: 0.4, eL: 1, eR: 1, kL: 1, kR: 1,
  };
  const B_GATHER = pose(B_STANCE, { hipX: -0.12, hLx: -0.78, hLy: 4.68, hRx: -0.7, hRy: 4.8, bat: 2.0, fRx: 0.75, fRy: 0.32, lean: 0.06 });
  const B_LAUNCH = pose(B_STANCE, { hipX: 0.05, hipY: 2.66, hLx: -0.72, hLy: 4.45, hRx: -0.64, hRy: 4.58, bat: 1.98, fRx: 1.2, fRy: 0, lean: 0.1 });
  const B_SLOT = pose(B_LAUNCH, { tw: 0.85, hipX: 0.12, hipY: 2.6, hLx: -0.3, hLy: 3.95, hRx: -0.18, hRy: 4.0, bat: 3.35, lean: 0.12, fLx: -0.9, fLy: 0.06 });
  const B_CONTACT = pose(B_LAUNCH, {
    tw: 1, hipX: 0.22, hipY: 2.55, lean: 0.16, headX: 0.12, headY: -0.05,
    hLx: 0.45, hLy: 3.3, hRx: 0.6, hRy: 3.32, bat: 6.08, bl: 1, eL: 1, eR: 1,
    fLx: -0.82, fLy: 0.14, toeL: 0.2, fRx: 1.2, fRy: 0,
  });
  const B_EXTEND = pose(B_CONTACT, { hLx: 0.95, hLy: 3.75, hRx: 1.05, hRy: 3.8, bat: 6.85, bl: 0.68, lean: 0.12 });
  const B_FOLLOW = pose(B_CONTACT, { hLx: 0.6, hLy: 4.85, hRx: 0.68, hRy: 4.9, bat: 8.0, bl: 0.82, lean: 0.04, headX: 0.15, eL: -1, eR: -1 });
  const B_FINISH = pose(B_FOLLOW, { hLx: 0.3, hLy: 4.95, hRx: 0.38, hRy: 5.0, bat: 9.15, bl: 0.92, hipX: 0.18, hipY: 2.62, fLx: -0.55, fLy: 0.28, toeL: 0.15 });
  const SWING_CONTACT = 0.04; // seconds from the tap to bat-on-ball (main.js matches)
  // Where the barrel's sweet spot sits at contact (2.2 ft up the bat from the hands).
  const SWEET_X = B_CONTACT.hLx + Math.cos(B_CONTACT.bat) * 2.2;

  const B_WALK0 = pose(B_STANCE, {
    hipX: -2.4, hipY: 2.95, lean: 0.03, tw: 0.6, headX: 0.04,
    hLx: -1.95, hLy: 3.3, hRx: -2.75, hRy: 3.35, bat: -1.15, bl: 0.95, eL: -1, eR: 1,
    fLx: -2.8, fLy: 0, fRx: -2.0, fRy: 0,
  });
  const B_WALK1 = pose(B_WALK0, { hipX: -1.8, hipY: 3.0, fLx: -2.0, fLy: 0.35, hLx: -1.4 });
  const B_WALK2 = pose(B_WALK0, { hipX: -1.2, fLx: -1.4, fLy: 0, fRx: -0.9, fRy: 0.3, hLx: -0.8, hRx: -1.6 });
  const B_INBOX = pose(B_STANCE, { hipX: -0.25, hipY: 2.9, lean: 0.2, tw: 0.65, hLx: 0.35, hLy: 3.0, hRx: 0.45, hRy: 3.05, bat: -0.95, fLx: -0.95, fRx: 0.5, eL: 1, eR: 1 });
  const B_TAP = pose(B_INBOX, { hLy: 2.8, hRy: 2.85, bat: -0.85, lean: 0.26 });
  const B_RAISE = pose(B_STANCE, { hLx: -0.2, hLy: 4.2, hRx: -0.12, hRy: 4.3, bat: 1.55, tw: 0.7 });

  const B_OUT = pose(B_STANCE, { hipX: -0.75, hipY: 2.95, lean: 0.02, tw: 0.55, fLx: -1.55, fRx: 0.25, hLx: -0.35, hLy: 3.2, hRx: -0.1, hRy: 3.5, bat: -1.45, bl: 0.95, eL: -1, eR: 1 });
  const B_HELMET = pose(B_OUT, { hRx: -0.55, hRy: 5.15, headY: -0.04, eR: 1 });
  const B_GLOVES = pose(B_OUT, { hRx: -0.15, hRy: 3.45, hLy: 3.3 });
  const B_GLOVES2 = pose(B_GLOVES, { hRx: -0.05, hRy: 3.35 });

  const BATTER = {
    stance: {
      pose: B_STANCE,
      idle: 1,
      // Bat waggle: small circles with the hands and a rocking barrel.
      mod(p, t) {
        const w = Math.sin(t * 4.6);
        const w2 = Math.cos(t * 4.6);
        p.bat += w * 0.12;
        p.hLx += w2 * 0.05;
        p.hRx += w2 * 0.05;
        p.hLy += w * 0.04;
        p.hRy += w * 0.04;
        return p;
      },
    },
    load: {
      // Timed from the start of the windup: gather, small leg lift, stride, hold.
      keys: [
        { t: 0, p: B_STANCE },
        { t: 0.5 * W, p: B_STANCE },
        { t: 0.82 * W, p: B_GATHER },
        { t: W, p: pose(B_GATHER, { fRy: 0.38 }) },
        { t: W + 0.2, p: B_LAUNCH },
      ],
    },
    swing: {
      keys: [
        { t: 0, p: B_LAUNCH },
        { t: SWING_CONTACT * 0.45, p: B_SLOT },
        // Barrel comes around toward the camera: short and pointing down on screen.
        { t: SWING_CONTACT * 0.78, p: pose(B_SLOT, { tw: 0.95, hipX: 0.18, hLx: 0.05, hLy: 3.5, hRx: 0.18, hRy: 3.55, bat: 4.75, bl: 0.38, lean: 0.15 }) },
        { t: SWING_CONTACT, p: B_CONTACT },
        { t: 0.1, p: B_EXTEND },
        { t: 0.2, p: B_FOLLOW },
        { t: 0.34, p: B_FINISH },
      ],
      // Steer the barrel's sweet spot onto the pitch at contact.
      // o.ballX / o.ballY: where the pitch crosses the plate, in figure space.
      mod(p, t, o) {
        if (o.ballY == null) return p;
        const w = Math.max(0, 1 - Math.abs(t - SWING_CONTACT) / 0.05);
        const dy = (o.ballY - 2.55) * 0.75;
        const dx = o.ballX == null ? 0 : U.clamp(o.ballX - SWEET_X, -1, 0.8);
        p.hLy += dy * w;
        p.hRy += dy * w;
        p.hLx += dx * w;
        p.hRx += dx * w;
        p.bat += (o.ballY - 2.55) * 0.12 * w;
        return p;
      },
    },
    enter: {
      dur: 1.6,
      next: 'stance',
      keys: [
        { t: 0, p: B_WALK0 },
        { t: 0.25, p: B_WALK1 },
        { t: 0.5, p: B_WALK2 },
        { t: 0.75, p: B_INBOX },
        { t: 0.9, p: B_TAP },
        { t: 1.02, p: B_INBOX },
        { t: 1.12, p: B_TAP },
        { t: 1.38, p: B_RAISE },
        { t: 1.6, p: B_STANCE },
      ],
    },
    adjust: {
      dur: 2.1,
      next: 'stance',
      keys: [
        { t: 0, p: B_STANCE },
        { t: 0.35, p: B_OUT },
        { t: 0.65, p: B_HELMET },
        { t: 0.9, p: B_HELMET },
        { t: 1.1, p: B_GLOVES },
        { t: 1.25, p: B_GLOVES2 },
        { t: 1.4, p: B_GLOVES },
        { t: 1.75, p: B_RAISE },
        { t: 2.1, p: B_STANCE },
      ],
    },
  };

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  function makePitcher() {
    return new Rig(PITCHER, 'sign');
  }
  function makeBatter() {
    return new Rig(BATTER, 'stance');
  }

  // T maps figure space to screen; mirror for lefties.
  function transform(ox, oy, s, mirror) {
    const T = (q) => ({ x: ox + q.x * s * mirror, y: oy - q.y * s });
    T.s = s;
    return T;
  }

  // Draw a pitcher. Lefties are drawn by mirroring the screen transform.
  function drawPitcher(ctx, rig, ox, oy, s, color, hand) {
    const m = hand === 'L' ? -1 : 1;
    const p = rig.cur;
    const T = transform(ox, oy, s, m);
    const inWindup = rig.name === 'windup';
    return drawFigure(ctx, T, p, {
      kind: 'pitcher',
      color,
      mirror: m,
      glove: 'R',
      farArm: inWindup && rig.t > 0.3 * W && rig.t < 0.95 * W ? 'L' : 'R',
      facing: p.tw < 0.5 ? -1 : 0,
      ball: inWindup && rig.t < WINDUP ? 'L' : null,
    });
  }

  function drawBatter(ctx, rig, ox, oy, s, color, hand, number) {
    const m = hand === 'L' ? -1 : 1;
    const T = transform(ox, oy, s, m);
    const o = { kind: 'batter', color, number, mirror: m, batColor: '#2b303c', farArm: 'R', farLeg: 'R', batBehind: false };
    drawFigure(ctx, T, rig.cur, o);
    return o;
  }

  BB.rig = { Rig, makePitcher, makeBatter, drawPitcher, drawBatter, WINDUP, SWING_CONTACT, solve, PITCHER, BATTER };
})(typeof window !== 'undefined' ? window : globalThis);
