// Silhouette player rigs: a 2D skeleton posed with keyframes and inverse
// kinematics, blended smoothly between animations, drawn as a dark figure
// with team-color trim and a light rim highlight.
//
// Figure space is in feet: origin on the ground between the feet, +y up,
// +x to the right of the screen. Poses are authored for a right-handed,
// athletic-build player and mirrored for lefties at draw time.
//
// Variety comes from the player's look (ARCHITECTURE.md "Looks"):
//   body      bone lengths, widths and how the pose sits on the frame
//   stance    batting stance, waggle and load
//   windup    leg kick, arm slot and tempo of the delivery
//   celebrate home run reaction
// and from small random changes every swing and pitch (Rig.rand).
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;

  const BODY = '#1a1e28';
  const BODY_FAR = '#12151d';
  const RIM = 'rgba(232, 238, 247, 0.6)';

  // Bone lengths (feet) for the athletic build.
  const L = { torso: 1.95, neck: 0.5, head: 0.36, upper: 1.02, fore: 0.98, thigh: 1.48, shin: 1.5, bat: 2.8 };

  // Body types. h: overall scale, leg/torso/arm: bone length ratios,
  // w: limb thickness, sh: shoulder width, waist/hip: torso shape,
  // head: head size, flex: how far the spine bends and twists.
  const BODIES = {
    athletic: { h: 1, leg: 1, torso: 1, arm: 1, w: 1, sh: 1.04, waist: 1, hip: 1, head: 1, flex: 1 },
    lean: { h: 1.01, leg: 1.02, torso: 0.99, arm: 1.02, w: 0.84, sh: 0.93, waist: 0.88, hip: 0.92, head: 0.98, flex: 1.12 },
    stocky: { h: 0.95, leg: 0.94, torso: 1.03, arm: 0.95, w: 1.24, sh: 1.12, waist: 1.36, hip: 1.14, head: 1.06, flex: 0.82 },
    tall: { h: 1.07, leg: 1.04, torso: 1.01, arm: 1.04, w: 0.95, sh: 1.0, waist: 0.96, hip: 0.98, head: 0.97, flex: 0.95 },
  };
  const DEFAULT_LOOK = { body: 'athletic', stance: 'upright', windup: 'classic', celebrate: 'admire' };
  const VALID = {
    body: BODIES,
    stance: { upright: 1, crouch: 1, open: 1, highHands: 1 },
    windup: { classic: 1, overTop: 1, sidearm: 1, highKick: 1 },
    celebrate: { flip: 1, point: 1, fist: 1, admire: 1 },
  };
  function normLook(look) {
    const out = {};
    for (const k in DEFAULT_LOOK) out[k] = look && VALID[k][look[k]] ? look[k] : DEFAULT_LOOK[k];
    return out;
  }

  // Numeric pose channels. Every pose is a plain object with these keys.
  //   hipX/hipY pelvis, lean torso angle (+ toward +x), tw shoulder turn
  //   (0 side-on, 1 square to the camera), sep extra hip turn (hip-shoulder
  //   separation), sp spine bend, headX/headY head offset, hT head tilt,
  //   lk look direction (-1 left .. 1 right, pitcher's cap brim), hand and
  //   foot targets, bat angle and length (foreshortening), gr top hand on the
  //   bat (0..1), toe lengths, and elbow/knee bend directions (-1..1).
  const KEYS = ['hipX', 'hipY', 'lean', 'tw', 'sep', 'sp', 'headX', 'headY', 'hT', 'lk', 'hLx', 'hLy', 'hRx', 'hRy',
    'fLx', 'fLy', 'fRx', 'fRy', 'bat', 'bl', 'gr', 'toeL', 'toeR', 'eL', 'eR', 'kL', 'kR'];
  const NK = KEYS.length;
  const ZERO = { sep: 0, sp: 0, hT: 0, lk: 0, gr: 0 };
  // Channel groups, used to stagger body parts in time (overlapping action).
  const GROUP = {
    hip: ['hipX', 'hipY', 'sep'],
    torso: ['lean', 'tw', 'sp'],
    head: ['headX', 'headY', 'hT', 'lk'],
    handL: ['hLx', 'hLy', 'eL'],
    handR: ['hRx', 'hRy', 'eR'],
    bat: ['bat', 'bl', 'gr'],
    footL: ['fLx', 'fLy', 'toeL', 'kL'],
    footR: ['fRx', 'fRy', 'toeR', 'kR'],
  };

  function pose(base, over) {
    const p = Object.assign({}, ZERO, base, over || {});
    return p;
  }
  function copyPose(p) {
    const o = {};
    for (let i = 0; i < NK; i++) o[KEYS[i]] = p[KEYS[i]];
    return o;
  }

  // ---------------------------------------------------------------------------
  // Interpolation
  // ---------------------------------------------------------------------------
  function lerpPose(a, b, u) {
    const out = {};
    for (let i = 0; i < NK; i++) {
      const k = KEYS[i];
      out[k] = a[k] + (b[k] - a[k]) * u;
    }
    return out;
  }
  function catmull(p0, p1, p2, p3, u) {
    const u2 = u * u;
    const u3 = u2 * u;
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }
  // Value of one channel at time t on a smooth spline through the keyframes,
  // so motion never stops dead at a key.
  function channelAt(keys, k, t) {
    const n = keys.length;
    if (t <= keys[0].t) return keys[0].p[k];
    if (t >= keys[n - 1].t) return keys[n - 1].p[k];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1].t) i++;
    const k1 = keys[i];
    const k2 = keys[i + 1];
    const k0 = keys[Math.max(0, i - 1)];
    const k3 = keys[Math.min(n - 1, i + 2)];
    const u = (t - k1.t) / Math.max(1e-6, k2.t - k1.t);
    return catmull(k0.p[k], k1.p[k], k2.p[k], k3.p[k], u);
  }
  // anim.lagArr staggers channels: positive values trail the keyframes,
  // negative values lead them (hips start the swing before the hands).
  function sampleAnim(a, t) {
    const out = {};
    if (!a.keys) {
      for (let i = 0; i < NK; i++) out[KEYS[i]] = a.pose[KEYS[i]];
      return out;
    }
    const lag = a.lagArr;
    for (let i = 0; i < NK; i++) out[KEYS[i]] = channelAt(a.keys, KEYS[i], lag ? t - lag[i] : t);
    return out;
  }
  function lagArray(lag) {
    if (!lag) return null;
    const arr = new Float64Array(NK);
    for (const g in lag) for (const k of GROUP[g]) arr[KEYS.indexOf(k)] = lag[g];
    return arr;
  }
  // Finalize an animation description: fill poses and build the lag table.
  function anim(def) {
    if (def.keys) def.keys = def.keys.map((k) => ({ t: k.t, p: pose(k.p) }));
    if (def.pose) def.pose = pose(def.pose);
    def.lagArr = lagArray(def.lag);
    if (def.keys && def.dur == null) def.dur = def.keys[def.keys.length - 1].t;
    return def;
  }

  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  // 0 outside [a, d], 1 inside [b, c], smooth ramps between.
  const window4 = (t, a, b, c, d) => (t < b ? smooth((t - a) / Math.max(1e-6, b - a)) : 1 - smooth((t - c) / Math.max(1e-6, d - c)));

  // ---------------------------------------------------------------------------
  // Rig controller
  // ---------------------------------------------------------------------------
  // Animations that may wait while a reaction finishes.
  const PASSIVE = { sign: 1, set: 1, stance: 1, field: 1 };

  class Rig {
    constructor(kind, look) {
      this.kind = kind; // 'pitcher' | 'batter'
      this.time = Math.random() * 20; // global clock for idle motion
      this.rand = Math.random; // per-swing / per-pitch variation (seed it for contact sheets)
      this.cur = null;
      this.prop = null; // a bat that has left the hands (flip or drop)
      this.queued = null;
      this.dust = null; // dirt kicked up by a frustrated pitcher
      this.phase = Math.random() * 6; // desyncs idle motion between players
      this.libKey = '';
      this.setLook(look, true);
      this.play(kind === 'batter' ? 'stance' : 'sign', 0);
    }
    setLook(look, init) {
      const lk = normLook(look);
      const key = this.kind === 'batter' ? lk.body + '|' + lk.stance + '|' + lk.celebrate : lk.body + '|' + lk.windup;
      this.look = lk;
      this.body = BODIES[lk.body];
      if (key === this.libKey) return;
      this.libKey = key;
      this.lib = (this.kind === 'batter' ? batterLib : pitcherLib)(lk, this.body);
      if (!init && this.name) {
        // Same routine, new player: rebuild it from the new look in place.
        const a = this.lib[this.name];
        if (a) {
          this.anim = a.build ? a.build(this, this.opts) : a;
          this.update(0);
        }
      }
    }
    // force: start even while a reaction holds the stage.
    play(name, blend, opts, force) {
      let a = this.lib[name];
      if (!a) return;
      // A reaction holds the stage: idle poses wait until it is done.
      if (!force && this.anim && this.anim.lock && this.t < this.anim.dur && PASSIVE[name]) {
        this.queued = { name, blend };
        return;
      }
      this.queued = null;
      this.opts = opts || {};
      if (a.build) a = a.build(this, this.opts);
      this.from = this.cur ? copyPose(this.cur) : null;
      this.blendDur = this.from ? (blend == null ? 0.25 : blend) : 0;
      this.blendT = 0;
      this.anim = a;
      this.name = name;
      this.t = 0;
      this.dropped = false;
      this.dusted = false;
      if (!a.keepProp) this.prop = null;
      this.update(0);
    }
    // Seconds left in a one-shot routine (0 for loops and held poses).
    remaining() {
      return this.anim.next ? Math.max(0, this.anim.dur - this.t) : 0;
    }
    busy() {
      return !!this.anim.next && this.t < this.anim.dur;
    }
    // True while a reaction (celebration, frustration...) is playing.
    reacting() {
      return !!this.anim.lock && this.t < this.anim.dur;
    }
    update(dt) {
      this.t += dt;
      this.time += dt;
      this.blendT += dt;
      const a = this.anim;
      if (a.next && this.t >= a.dur) {
        const q = this.queued;
        this.queued = null;
        this.play(q ? q.name : a.next, q ? Math.max(0.3, q.blend || 0) : a.outBlend == null ? 0.3 : a.outBlend);
        return;
      }
      let p = sampleAnim(a, this.t);
      if (a.mod) p = a.mod(p, this.t, this.opts, this) || p;
      if (a.idle) breathe(p, this.time, a.idle);
      fitBody(p, this.body);
      if (this.from && this.blendT < this.blendDur) p = lerpPose(this.from, p, U.easeInOut(this.blendT / this.blendDur));
      this.cur = p;
      if (a.drop && !this.dropped && this.t >= a.drop.t) this.releaseBat(a.drop);
      if (this.prop) this.updateProp(dt);
      if (a.dust && !this.dusted && this.t >= a.dust.t) {
        this.dusted = true;
        this.dust = { x: p.fRx + 0.25, age: 0 };
      }
      if (this.dust) {
        this.dust.age += dt;
        if (this.dust.age > 0.8) this.dust = null;
      }
    }
    // The bat leaves the hands (flip or drop) and becomes a loose prop.
    releaseBat(d) {
      this.dropped = true;
      const p = this.cur;
      const len = L.bat * (p.bl || 1);
      this.prop = {
        x: p.hLx + Math.cos(p.bat) * len * 0.45,
        y: p.hLy + Math.sin(p.bat) * len * 0.45,
        ang: p.bat,
        vx: d.vx,
        vy: d.vy,
        spin: d.spin,
        bl: p.bl || 1,
        rest: false,
      };
    }
    updateProp(dt) {
      const b = this.prop;
      if (b.rest) return;
      b.vy -= 30 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ang += b.spin * dt;
      if (b.y < 0.12 && b.vy < 0) {
        // Bounce once, then lie flat on the dirt.
        if (Math.abs(b.vy) > 4) {
          b.vy = -b.vy * 0.25;
          b.vx *= 0.5;
          b.spin *= 0.4;
          b.y = 0.12;
        } else {
          b.y = 0.12;
          b.rest = true;
          const c = Math.cos(b.ang);
          b.ang = c >= 0 ? -0.06 : Math.PI + 0.06;
          b.bl = 1;
        }
      }
    }
  }

  // Additive breathing, sway and slow weight shifts so figures never freeze.
  function breathe(p, t, amt) {
    const b = Math.sin(t * 2.1) * 0.035 * amt;
    const sway = (Math.sin(t * 0.9) * 0.03 + Math.sin(t * 0.37 + 1.3) * 0.025) * amt;
    p.hipY += b * 0.5;
    p.hipX += sway;
    p.headY += b;
    p.hLy += b * 0.8;
    p.hRy += b * 0.8;
    p.hLx += sway;
    p.hRx += sway;
    p.lean += sway * 0.12;
    return p;
  }

  // Poses are authored for the athletic build. Other bodies keep the same
  // feet but move the hips with leg length and the upper body with the torso.
  function fitBody(p, B) {
    if (B.leg === 1 && B.torso === 1) return p;
    const hip0 = p.hipY;
    const hip1 = hip0 * B.leg;
    const up = B.torso * (0.5 + 0.5 * B.arm);
    p.hipY = hip1;
    p.hLy = hip1 + (p.hLy - hip0) * up;
    p.hRy = hip1 + (p.hRy - hip0) * up;
    if (p.fLy > 0.05) p.fLy *= B.leg;
    if (p.fRy > 0.05) p.fRy *= B.leg;
    return p;
  }

  // ---------------------------------------------------------------------------
  // Skeleton solve
  // ---------------------------------------------------------------------------
  // Two-bone IK. sign (-1..1) picks the bend direction; values between the
  // extremes straighten the joint so a flip between keys never pops.
  function ik(rootP, target, a, b, sign) {
    let dx = target.x - rootP.x;
    let dy = target.y - rootP.y;
    let d = Math.hypot(dx, dy) || 1e-6;
    dx /= d;
    dy /= d;
    d = U.clamp(d, Math.abs(a - b) + 0.02, a + b - 0.002);
    const cosA = U.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const s = U.clamp(sign == null ? 1 : sign, -1, 1);
    const A = Math.acos(cosA) * (Math.sign(s) || 1) * smooth(Math.abs(s) * 1.6);
    const c = Math.cos(A);
    const sn = Math.sin(A);
    const mid = { x: rootP.x + (dx * c - dy * sn) * a, y: rootP.y + (dx * sn + dy * c) * a };
    const end = { x: rootP.x + dx * d, y: rootP.y + dy * d };
    return { mid, end };
  }

  function solve(p, B) {
    B = B || BODIES.athletic;
    const flex = B.flex;
    const sp = (p.sp || 0) * flex;
    const a0 = p.lean - sp * 0.5; // lower spine
    const a1 = p.lean + sp * 0.5; // upper spine
    const torso = L.torso * B.torso;
    const up0 = { x: Math.sin(a0), y: Math.cos(a0) };
    const up = { x: Math.sin(a1), y: Math.cos(a1) };
    const perp = { x: Math.cos(a1), y: -Math.sin(a1) };
    const perp0 = { x: Math.cos(a0), y: -Math.sin(a0) };
    const hip = { x: p.hipX, y: p.hipY };
    const mid = { x: hip.x + up0.x * torso * 0.5, y: hip.y + up0.y * torso * 0.5 };
    const neck = { x: mid.x + up.x * torso * 0.5, y: mid.y + up.y * torso * 0.5 };
    const tw = U.clamp(p.tw, 0, 1);
    const htw = U.clamp(p.tw + (p.sep || 0) * flex, 0, 1);
    const sw = (0.16 + 0.52 * tw) * B.sh;
    const hw = (0.13 + 0.25 * htw) * B.hip;
    const shL = { x: neck.x - perp.x * sw - up.x * 0.14, y: neck.y - perp.y * sw - up.y * 0.14 };
    const shR = { x: neck.x + perp.x * sw - up.x * 0.14, y: neck.y + perp.y * sw - up.y * 0.14 };
    const hipL = { x: hip.x - perp0.x * hw, y: hip.y - perp0.y * hw };
    const hipR = { x: hip.x + perp0.x * hw, y: hip.y + perp0.y * hw };
    const head = { x: neck.x + up.x * L.neck + p.headX, y: neck.y + up.y * L.neck + p.headY };
    const ua = L.upper * B.arm;
    const fa = L.fore * B.arm;
    const th = L.thigh * B.leg;
    const sh = L.shin * B.leg;
    // Top hand rides the bat handle when gripping (gr = 1).
    let hR = { x: p.hRx, y: p.hRy };
    if (p.gr > 0) {
      const g = U.clamp(p.gr, 0, 1);
      const gx = p.hLx + Math.cos(p.bat) * 0.33 * (p.bl || 1);
      const gy = p.hLy + Math.sin(p.bat) * 0.33 * (p.bl || 1);
      hR = { x: hR.x + (gx - hR.x) * g, y: hR.y + (gy - hR.y) * g };
    }
    const armL = ik(shL, { x: p.hLx, y: p.hLy }, ua, fa, p.eL);
    const armR = ik(shR, hR, ua, fa, p.eR);
    const legL = ik(hipL, { x: p.fLx, y: p.fLy }, th, sh, p.kL);
    const legR = ik(hipR, { x: p.fRx, y: p.fRy }, th, sh, p.kR);
    return { up, perp, up0, perp0, hip, mid, neck, head, shL, shR, hipL, hipR, armL, armR, legL, legR, sw, hw, hR };
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------
  function shade(hex, amt) {
    return BB.batView ? BB.batView.shade(hex, amt) : hex;
  }
  const SCR = new Float64Array(48);
  // Smooth bump: 0 at both ends, 1 at `at`.
  function bump(u, at) {
    const s = u <= at ? Math.sin((Math.PI / 2) * (u / at)) : Math.sin((Math.PI / 2) * ((1 - u) / (1 - at)));
    return s * s;
  }
  // Organic limb segment from a to b (figure space): radius r0 at a, r1 at b,
  // plus a muscle bulge m peaking at `at` along the bone. u0..u1 draws part
  // of it (sleeves, socks); caps: 1 rounds the start, 2 the end.
  function bone(ctx, T, a, b, r0, r1, m, at, u0, u1, caps) {
    const A = T(a);
    const Bq = T(b);
    let dx = Bq.x - A.x;
    let dy = Bq.y - A.y;
    const len = Math.hypot(dx, dy) || 1e-6;
    dx /= len;
    dy /= len;
    const nx = -dy;
    const ny = dx;
    const s = T.s;
    const N = 4;
    if (u0 == null) u0 = 0;
    if (u1 == null) u1 = 1;
    if (caps == null) caps = 3;
    for (let i = 0; i <= N; i++) {
      const u = u0 + ((u1 - u0) * i) / N;
      const r = (r0 + (r1 - r0) * u + m * bump(u, at)) * s;
      const px = A.x + dx * len * u;
      const py = A.y + dy * len * u;
      SCR[i * 4] = px + nx * r;
      SCR[i * 4 + 1] = py + ny * r;
      SCR[i * 4 + 2] = px - nx * r;
      SCR[i * 4 + 3] = py - ny * r;
    }
    ctx.beginPath();
    ctx.moveTo(SCR[0], SCR[1]);
    for (let i = 1; i < N; i++) {
      ctx.quadraticCurveTo(SCR[i * 4], SCR[i * 4 + 1], (SCR[i * 4] + SCR[i * 4 + 4]) / 2, (SCR[i * 4 + 1] + SCR[i * 4 + 5]) / 2);
    }
    ctx.lineTo(SCR[N * 4], SCR[N * 4 + 1]);
    if (caps & 2) {
      const cx = (SCR[N * 4] + SCR[N * 4 + 2]) / 2;
      const cy = (SCR[N * 4 + 1] + SCR[N * 4 + 3]) / 2;
      const a0 = Math.atan2(SCR[N * 4 + 1] - cy, SCR[N * 4] - cx);
      ctx.arc(cx, cy, Math.hypot(SCR[N * 4] - cx, SCR[N * 4 + 1] - cy), a0, a0 - Math.PI, true);
    } else ctx.lineTo(SCR[N * 4 + 2], SCR[N * 4 + 3]);
    for (let i = N - 1; i > 0; i--) {
      ctx.quadraticCurveTo(SCR[i * 4 + 2], SCR[i * 4 + 3], (SCR[i * 4 + 2] + SCR[i * 4 - 2]) / 2, (SCR[i * 4 + 3] + SCR[i * 4 - 1]) / 2);
    }
    ctx.lineTo(SCR[2], SCR[3]);
    if (caps & 1) {
      const cx = (SCR[0] + SCR[2]) / 2;
      const cy = (SCR[1] + SCR[3]) / 2;
      const a0 = Math.atan2(SCR[3] - cy, SCR[2] - cx);
      ctx.arc(cx, cy, Math.hypot(SCR[2] - cx, SCR[3] - cy), a0, a0 - Math.PI, true);
    }
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

  function drawArm(ctx, T, sh, arm, color, trim, far, B, fist) {
    const w = B.w;
    ctx.fillStyle = far ? BODY_FAR : color;
    bone(ctx, T, sh, arm.mid, 0.2 * w, 0.145 * w, 0.035 * w, 0.32);
    bone(ctx, T, arm.mid, arm.end, 0.145 * w, 0.1 * w, 0.03 * w, 0.28);
    // Hand: a little beyond the wrist along the forearm.
    const hx = arm.end.x + (arm.end.x - arm.mid.x) * 0.07;
    const hy = arm.end.y + (arm.end.y - arm.mid.y) * 0.07;
    disc(ctx, T, { x: hx, y: hy }, fist ? 0.135 : 0.125);
    if (trim) {
      ctx.fillStyle = far ? shade(trim, -0.18) : trim;
      bone(ctx, T, sh, arm.mid, 0.22 * w, 0.165 * w, 0.035 * w, 0.32, 0, 0.42, 1);
    }
  }
  function drawLeg(ctx, T, hp, leg, toe, color, trim, far, B) {
    const w = B.w;
    ctx.fillStyle = far ? BODY_FAR : color;
    bone(ctx, T, hp, leg.mid, 0.285 * w, 0.185 * w, 0.045 * w, 0.32);
    bone(ctx, T, leg.mid, leg.end, 0.185 * w, 0.105 * w, 0.055 * w, 0.26);
    // Shoe: heel to toe, sole on the ground line.
    const e = leg.end;
    bone(ctx, T, { x: e.x - toe * 0.18, y: e.y - 0.03 }, { x: e.x + toe, y: e.y - 0.07 }, 0.13, 0.095, 0.01, 0.4);
    if (trim) {
      ctx.fillStyle = far ? shade(trim, -0.18) : trim;
      bone(ctx, T, leg.mid, leg.end, 0.2 * w, 0.12 * w, 0.055 * w, 0.26, 0.52, 0.92, 0);
    }
  }

  // Torso along a curved spine (hips -> waist -> chest -> shoulders).
  const TS = [0, 0.3, 0.62, 0.86, 1];
  const TP = new Float64Array(20);
  function drawTorso(ctx, T, j, color, B) {
    const { hip, mid, neck, sw, hw } = j;
    const w = B.w;
    // Half widths: pelvis, waist, chest, armpits, top of the shoulders.
    const half = [
      Math.max(0.3 * w, hw + 0.08 * w),
      Math.max(0.25 * w, sw * 0.64) * B.waist,
      Math.max(0.27 * w, sw * 0.82),
      Math.max(0.25 * w, sw * 0.88),
      Math.max(0.18 * w, sw * 0.7),
    ];
    for (let i = 0; i < 5; i++) {
      const u = TS[i];
      const v = 1 - u;
      // Quadratic Bezier hip -> (mid) -> neck, and its tangent.
      const qx = v * v * hip.x + 2 * u * v * mid.x + u * u * neck.x;
      const qy = v * v * hip.y + 2 * u * v * mid.y + u * u * neck.y;
      let tx = 2 * v * (mid.x - hip.x) + 2 * u * (neck.x - mid.x);
      let ty = 2 * v * (mid.y - hip.y) + 2 * u * (neck.y - mid.y);
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const P1 = T({ x: qx - ty * half[i], y: qy + tx * half[i] });
      const P2 = T({ x: qx + ty * half[i], y: qy - tx * half[i] });
      TP[i * 4] = P1.x;
      TP[i * 4 + 1] = P1.y;
      TP[i * 4 + 2] = P2.x;
      TP[i * 4 + 3] = P2.y;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(TP[0], TP[1]);
    for (let i = 1; i < 4; i++) ctx.quadraticCurveTo(TP[i * 4], TP[i * 4 + 1], (TP[i * 4] + TP[i * 4 + 4]) / 2, (TP[i * 4 + 1] + TP[i * 4 + 5]) / 2);
    ctx.lineTo(TP[16], TP[17]);
    const top = T({ x: neck.x + j.up.x * 0.16, y: neck.y + j.up.y * 0.16 });
    ctx.quadraticCurveTo(top.x, top.y, TP[18], TP[19]);
    for (let i = 3; i > 0; i--) ctx.quadraticCurveTo(TP[i * 4 + 2], TP[i * 4 + 3], (TP[i * 4 + 2] + TP[i * 4 - 2]) / 2, (TP[i * 4 + 3] + TP[i * 4 - 1]) / 2);
    ctx.lineTo(TP[2], TP[3]);
    const low = T({ x: hip.x - j.up0.x * 0.16, y: hip.y - j.up0.y * 0.16 });
    ctx.quadraticCurveTo(low.x, low.y, TP[0], TP[1]);
    ctx.closePath();
    ctx.fill();
    // Shoulder caps and neck.
    disc(ctx, T, j.shL, 0.19 * w * B.sh);
    disc(ctx, T, j.shR, 0.19 * w * B.sh);
    bone(ctx, T, neck, j.head, 0.15 * w, 0.13 * w, 0, 0.5);
  }

  function drawHeadShape(ctx, T, j, p, B) {
    const H = T(j.head);
    const tilt = (p.lean * 0.55 + (p.hT || 0)) * (T.m || 1);
    ctx.beginPath();
    ctx.ellipse(H.x, H.y, 0.33 * B.head * T.s, 0.39 * B.head * T.s, tilt, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBat(ctx, T, grip, ang, bl, color) {
    const len = L.bat * bl;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const knob = { x: grip.x - dx * 0.18, y: grip.y - dy * 0.18 };
    const mid = { x: grip.x + dx * len * 0.4, y: grip.y + dy * len * 0.4 };
    const tip = { x: grip.x + dx * len, y: grip.y + dy * len };
    ctx.fillStyle = color;
    bone(ctx, T, knob, mid, 0.045, 0.055, 0, 0.5);
    bone(ctx, T, mid, tip, 0.055, 0.1, 0.012, 0.75);
    disc(ctx, T, knob, 0.075);
    return { tip, mid };
  }
  function drawLooseBat(ctx, T, b, color) {
    const len = L.bat * b.bl;
    drawBat(ctx, T, { x: b.x - Math.cos(b.ang) * len * 0.45, y: b.y - Math.sin(b.ang) * len * 0.45 }, b.ang, b.bl, color);
  }

  function drawGlove(ctx, T, arm, color) {
    const P = T(arm.end);
    const M = T(arm.mid);
    const ang = Math.atan2(P.y - M.y, P.x - M.x);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(P.x + Math.cos(ang) * 0.08 * T.s, P.y + Math.sin(ang) * 0.08 * T.s, 0.36 * T.s, 0.29 * T.s, ang, 0, Math.PI * 2);
    ctx.fill();
  }

  // o: { kind: 'pitcher'|'batter', color, body, mirror, glove, farArm, farLeg,
  //      ball, batColor, number, facing, noBat, prop }
  function drawFigure(ctx, T, p, o) {
    const B = o.body || BODIES.athletic;
    const j = solve(p, B);
    const team = o.color;
    const r = Math.max(1, T.s * 0.035);
    // Ground shadow under the planted foot.
    const g0 = T({ x: (p.fLx + p.fRx) / 2, y: Math.min(p.fLy, p.fRy, 0) });
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(g0.x, g0.y + 0.04 * T.s, (Math.abs(p.fRx - p.fLx) / 2 + 0.6 * B.w) * T.s, 0.28 * T.s, 0, 0, Math.PI * 2);
    ctx.fill();
    const farArm = o.farArm || 'R';
    const farLeg = o.farLeg || farArm;
    const armF = farArm === 'L' ? j.armL : j.armR;
    const armN = farArm === 'L' ? j.armR : j.armL;
    const shF = farArm === 'L' ? j.shL : j.shR;
    const shN = farArm === 'L' ? j.shR : j.shL;
    const legF = farLeg === 'L' ? j.legL : j.legR;
    const legN = farLeg === 'L' ? j.legR : j.legL;
    const hipF = farLeg === 'L' ? j.hipL : j.hipR;
    const hipN = farLeg === 'L' ? j.hipR : j.hipL;
    const toeF = farLeg === 'L' ? p.toeL : p.toeR;
    const toeN = farLeg === 'L' ? p.toeR : p.toeL;
    const prop = o.prop;
    for (let pass = 0; pass < 2; pass++) {
      const rim = pass === 0;
      const dx = rim ? r : 0;
      const dy = rim ? -r : 0;
      const PT = (q) => {
        const s = T(q);
        s.x += dx;
        s.y += dy;
        return s;
      };
      PT.s = T.s;
      PT.m = T.m;
      const body = rim ? RIM : BODY;
      const trim = rim ? null : team;
      const gloveColor = rim ? RIM : '#2a1f17';
      if (prop && prop.y < 0.6) drawLooseBat(ctx, PT, prop, rim ? RIM : o.batColor);
      drawLeg(ctx, PT, hipF, legF, toeF, body, trim, !rim, B);
      drawArm(ctx, PT, shF, armF, body, trim, !rim, B);
      if (o.glove === farArm) drawGlove(ctx, PT, armF, gloveColor);
      drawTorso(ctx, PT, j, body, B);
      if (!rim) drawTorsoTrim(ctx, PT, j, p, team, o, B);
      drawLeg(ctx, PT, hipN, legN, toeN, body, trim, false, B);
      ctx.fillStyle = body;
      drawHeadShape(ctx, PT, j, p, B);
      if (!rim) drawHeadgear(ctx, PT, j, p, team, o, B);
      drawArm(ctx, PT, shN, armN, body, trim, false, B, true);
      if (o.glove && o.glove !== farArm) drawGlove(ctx, PT, armN, gloveColor);
      if (o.ball) {
        ctx.fillStyle = rim ? RIM : '#f4f1ea';
        disc(ctx, PT, o.ball === 'L' ? j.armL.end : j.armR.end, 0.12);
      }
      if (o.kind === 'batter' && !o.noBat) {
        const res = drawBat(ctx, PT, { x: p.hLx, y: p.hLy }, p.bat, p.bl, rim ? RIM : o.batColor);
        if (!rim) {
          // Hands over the grip.
          ctx.fillStyle = BODY;
          disc(ctx, PT, j.armL.end, 0.145);
          if (p.gr > 0.5) disc(ctx, PT, j.armR.end, 0.145);
          o.batTip = res.tip;
        }
      }
      if (prop && prop.y >= 0.6) drawLooseBat(ctx, PT, prop, rim ? RIM : o.batColor);
    }
    return j;
  }

  function drawTorsoTrim(ctx, T, j, p, team, o, B) {
    // Belt across the hips.
    ctx.fillStyle = team;
    const half = Math.max(0.3 * B.w, j.hw + 0.11 * B.w) * 0.97;
    const c = { x: j.hip.x + j.up0.x * 0.13, y: j.hip.y + j.up0.y * 0.13 };
    const bl = { x: c.x - j.perp0.x * half, y: c.y - j.perp0.y * half };
    const br = { x: c.x + j.perp0.x * half, y: c.y + j.perp0.y * half };
    bone(ctx, T, bl, br, 0.065, 0.065, 0, 0.5, 0, 1, 0);
    // Number on the back (batter) or a chest stripe (pitcher facing us).
    if (p.tw > 0.55) {
      const a = U.clamp((p.tw - 0.55) * 4, 0, 1);
      const cc = { x: j.hip.x + (j.mid.x - j.hip.x) * 1.0 + (j.neck.x - j.mid.x) * 0.3, y: j.hip.y + (j.mid.y - j.hip.y) * 1.0 + (j.neck.y - j.mid.y) * 0.3 };
      ctx.globalAlpha = a;
      if (o.number != null) {
        const C = T(cc);
        ctx.save();
        ctx.translate(C.x, C.y);
        ctx.rotate(p.lean * (o.mirror || 1));
        ctx.scale(Math.max(0.55, Math.min(1, p.tw)) * Math.sqrt(B.sh), 1);
        ctx.fillStyle = team;
        ctx.font = `800 ${Math.round(0.85 * T.s * Math.sqrt(B.torso))}px "Barlow Condensed", "Arial Narrow", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(o.number), 0, 0);
        ctx.restore();
      } else {
        const hi = { x: cc.x + j.up.x * 0.3, y: cc.y + j.up.y * 0.3 };
        const a2 = { x: hi.x - j.perp.x * 0.32, y: hi.y - j.perp.y * 0.32 };
        const b2 = { x: hi.x + j.perp.x * 0.32 + j.up.x * 0.12, y: hi.y + j.perp.y * 0.32 + j.up.y * 0.12 };
        bone(ctx, T, a2, b2, 0.05, 0.05, 0, 0.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawHeadgear(ctx, T, j, p, team, o, B) {
    const H = T(j.head);
    const r = L.head * T.s * B.head;
    const tilt = p.lean * 0.55 + (p.hT || 0);
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
      // Cap: crown plus a brim that points where the player is looking.
      ctx.beginPath();
      ctx.arc(0, -r * 0.08, r * 1.04, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
      ctx.fill();
      let face = o.facing == null ? 0 : o.facing; // -1 left, 0 toward us, 1 right
      if (Math.abs(p.lk || 0) > 0.3) face = Math.sign(p.lk);
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
  // Pitcher animations (right-handed, facing us: throwing hand = hL on
  // screen-left, glove = hR, kick leg = fR).
  // ---------------------------------------------------------------------------
  const WINDUP = 0.85; // seconds from the start of the windup to release (main.js matches)
  const W = WINDUP;
  const P_BASE = pose({
    hipX: 0, hipY: 2.95, lean: 0, tw: 1, headX: 0, headY: 0,
    hLx: -0.5, hLy: 2.7, hRx: 0.55, hRy: 2.55, fLx: -0.45, fLy: 0, fRx: 0.45, fRy: 0,
    bat: 0, bl: 1, toeL: 0.25, toeR: 0.25, eL: -1, eR: 1, kL: -1, kR: 1,
  });
  const P_SIGN = pose(P_BASE, { hipY: 2.84, headY: -0.12, lean: 0.04, sp: 0.08, hLx: -0.3, hLy: 2.8, hRx: 0.62, hRy: 2.42, fLx: -0.42, fRx: 0.52 });
  const P_SET = pose(P_BASE, { hipY: 2.96, hLx: -0.06, hLy: 3.95, hRx: 0.1, hRy: 4.0, eL: 1, eR: -1, fLx: -0.42, fRx: 0.4 });
  const P_FIELD = pose(P_BASE, {
    hipX: 0.05, hipY: 2.55, lean: 0.05, headY: -0.05, sp: 0.06,
    hLx: -0.38, hLy: 3.0, hRx: 0.42, hRy: 3.1, eL: -1, eR: 1,
    fLx: -0.6, fLy: -0.35, fRx: 0.55, fRy: -0.55, kL: -1, kR: 1,
  });

  // Delivery styles. kick: knee height, slot: hand at release, cock: hand at
  // layback, lean: torso tilt at release, t: key times as fractions of the
  // windup (rock, lift, peak, drive, foot strike, layback), hands: hands go
  // over the head at the peak, fin: throwing hand at the finish.
  const STYLES = {
    classic: { kick: 1, slot: [-1.55, 5.2], cock: [-0.3, 5.7], lean: 0.2, t: [0.12, 0.3, 0.5, 0.64, 0.76, 0.88], hands: 0, fin: [0.62, 1.75], stride: 1 },
    overTop: { kick: 1.05, slot: [-0.95, 5.95], cock: [0.05, 5.9], lean: 0.42, t: [0.12, 0.29, 0.48, 0.63, 0.75, 0.88], hands: 0.4, fin: [0.38, 1.55], stride: 0.95 },
    sidearm: { kick: 0.78, slot: [-2.45, 4.15], cock: [-1.55, 4.5], lean: -0.06, t: [0.16, 0.34, 0.52, 0.66, 0.78, 0.89], hands: 0, fin: [0.95, 2.45], stride: 1.12 },
    highKick: { kick: 1.48, slot: [-1.45, 5.3], cock: [-0.2, 5.75], lean: 0.26, t: [0.1, 0.25, 0.42, 0.62, 0.75, 0.88], hands: 1, fin: [0.6, 1.7], stride: 1.05 },
  };

  function releasePose(st) {
    return pose(P_SET, {
      tw: 1, sep: 0, hipX: 0.05, hipY: 2.5, lean: st.lean, sp: 0.12, headX: 0.12, headY: -0.05, hT: -0.08,
      hLx: st.slot[0], hLy: st.slot[1], hRx: 0.5, hRy: 3.75, eL: -1, eR: 1,
      fLx: -0.35, fLy: 0.25, fRx: 0.32 * st.stride, fRy: -0.6 * st.stride, toeL: 0.15, toeR: 0.25, kL: 1, kR: -1,
    });
  }

  // Keyframes of one delivery, with small random changes every pitch.
  function windupKeys(st, rnd) {
    const r = (a) => (rnd() - 0.5) * 2 * a; // uniform in [-a, a]
    const k = st.kick * (1 + r(0.1));
    const tt = st.t.map((x, i) => (i < 4 ? x + r(0.018) : x) * W);
    const set = P_SET;
    const rock = pose(set, { hipY: 3.0, hipX: 0.03 + r(0.03), hLy: 4.1 + r(0.06), hRy: 4.14, fRy: 0.05, fRx: 0.36, toeR: 0.15 });
    const lift = pose(set, {
      tw: 0.55, hipX: 0.06, hipY: 3.02, hLx: -0.04, hLy: 4.18, hRx: 0.05, hRy: 4.22,
      fLx: -0.38, fRx: 0.1, fRy: 0.55 * k, toeL: -0.3, toeR: -0.35, kL: -1, kR: -1,
    });
    const hy = 4.12 + st.hands * 1.35;
    const peak = pose(lift, {
      tw: 0.28, sep: -0.04, hipX: 0.12, hipY: 3.06 + 0.04 * (k - 1), lean: -0.05, sp: -0.04,
      hLx: 0.04 - st.hands * 0.08, hLy: hy, hRx: 0.02 + st.hands * 0.05, hRy: hy + 0.05, eL: 1, eR: 1,
      fLx: 0, fRx: -0.3 - 0.18 * (k - 1), fRy: 1.55 * k, toeL: -0.5, toeR: -0.45,
    });
    const drive = pose(peak, {
      tw: 0.34, sep: 0.06, hipX: -0.12, hipY: 2.8, lean: 0.02, sp: 0,
      hLx: 0.85, hLy: 3.35 + r(0.1), hRx: -0.75, hRy: 4.05, eL: 1, eR: -1,
      fLx: 0.05, fRx: -0.85 * st.stride, fRy: 0.5 * Math.sqrt(k), toeR: -0.55,
    });
    const strike = pose(drive, {
      tw: 0.45, sep: 0.38, hipX: -0.08, hipY: 2.6, lean: 0.06, sp: -0.08,
      hLx: 0.72, hLy: 4.55, hRx: -0.95, hRy: 3.95, eL: 1, eR: -1,
      fLx: -0.08, fLy: 0.08, fRx: 0.22 * st.stride, fRy: -0.55 * st.stride, toeL: -0.3, toeR: 0.25, kL: 1, kR: -1,
    });
    const cock = pose(strike, {
      tw: 0.72, sep: 0.2, hipX: -0.02, hipY: 2.52, lean: st.lean * 0.5, sp: 0.04, headX: 0.04,
      hLx: st.cock[0], hLy: st.cock[1], hRx: -0.55, hRy: 3.75, eL: -1, eR: 1, fLx: -0.15, fLy: 0.12,
    });
    const rel = releasePose(st);
    const fall = 1 + r(0.25);
    const follow = pose(rel, {
      hipX: 0.15 + r(0.05), hipY: 2.28 + r(0.06), lean: 0.34, sp: 0.22, headX: 0.15, headY: -0.15, hT: -0.14,
      hLx: st.fin[0] + r(0.12), hLy: st.fin[1] + r(0.15), hRx: 0.78, hRy: 3.15, eL: 1, eR: 1,
      fLx: -0.95, fLy: 0.85 * fall, toeL: -0.3, kL: 1, kR: -1,
    });
    const recover = pose(follow, {
      hipX: 0.1, hipY: 2.45, lean: 0.12, sp: 0.08, headX: 0.06, headY: -0.06, hT: 0,
      hLx: -0.2, hLy: 2.9, hRx: 0.6, hRy: 3.2, fLx: -0.55, fLy: 0.12, eL: -1,
    });
    const keys = [
      { t: 0, p: set },
      { t: tt[0], p: rock },
      { t: tt[1], p: lift },
      { t: tt[2], p: peak },
    ];
    // High kickers hang at the top for a beat.
    if (st.hands > 0.9) keys.push({ t: tt[2] + 0.07 * W, p: pose(peak, { fRy: peak.fRy + 0.06, hipY: peak.hipY + 0.02 }) });
    keys.push(
      { t: tt[3], p: drive },
      { t: tt[4], p: strike },
      { t: tt[5], p: cock },
      { t: W, p: rel },
      { t: W + 0.14, p: follow },
      { t: W + 0.36, p: recover },
      { t: W + 0.62, p: rnd() < 0.5 ? P_FIELD : pose(P_FIELD, { hRx: 0.5, hRy: 3.6, hLy: 3.2, sp: 0.1 }) },
    );
    // Some pitchers tap the glove before they go.
    if (rnd() < 0.35) {
      keys.splice(1, 0, { t: 0.05 * W, p: pose(set, { hLy: 3.83, hRy: 3.88 }) }, { t: 0.09 * W, p: set });
    }
    return keys;
  }

  // Head nods and fidgets while getting the sign.
  function signMod(p, t, o, rig) {
    const n = Math.sin(t * 1.7 + (rig ? rig.phase || 0 : 0));
    p.headY -= Math.pow(Math.max(0, n), 10) * 0.07;
    p.hRy += Math.sin(t * 0.8) * 0.04;
    return p;
  }

  function pitcherLib(look) {
    const st = STYLES[look.windup];
    const lib = {
      sign: anim({ pose: P_SIGN, idle: 1, mod: signMod }),
      set: anim({ pose: P_SET, idle: 0.6 }),
      field: anim({ pose: P_FIELD, idle: 0.5 }),
      windup: {
        build(rig) {
          return anim({
            keys: windupKeys(st, rig.rand),
            // Overlapping action: hips lead, the head and glove trail, the
            // throwing hand is exact so the ball leaves it at release.
            lag: { hip: -0.025, torso: -0.012, head: 0.03, handR: 0.025, footL: 0.035, footR: -0.01 },
            mod(p, t) {
              if (t > W + 0.62) breathe(p, t, 0.4 * smooth((t - W - 0.62) / 0.4));
              return p;
            },
          });
        },
      },
    };
    Object.assign(lib, pitcherReactions());
    return lib;
  }

  // Reactions. Each one is a short routine that holds the stage (lock) and
  // then goes back to getting the sign.
  function pitcherReactions() {
    const HIPS = pose(P_BASE, {
      hipY: 2.9, tw: 0.85, lean: 0.03, sp: 0.14, headY: -0.17, hT: 0.12,
      hLx: -0.52, hLy: 3.12, hRx: 0.55, hRy: 3.12, eL: -1, eR: 1, fLx: -0.55, fRx: 0.55,
    });
    const DOWN = pose(P_BASE, { hipY: 2.88, lean: 0.06, sp: 0.2, headY: -0.19, hT: 0.15, hLx: -0.45, hLy: 2.75, hRx: 0.5, hRy: 2.6, fLx: -0.4, fRx: 0.4 });
    const LOOKUP = pose(P_BASE, { hipY: 2.92, headY: 0.04, hT: -0.2, lean: -0.04, hLx: -0.5, hLy: 2.8, hRx: 0.3, hRy: 5.05, eR: 1 });
    const COIL = pose(P_BASE, {
      hipY: 2.5, tw: 0.82, lean: 0.1, sp: 0.15, headY: 0.02, hT: -0.12,
      hLx: -0.9, hLy: 4.55, eL: 1, hRx: 0.5, hRy: 3.3, fLx: -0.75, fRx: 0.72,
    });
    const PUMP = pose(COIL, { hipY: 2.38, lean: 0.2, sp: 0.28, hLx: -0.48, hLy: 3.3, headY: -0.02, hT: -0.04 });
    const AWAY = pose(P_BASE, { hipY: 2.86, tw: 0.62, lk: 1, hipX: 0.18, hLx: -0.4, hLy: 2.8, hRx: 0.55, hRy: 2.7, headY: -0.06 });
    const shake = (from, to) => (p, t) => {
      p.headX += Math.sin(t * 19) * 0.055 * window4(t, from, from + 0.1, to - 0.1, to);
      return p;
    };
    const react = (keys, extra) => anim(Object.assign({ keys, lock: true, next: 'sign', outBlend: 0.4, lag: { head: 0.04, handR: 0.03, hip: -0.02 } }, extra));
    return {
      frustrate: {
        build(rig) {
          const v = rig.rand();
          if (v < 0.4) {
            return react([
              { t: 0, p: P_FIELD },
              { t: 0.3, p: HIPS },
              { t: 0.85, p: pose(HIPS, { headY: -0.21, hT: 0.16, hipX: 0.08 }) },
              { t: 1.2, p: pose(HIPS, { tw: 0.6, lk: -1, hipX: 0.15, headY: -0.09, hT: 0 }) },
              { t: 1.55, p: P_SIGN },
            ], { mod: shake(0.35, 0.85) });
          }
          if (v < 0.75) {
            return react([
              { t: 0, p: P_FIELD },
              { t: 0.25, p: DOWN },
              { t: 0.48, p: pose(DOWN, { fRx: 0.3, fRy: 0.55, kR: 1, hipX: -0.06, toeR: 0.3 }) },
              { t: 0.64, p: pose(DOWN, { fRx: 0.98, fRy: 0.1, toeR: 0.45, hipX: 0.08, lean: 0 }) },
              { t: 0.85, p: pose(DOWN, { fRx: 0.6, fRy: 0 }) },
              { t: 1.2, p: pose(AWAY, { lk: -1, tw: 0.55 }) },
              { t: 1.5, p: P_SIGN },
            ], { dust: { t: 0.63 } });
          }
          return react([
            { t: 0, p: P_FIELD },
            { t: 0.3, p: LOOKUP },
            { t: 0.6, p: pose(LOOKUP, { hRx: 0.1, hRy: 5.12 }) },
            { t: 0.95, p: pose(DOWN, { headY: -0.12, hRx: 0.55, hRy: 2.65 }) },
            { t: 1.45, p: P_SIGN },
          ]);
        },
      },
      pump: {
        build(rig, o) {
          if (o && o.final) {
            // Game over: jump with both arms up.
            const JUMP = pose(P_BASE, { hipY: 3.55, hLx: -0.95, hLy: 6.25, hRx: 0.95, hRy: 6.3, eL: -1, eR: 1, fLx: -0.5, fLy: 0.55, fRx: 0.55, fRy: 0.65, kL: -1, kR: 1, headY: 0.05, hT: -0.2 });
            const LAND = pose(P_BASE, { hipY: 2.6, hLx: -0.9, hLy: 5.8, hRx: 0.9, hRy: 5.85, eL: -1, eR: 1, fLx: -0.55, fRx: 0.55, hT: -0.15 });
            return react([
              { t: 0, p: P_FIELD },
              { t: 0.15, p: pose(P_FIELD, { hipY: 2.35, hLy: 2.9 }) },
              { t: 0.36, p: JUMP },
              { t: 0.56, p: LAND },
              { t: 0.8, p: JUMP },
              { t: 1.0, p: LAND },
              { t: 1.6, p: pose(LAND, { hipY: 2.8 }) },
            ], { next: 'field' });
          }
          const v = rig.rand();
          if (v < 0.4) {
            return react([
              { t: 0, p: P_FIELD },
              { t: 0.18, p: COIL },
              { t: 0.32, p: PUMP },
              { t: 0.55, p: pose(PUMP, { hipY: 2.45 }) },
              { t: 0.95, p: AWAY },
              { t: 1.3, p: P_SIGN },
            ]);
          }
          if (v < 0.75) {
            return react([
              { t: 0, p: P_FIELD },
              { t: 0.14, p: COIL },
              { t: 0.26, p: PUMP },
              { t: 0.4, p: pose(COIL, { hLy: 4.3 }) },
              { t: 0.52, p: PUMP },
              { t: 0.9, p: AWAY },
              { t: 1.25, p: P_SIGN },
            ]);
          }
          const PUNCH = pose(P_BASE, { hipY: 2.6, hRx: 0.85, hRy: 4.95, eR: 1, hLx: -0.7, hLy: 3.6, headY: 0.04, hT: -0.15, lean: -0.05, fLx: -0.6, fRx: 0.6 });
          return react([
            { t: 0, p: P_FIELD },
            { t: 0.2, p: PUNCH },
            { t: 0.38, p: pose(PUNCH, { hRy: 4.2 }) },
            { t: 0.62, p: pose(PUNCH, { hRy: 3.4, hRx: 0.6, hLx: -0.35, hLy: 4.3, eL: 0.2 }) },
            { t: 0.95, p: AWAY },
            { t: 1.25, p: P_SIGN },
          ]);
        },
      },
      // Turn and watch a long fly ball leave.
      watch: anim({
        keys: [
          { t: 0, p: P_FIELD },
          { t: 0.3, p: pose(P_BASE, { tw: 0.4, lk: -1, hipY: 2.82, headY: 0.06, hT: -0.3, hLx: -0.45, hLy: 2.9, hRx: 0.5, hRy: 2.8, fLx: -0.45, fRx: 0.5 }) },
          { t: 1.0, p: pose(P_BASE, { tw: 0.42, lk: -1, hipY: 2.84, headY: 0.02, hT: -0.15, hLx: -0.45, hLy: 2.85, hRx: 0.5, hRy: 2.75, fLx: -0.45, fRx: 0.5 }) },
          { t: 1.3, p: pose(P_BASE, { tw: 0.5, lk: -1, hipY: 2.86, headY: -0.12, hT: 0.12, hLx: -0.45, hLy: 2.8, hRx: 0.5, hRy: 2.7 }) },
        ],
        lock: true,
        next: 'field',
        lag: { head: 0.05, hip: -0.03 },
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Batter animations (right-handed, facing the plate to the right, seen from
  // behind). The bat is held at hL; hR is the top hand (gr = 1 keeps it on
  // the handle).
  // ---------------------------------------------------------------------------
  const SWING_CONTACT = 0.04; // seconds from the tap to bat-on-ball (main.js matches)
  const C = SWING_CONTACT;
  const B_BASE = pose({
    hipX: 0, hipY: 2.78, lean: 0.12, tw: 0.75, headX: 0.08, headY: 0,
    hLx: -0.5, hLy: 4.55, hRx: -0.42, hRy: 4.68, fLx: -0.95, fLy: 0, fRx: 0.95, fRy: 0,
    bat: 1.85, bl: 1, gr: 1, toeL: 0.38, toeR: 0.4, eL: 1, eR: 1, kL: 1, kR: 1,
  });
  // Stance styles: pose changes plus a waggle (amp, freq, circle, bounce, tap).
  const STANCES = {
    upright: { p: { hipY: 2.72, lean: 0.14, sp: 0.04, hLx: -0.5, hLy: 4.62, bat: 1.78, fLx: -0.92, fRx: 0.9, kL: 1, kR: 1 }, wag: [0.12, 4.6, 0.05, 0.01, 0], kick: 0.42, finish: 'high' },
    crouch: { p: { hipY: 2.42, lean: 0.3, sp: 0.12, headY: -0.04, tw: 0.72, hLx: -0.56, hLy: 4.08, bat: 2.2, fLx: -1.2, fRx: 1.15, toeL: 0.42, toeR: 0.45 }, wag: [0.08, 3.2, 0.03, 0.025, 0], kick: 0.16, finish: 'low' },
    open: { p: { hipY: 2.74, tw: 0.9, hLx: -0.42, hLy: 4.62, bat: 1.7, fLx: -0.9, fRx: 0.52, fRy: 0.14, toeR: 0.5 }, wag: [0.18, 2.8, 0.04, 0.012, 1], kick: 0.3, finish: 'release' },
    highHands: { p: { hipY: 2.8, lean: 0.1, tw: 0.78, hLx: -0.32, hLy: 5.32, bat: 1.42, fLx: -0.92, fRx: 0.92 }, wag: [0.2, 3.6, 0.07, 0.01, 0], kick: 0.36, finish: 'high' },
  };
  const B_LAUNCH = pose(B_BASE, { hipX: 0.05, hipY: 2.66, hLx: -0.72, hLy: 4.45, hRx: -0.64, hRy: 4.58, bat: 1.98, fRx: 1.2, fRy: 0, lean: 0.1 });
  const B_SLOT = pose(B_LAUNCH, { tw: 0.85, sep: 0.18, hipX: 0.12, hipY: 2.6, hLx: -0.3, hLy: 3.95, hRx: -0.18, hRy: 4.0, bat: 3.35, lean: 0.12, fLx: -0.9, fLy: 0.06, toeL: 0.3 });
  const B_BARREL = pose(B_SLOT, { tw: 0.95, sep: 0.06, hipX: 0.18, hLx: 0.05, hLy: 3.5, hRx: 0.18, hRy: 3.55, bat: 4.75, bl: 0.38, lean: 0.15 });
  const B_CONTACT = pose(B_LAUNCH, {
    tw: 1, sep: 0, hipX: 0.22, hipY: 2.55, lean: 0.16, sp: 0.06, headX: 0.12, headY: -0.05,
    hLx: 0.45, hLy: 3.3, hRx: 0.6, hRy: 3.32, bat: 6.08, bl: 1, eL: 1, eR: 1,
    fLx: -0.82, fLy: 0.14, toeL: 0.2, fRx: 1.2, fRy: 0,
  });
  // Where the barrel's sweet spot sits at contact (2.2 ft up the bat from the hands).
  const SWEET_X = B_CONTACT.hLx + Math.cos(B_CONTACT.bat) * 2.2;
  const FINISHES = {
    high: [
      { hLx: 0.95, hLy: 3.75, bat: 6.85, bl: 0.68, lean: 0.12 },
      { hLx: 0.6, hLy: 4.85, bat: 8.0, bl: 0.82, lean: 0.04, headX: 0.15, sp: -0.06, eL: -1, eR: -1 },
      { hLx: 0.3, hLy: 4.95, bat: 9.15, bl: 0.92, hipX: 0.18, hipY: 2.62, fLx: -0.55, fLy: 0.28, toeL: 0.15, sp: -0.1, eL: -1, eR: -1 },
    ],
    low: [
      { hLx: 1.0, hLy: 3.6, bat: 6.8, bl: 0.72, lean: 0.18 },
      { hLx: 0.85, hLy: 4.3, bat: 7.6, bl: 0.85, lean: 0.14, headX: 0.15, eL: -1, eR: -1 },
      { hLx: 0.55, hLy: 4.5, bat: 8.6, bl: 0.95, hipX: 0.2, hipY: 2.5, fLx: -0.6, fLy: 0.25, toeL: 0.15, lean: 0.14, eL: -1, eR: -1 },
    ],
    release: [
      { hLx: 0.95, hLy: 3.8, bat: 6.85, bl: 0.7, lean: 0.12 },
      { hLx: 0.55, hLy: 4.95, bat: 8.1, bl: 0.85, lean: 0.06, headX: 0.15, gr: 0.4, hRx: 1.0, hRy: 4.0, eL: -1, eR: 1 },
      { hLx: 0.12, hLy: 5.25, bat: 9.4, bl: 0.95, hipX: 0.2, hipY: 2.64, fLx: -0.5, fLy: 0.3, toeL: 0.15, gr: 0, hRx: 0.95, hRy: 3.85, sp: -0.12, eL: -1, eR: 1 },
    ],
  };

  function batterBasics(look) {
    const S = STANCES[look.stance];
    const stance = pose(B_BASE, S.p);
    const [amp, freq, circ, bounce, tap] = S.wag;
    const stanceAnim = anim({
      pose: stance,
      idle: 1,
      // Bat waggle: rocking barrel, small circles with the hands, a little
      // bounce in the legs, and (open stance) a front-foot tap.
      mod(p, t, o, rig) {
        const ph = rig ? rig.phase || 0 : 0;
        const w = Math.sin(t * freq + ph);
        const w2 = Math.cos(t * freq + ph);
        p.bat += w * amp;
        p.hLx += w2 * circ;
        p.hLy += w * circ * 0.8;
        p.hipY += Math.sin(t * freq * 0.5 + ph) * bounce;
        if (tap) p.fRy += Math.pow(Math.max(0, Math.sin(t * 1.3 + ph)), 12) * 0.22;
        return p;
      },
    });
    const load = {
      // Timed from the start of the windup: gather, leg lift, stride, launch.
      build(rig) {
        const rnd = rig.rand;
        const kick = S.kick * (0.7 + rnd() * 0.6);
        const g = (rnd() - 0.5) * 0.08;
        const gather = pose(stance, {
          hipX: stance.hipX - 0.12, hipY: stance.hipY + 0.02, lean: stance.lean - 0.05,
          hLx: stance.hLx - 0.26, hLy: Math.min(stance.hLy, 4.75) + 0.1, bat: stance.bat + 0.12,
          fRx: Math.min(stance.fRx, 0.8), fRy: 0.1 + kick * 0.3, tw: stance.tw - 0.04,
        });
        const launch = pose(B_LAUNCH, {
          hipY: Math.min(B_LAUNCH.hipY, stance.hipY - 0.06), lean: Math.max(B_LAUNCH.lean, stance.lean - 0.04),
          fRx: 1.2 + (rnd() - 0.5) * 0.16, fLx: stance.fLx, toeL: stance.toeL,
        });
        return anim({
          keys: [
            { t: 0, p: stance },
            { t: 0.5 * W + g, p: stance },
            { t: 0.82 * W + g, p: gather },
            { t: W, p: pose(gather, { fRy: 0.12 + kick, fRx: gather.fRx - 0.1 * kick, hipX: gather.hipX - 0.04 }) },
            { t: W + 0.2, p: launch },
          ],
          lag: { hip: -0.03, head: 0.03, bat: 0.04, footR: -0.02 },
        });
      },
    };
    const swing = {
      build(rig) {
        const rnd = rig.rand;
        const pick = rnd();
        const style = pick < 0.6 ? S.finish : pick < 0.8 ? 'high' : pick < 0.9 ? 'low' : 'release';
        const F = FINISHES[style];
        const j = () => (rnd() - 0.5) * 0.2;
        const ext = pose(B_CONTACT, F[0]);
        const fol = pose(B_CONTACT, Object.assign({}, F[1], { hLy: F[1].hLy + j(), bat: F[1].bat + j() }));
        const fin = pose(fol, Object.assign({}, F[2], { hLy: F[2].hLy + j(), bat: F[2].bat + j(), fLy: F[2].fLy + j() * 0.4 }));
        return anim({
          keys: [
            { t: 0, p: B_LAUNCH },
            { t: C * 0.45, p: B_SLOT },
            { t: C * 0.78, p: B_BARREL },
            { t: C, p: B_CONTACT },
            { t: 0.1, p: ext },
            { t: 0.2, p: fol },
            { t: 0.34 + rnd() * 0.04, p: fin },
          ],
          // After contact the body unwinds in sequence; the head stays down.
          lag: { head: 0.035, footL: 0.02 },
          mod: swingMod,
        });
      },
    };
    return { stance: stanceAnim, load, swing, STANCE: stance };
  }

  // Steer the barrel's sweet spot onto the pitch at contact and keep the
  // head still through the zone (o.ballX / o.ballY: where the pitch crosses
  // the plate, in figure space).
  function swingMod(p, t, o) {
    const hs = 1 - smooth((t - 0.08) / 0.2);
    p.headX -= (p.hipX - B_LAUNCH.hipX) * 0.55 * hs;
    p.hT -= (p.lean - B_LAUNCH.lean) * 0.6 * hs;
    if (o.ballY == null) return p;
    const w = Math.max(0, 1 - Math.abs(t - C) / 0.05);
    const dy = (o.ballY - 2.55) * 0.75;
    const dx = o.ballX == null ? 0 : U.clamp(o.ballX - SWEET_X, -1, 0.8);
    p.hLy += dy * w;
    p.hRy += dy * w;
    p.hLx += dx * w;
    p.hRx += dx * w;
    p.bat += (o.ballY - 2.55) * 0.12 * w;
    return p;
  }

  // Procedural walk / jog: feet plant and swing, hips bob, arms swing, and
  // the hands travel with the body. g: { t0, t1, x0, v (ft/s), dir, step,
  // lift, arms, hy, bob, lean }.
  function gait(p, t, g) {
    const tt = t - g.t0;
    if (tt <= 0) return p;
    let w = smooth(tt / 0.22);
    if (g.t1 != null) w *= 1 - smooth((t - g.t1) / 0.15);
    if (w <= 0) return p;
    const T2 = g.step / g.v;
    const u = tt / (2 * T2);
    const hip = g.x0 + g.dir * g.v * tt;
    const foot = (off) => {
      const uu = u + off;
      const k = Math.floor(uu);
      const f = uu - k;
      const base = 2 * k + 0.5 - off * 2;
      if (f < 0.5) return [g.x0 + g.dir * g.step * base, 0];
      const s = smooth((f - 0.5) / 0.5);
      return [g.x0 + g.dir * g.step * (base + 2 * s), Math.sin(Math.PI * s) * g.lift];
    };
    const a = foot(0);
    const b = foot(0.5);
    const dx = (hip - p.hipX) * w;
    p.hipX += dx;
    const sw = Math.sin(2 * Math.PI * u) * g.arms;
    p.hLx += dx + sw * w;
    p.hRx += dx - sw * w;
    p.hipY += (g.hy - g.bob * Math.cos(4 * Math.PI * u) - p.hipY) * w;
    p.fRx += (a[0] - p.fRx) * w;
    p.fRy += (a[1] - p.fRy) * w;
    p.fLx += (b[0] - p.fLx) * w;
    p.fLy += (b[1] - p.fLy) * w;
    p.toeR += (0.32 * g.dir - p.toeR) * w;
    p.toeL += (0.32 * g.dir - p.toeL) * w;
    p.lean += (g.lean || 0) * g.dir * w;
    return p;
  }

  function enterAnim(stance) {
    const WALK = pose(B_BASE, {
      hipX: -3.2, hipY: 2.95, lean: 0.03, tw: 0.6, headX: 0.04,
      hLx: -2.75, hLy: 3.3, hRx: -3.5, hRy: 3.35, bat: -1.15, bl: 0.95, gr: 0, eL: -1, eR: 1,
      fLx: -3.6, fRx: -2.8,
    });
    const INBOX = pose(B_BASE, { hipX: -0.25, hipY: 2.9, lean: 0.2, tw: 0.65, hLx: 0.35, hLy: 3.0, hRx: 0.45, hRy: 3.05, bat: -0.95, gr: 0.6, fLx: -0.95, fRx: 0.5, eL: 1, eR: 1 });
    const TAP = pose(INBOX, { hLy: 2.8, hRy: 2.85, bat: -0.85, lean: 0.26 });
    const RAISE = pose(stance, { hLx: -0.2, hLy: 4.2, bat: 1.55, tw: 0.7 });
    return {
      build(rig) {
        const taps = rig.rand() < 0.5 ? 1 : 2;
        const keys = [
          { t: 0, p: WALK },
          { t: 0.75, p: pose(WALK, { hipX: -0.3, hLx: 0.15, hRx: -0.6, fLx: -0.95, fRx: 0.4 }) },
          { t: 0.85, p: INBOX },
          { t: 0.98, p: TAP },
        ];
        if (taps === 2) keys.push({ t: 1.08, p: INBOX }, { t: 1.17, p: TAP });
        keys.push({ t: 1.42, p: RAISE }, { t: 1.6, p: stance });
        return anim({
          keys,
          dur: 1.6,
          next: 'stance',
          lag: { head: 0.04, bat: 0.03 },
          mod: (p, t) => gait(p, t, { t0: 0, t1: 0.72, x0: -3.2, v: 3.9, dir: 1, step: 0.95, lift: 0.22, arms: 0.1, hy: 2.95, bob: 0.04 }),
        });
      },
    };
  }

  function adjustAnim(stance) {
    const OUT = pose(B_BASE, { hipX: -0.75, hipY: 2.95, lean: 0.02, tw: 0.55, fLx: -1.55, fRx: 0.25, hLx: -0.35, hLy: 3.2, hRx: -0.1, hRy: 3.5, bat: -1.45, bl: 0.95, gr: 0, eL: -1, eR: 1 });
    const HELMET = pose(OUT, { hRx: -0.55, hRy: 5.15, headY: -0.04, eR: 1 });
    const GLOVES = pose(OUT, { hRx: -0.15, hRy: 3.45, hLy: 3.3 });
    const RAISE = pose(stance, { hLx: -0.2, hLy: 4.2, bat: 1.55, tw: 0.7 });
    return {
      build(rig) {
        const helmet = rig.rand() < 0.6;
        const keys = [{ t: 0, p: stance }, { t: 0.35, p: OUT }];
        if (helmet) keys.push({ t: 0.65, p: HELMET }, { t: 0.9, p: HELMET });
        else keys.push({ t: 0.6, p: pose(OUT, { hipY: 2.7, lean: 0.25, sp: 0.2, headY: -0.08 }) }, { t: 0.9, p: OUT });
        keys.push(
          { t: 1.1, p: GLOVES },
          { t: 1.25, p: pose(GLOVES, { hRx: -0.05, hRy: 3.35 }) },
          { t: 1.4, p: GLOVES },
          { t: 1.75, p: RAISE },
          { t: 2.1, p: stance },
        );
        return anim({ keys, dur: 2.1, next: 'stance', lag: { head: 0.04, bat: 0.03, handR: 0.02 } });
      },
    };
  }

  // Home run reactions and the strikeout walk-off. o.dir: which way first
  // base is in figure space (1 for righties, -1 for lefties).
  function batterReactions(look) {
    const FIN = pose(pose(B_CONTACT, FINISHES.high[1]), FINISHES.high[2]);
    const trot = (t0, v, x0, dir) => ({ t0, x0, v, dir, step: 1.3, lift: 0.32, arms: 0.3, hy: 2.86, bob: 0.05, lean: 0.06 });
    const hr = {
      flip(dir) {
        const WATCH = pose(FIN, { headY: 0.08, hT: -0.22, hipX: 0.25, hipY: 2.7, gr: 0, hRx: 0.85, hRy: 4.1, eR: 1, hLx: 0.45, hLy: 4.6, bat: 8.9 });
        const WIND = pose(WATCH, { hLx: 0.12, hLy: 3.85, bat: 6.6, bl: 0.9, eL: 1, tw: 0.85 });
        const FLIP = pose(WATCH, { hLx: 1.05, hLy: 5.2, bat: 7.6, bl: 0.8, eL: -1, tw: 0.8, lean: 0.06 });
        const AFTER = pose(FLIP, { hLx: 0.6, hLy: 3.9, hRx: 0.95, hRy: 3.6, eL: 1, headY: 0.06, hT: -0.12 });
        return {
          keys: [{ t: 0, p: FIN }, { t: 0.22, p: WATCH }, { t: 0.36, p: WIND }, { t: 0.48, p: FLIP }, { t: 0.7, p: AFTER }, { t: 1.4, p: AFTER }],
          drop: { t: 0.47, vx: -2.2, vy: 12, spin: 15 },
          gait: trot(0.78, 6, AFTER.hipX, dir),
        };
      },
      point(dir) {
        const LET = pose(FIN, { hLx: 0.55, hLy: 4.4, bat: 8.0, gr: 0.3, hT: -0.1 });
        const POINT = pose(FIN, { gr: 0, hRx: 0.75, hRy: 6.45, eR: -0.2, hLx: 0.35, hLy: 3.3, eL: 1, headY: 0.07, hT: -0.28, tw: 0.85, hipX: 0.2, hipY: 2.75, lean: 0.02, sp: -0.12 });
        return {
          keys: [{ t: 0, p: FIN }, { t: 0.18, p: LET }, { t: 0.42, p: POINT }, { t: 0.85, p: pose(POINT, { hRx: 0.85, hRy: 6.3 }) }, { t: 1.4, p: pose(POINT, { hRy: 5.5, hT: -0.12 }) }],
          drop: { t: 0.2, vx: 0.8, vy: 1.5, spin: 3 },
          gait: trot(0.62, 5, POINT.hipX, dir),
        };
      },
      fist(dir) {
        const F1 = pose(FIN, { gr: 0, hipY: 2.45, lean: 0.22, sp: 0.15, hLx: 0.0, hLy: 4.55, hRx: 0.45, hRy: 4.45, eL: 1, eR: -1, headY: -0.02, hT: 0.08, tw: 0.9 });
        const F2 = pose(F1, { hLx: 0.08, hLy: 3.55, hRx: 0.4, hRy: 3.5, hipY: 2.38, hT: -0.1, headY: 0.03 });
        return {
          keys: [{ t: 0, p: FIN }, { t: 0.14, p: pose(FIN, { gr: 0.5 }) }, { t: 0.3, p: F1 }, { t: 0.44, p: F2 }, { t: 0.58, p: F1 }, { t: 0.72, p: F2 }, { t: 1.0, p: pose(F2, { hipY: 2.7, lean: 0.1 }) }, { t: 1.4, p: pose(F2, { hipY: 2.75, lean: 0.08, hLy: 3.4 }) }],
          drop: { t: 0.12, vx: -0.6, vy: 2.5, spin: -5 },
          gait: trot(0.95, 5.5, F2.hipX, dir),
        };
      },
      admire(dir) {
        const ADM = pose(FIN, { headY: 0.09, hT: -0.32, hipX: 0.15, hipY: 2.72, lean: -0.02, sp: -0.14, gr: 0, hRx: 0.9, hRy: 4.2, hLx: 0.35, hLy: 5.1, bat: 9.3 });
        const LOW = pose(ADM, { hLx: 0.7, hLy: 4.0, bat: 7.4, hT: -0.15 });
        return {
          keys: [{ t: 0, p: FIN }, { t: 0.3, p: ADM }, { t: 0.8, p: pose(ADM, { hT: -0.26, headY: 0.07 }) }, { t: 0.95, p: LOW }, { t: 1.4, p: LOW }],
          drop: { t: 0.97, vx: -1.2, vy: 0.5, spin: 2 },
          gait: trot(1.05, 3.6, LOW.hipX, dir),
        };
      },
    };
    const SLUMP = pose(B_BASE, {
      hipX: -0.1, hipY: 2.9, tw: 0.62, lean: -0.02, sp: -0.12, headY: -0.15, hT: 0.22,
      hLx: -0.45, hLy: 3.1, bat: -1.3, bl: 0.95, gr: 0, hRx: 0.05, hRy: 3.0, eL: -1, eR: 1,
      fLx: -0.75, fRx: 0.45, toeL: -0.3, toeR: 0.3,
    });
    const UMP = pose(SLUMP, { headY: -0.02, hT: -0.05, headX: 0.1, hRx: 0.65, hRy: 3.55, eR: 1, sp: 0, tw: 0.7 });
    return {
      hr: {
        build(rig, o) {
          const dir = o && o.dir ? o.dir : 1;
          const r = hr[rig.look.celebrate](dir);
          const g = r.gait;
          return anim({
            keys: r.keys, lock: true, react: true, keepProp: true, drop: r.drop, dur: 1.4,
            lag: { head: 0.04, handR: 0.03, hip: -0.02 },
            mod: (p, t) => gait(p, t, g),
          });
        },
      },
      kWalk: {
        build(rig, o) {
          const looking = o && o.looking && rig.rand() < 0.6;
          const shake = !looking && rig.rand() < 0.5;
          const keys = looking
            ? [{ t: 0, p: B_LAUNCH }, { t: 0.3, p: UMP }, { t: 0.6, p: UMP }, { t: 0.85, p: SLUMP }, { t: 3, p: SLUMP }]
            : [{ t: 0, p: FIN }, { t: 0.32, p: SLUMP }, { t: 3, p: SLUMP }];
          const t0 = looking ? 0.75 : 0.42;
          const g = { t0, x0: SLUMP.hipX, v: 3.1, dir: -1, step: 0.95, lift: 0.16, arms: 0.1, hy: 2.9, bob: 0.03, lean: 0.03 };
          return anim({
            keys, lock: true, react: true, hold: true, dur: 1.5,
            lag: { head: 0.05, bat: 0.04 },
            mod(p, t) {
              if (shake) p.headX += Math.sin(t * 15) * 0.045 * window4(t, 0.3, 0.4, 0.8, 0.9);
              return gait(p, t, g);
            },
          });
        },
      },
    };
  }

  function batterLib(look) {
    const b = batterBasics(look);
    return Object.assign(
      { stance: b.stance, load: b.load, swing: b.swing, enter: enterAnim(b.STANCE), adjust: adjustAnim(b.STANCE) },
      batterReactions(look),
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  function makePitcher(look) {
    return new Rig('pitcher', look);
  }
  function makeBatter(look) {
    return new Rig('batter', look);
  }

  // T maps figure space to screen; mirror for lefties.
  function transform(ox, oy, s, mirror) {
    const T = (q) => ({ x: ox + q.x * s * mirror, y: oy - q.y * s });
    T.s = s;
    T.m = mirror;
    return T;
  }

  function drawDust(ctx, T, d) {
    const a = 1 - d.age / 0.7;
    if (a <= 0) return;
    ctx.fillStyle = `rgba(201,150,100,${0.55 * a})`;
    for (let i = 0; i < 3; i++) {
      const r = (0.18 + d.age * (0.9 + i * 0.3)) * T.s;
      const P = T({ x: d.x + (i - 1) * 0.35 * (0.5 + d.age), y: 0.1 + d.age * 0.5 * (i === 1 ? 1.4 : 1) });
      ctx.beginPath();
      ctx.arc(P.x, P.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw a pitcher. Lefties are drawn by mirroring the screen transform.
  function drawPitcher(ctx, rig, ox, oy, s, color, hand) {
    const m = hand === 'L' ? -1 : 1;
    const p = rig.cur;
    const T = transform(ox, oy, s * rig.body.h, m);
    const inWindup = rig.name === 'windup';
    if (rig.dust) drawDust(ctx, T, rig.dust);
    return drawFigure(ctx, T, p, {
      kind: 'pitcher',
      color,
      body: rig.body,
      mirror: m,
      glove: 'R',
      farArm: inWindup && rig.t > 0.3 * W && rig.t < 0.95 * W ? 'L' : 'R',
      facing: p.tw < 0.5 ? -1 : 0,
      ball: inWindup && rig.t < WINDUP ? 'L' : null,
    });
  }

  function drawBatter(ctx, rig, ox, oy, s, color, hand, number) {
    const m = hand === 'L' ? -1 : 1;
    const T = transform(ox, oy, s * rig.body.h, m);
    const o = {
      kind: 'batter', color, number, mirror: m, batColor: '#2b303c', farArm: 'R', farLeg: 'R',
      body: rig.body, prop: rig.prop, noBat: !!rig.prop,
    };
    drawFigure(ctx, T, rig.cur, o);
    return o;
  }

  // Where the ball leaves the hand at release for this look, in the
  // behind-the-batter view's world coordinates (feet), at the release depth
  // main.js uses (z = 54). Mirrored for lefties.
  function releasePoint(look, hand) {
    const lk = normLook(look);
    const B = BODIES[lk.body];
    const p = fitBody(copyPose(releasePose(STYLES[lk.windup])), B);
    const j = solve(p, B);
    const fx = j.armL.end.x * B.h * (hand === 'L' ? -1 : 1);
    const fy = j.armL.end.y * B.h;
    if (BB.batView && BB.batView.figureToWorld) return BB.batView.figureToWorld(fx, fy, 54);
    const k = (54 + 16) / (60.5 + 16);
    return { x: fx * k, y: 5.5 - (5.5 - 0.8 - fy) * k, z: 54 };
  }

  BB.rig = {
    Rig, makePitcher, makeBatter, drawPitcher, drawBatter, drawFigure, transform, solve, releasePoint, normLook,
    WINDUP, SWING_CONTACT, BODIES, STYLES, STANCES, DEFAULT_LOOK,
  };
})(typeof window !== 'undefined' ? window : globalThis);
