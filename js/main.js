// Game loop, state machine, input and HUD.
(function () {
  'use strict';
  const BB = window.BB;
  const U = BB.U;
  const G = BB.game;
  const A = BB.audio;
  const $ = (id) => document.getElementById(id);

  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let DPR = 1;

  const SWING_LAG = BB.rig.SWING_CONTACT; // seconds from tap to the bat reaching the plate
  const WINDUP = BB.rig.WINDUP; // windup start to release (matches the pitcher animation)
  const PLAY_SPEED = 1.5; // field-view playback speed (game seconds per real second)
  const rng = Math.random;

  const S = {
    screen: 'title',
    paused: false,
    g: null,
    opts: null,
    view: 'bat',
    phase: 'idle',
    timers: [],
    pitch: null,
    swing: null,
    markers: [],
    hover: null,
    keyAim: { px: 0, py: 0 },
    pitchType: 'fb',
    stealArmed: false,
    stealBase: 0,
    play: null,
    playT: 0,
    playSpeed: 1,
    mitt: null,
    batted: null,
    flash: 0,
    batterKey: '',
    tagChoice: null,
    timeScale: 1, // tests can fast-forward
    pitcherRig: BB.rig.makePitcher(),
    batterRig: BB.rig.makeBatter(),
  };

  // ---------------------------------------------------------------------------
  // Timers (advance with game time so pausing freezes them)
  // ---------------------------------------------------------------------------
  function after(sec, fn) {
    S.timers.push({ t: sec, fn });
  }
  function runTimers(dt) {
    const due = [];
    for (const tm of S.timers) {
      tm.t -= dt;
      if (tm.t <= 0) due.push(tm);
    }
    if (due.length) {
      S.timers = S.timers.filter((tm) => tm.t > 0);
      due.forEach((tm) => tm.fn());
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const g = () => S.g;
  const playerBatting = () => S.g && G.playerBatting(S.g);
  function hexDist(a, b) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const dr = ((pa >> 16) & 255) - ((pb >> 16) & 255);
    const dg = ((pa >> 8) & 255) - ((pb >> 8) & 255);
    const db = (pa & 255) - (pb & 255);
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return h;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function ord(n) {
    return U.ordinal(n).toUpperCase();
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    BB.batView.layout(W, H);
    BB.fieldView.layout(W, H, 74, 64);
  }
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  function updateHUD() {
    const gm = g();
    if (!gm) return;
    const [away, home] = gm.teams;
    for (const [id, t, idx] of [['sb-away', away, 0], ['sb-home', home, 1]]) {
      const row = $(id);
      row.querySelector('.chip').style.background = t.color;
      row.querySelector('.abbr').textContent = t.abbr;
      row.querySelector('.runs').textContent = t.runs;
      row.classList.toggle('batting', gm.half === idx && !gm.over);
    }
    $('sb-half').innerHTML = gm.half === 0 ? '&#9650;' : '&#9660;';
    $('sb-inn').textContent = gm.inning;
    for (let b = 1; b <= 3; b++) $('sb-b' + b).classList.toggle('on', !!gm.bases[b - 1]);
    $('sb-o1').classList.toggle('on', gm.outs >= 1);
    $('sb-o2').classList.toggle('on', gm.outs >= 2);
    $('sb-count').textContent = `${gm.balls}-${gm.strikes}`;
    const bt = G.battingTeam(gm);
    const ft = G.fieldingTeam(gm);
    const b = G.currentBatter(gm);
    const st = b.stats;
    let today = st.pa ? `${st.h}-${st.ab}` : 'first at-bat';
    if (st.hr) today += st.hr > 1 ? `, ${st.hr} HR` : ', HR';
    if (st.bb) today += st.bb > 1 ? `, ${st.bb} BB` : ', BB';
    $('mu-batter').innerHTML =
      `<span class="tagchip" style="background:${bt.color}">${escapeHtml(bt.abbr)}</span>` +
      `<b>#${b.num} ${escapeHtml(b.name)}</b> &middot; ${b.pos} &middot; ${b.hand === 'L' ? 'L' : 'R'} &middot; ${today}`;
    const p = ft.pitcher;
    $('mu-pitcher').innerHTML = `Pitching: <b>${escapeHtml(p.name)}</b> &middot; ${p.stats.pitches} P ` + energyBar(p);
    updateSteal();
  }

  // Energy bar: green while fresh, gold below 50%, red below 25%, "Tired" once
  // the pitcher is past their stamina (control and velocity start to slip).
  function energyBar(p) {
    if (G.isTired(p)) return '<span class="tired">Tired</span>';
    const en = G.energy(p);
    const cls = en > 0.5 ? '' : en > 0.25 ? ' mid' : ' low';
    return `<span class="energy${cls}" title="Energy ${Math.round(en * 100)}%"><i style="width:${Math.round(en * 100)}%"></i></span>`;
  }

  function updateSteal() {
    const btn = $('btn-steal');
    const gm = g();
    const base = gm && playerBatting() && (S.phase === 'ready' || S.phase === 'windup') ? G.stealableBase(gm) : 0;
    btn.hidden = !base;
    if (base) {
      btn.textContent = S.stealArmed ? `RUNNER GOING TO ${ord(base)}` : `STEAL ${ord(base)}`;
      btn.classList.toggle('armed', S.stealArmed);
    } else {
      S.stealArmed = false;
    }
  }

  let callTimer = null;
  function showCall(text, cls, sub, dur) {
    const el = $('call');
    el.className = 'call show' + (cls ? ' ' + cls : '');
    el.innerHTML = escapeHtml(text) + (sub ? `<small>${escapeHtml(sub)}</small>` : '');
    clearTimeout(callTimer);
    callTimer = setTimeout(() => el.classList.remove('show'), (dur || 1.0) * 1000);
  }
  function hideCall() {
    $('call').classList.remove('show');
  }

  let infoTimer = null;
  function showPitchInfo(text, dur) {
    const el = $('pitch-info');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(infoTimer);
    if (dur) infoTimer = setTimeout(() => el.classList.remove('show'), dur * 1000);
  }
  function hidePitchInfo() {
    $('pitch-info').classList.remove('show');
  }

  function showBanner(main, sub, cls, dur, then) {
    const el = $('banner');
    el.hidden = false;
    el.className = 'banner' + (cls ? ' ' + cls : '');
    // Restart the entry animation.
    void el.offsetWidth;
    $('banner-main').textContent = main;
    $('banner-sub').textContent = sub || '';
    after(dur, () => {
      el.hidden = true;
      if (then) then();
    });
  }

  function setControls() {
    const inGame = S.screen === 'game' && !S.g.over;
    const batting = inGame && playerBatting();
    $('controls-bat').hidden = !(inGame && batting && S.view === 'bat' && (S.phase === 'ready' || S.phase === 'windup' || S.phase === 'flight'));
    $('controls-pitch').hidden = !(inGame && !batting && S.view === 'bat' && S.phase === 'ready');
    $('speed-hint').hidden = !(inGame && S.view === 'field' && S.phase === 'field');
    $('matchup').hidden = S.view === 'field';
    if (inGame && !batting) renderPitchButtons();
    updateSteal();
  }

  // Pitch buttons for your current pitcher's arsenal.
  function myPitcher() {
    return S.g ? S.g.teams[S.g.playerIdx].pitcher : null;
  }
  function renderPitchButtons() {
    const p = myPitcher();
    if (!p) return;
    if (!p.arsenal.some((a) => a.key === S.pitchType)) S.pitchType = p.arsenal[0].key;
    const box = $('pitch-buttons');
    const key = p.name + '|' + S.pitchType;
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.innerHTML = p.arsenal
        .map((a, i) => {
          const P = BB.PITCHES[a.key];
          const on = a.key === S.pitchType;
          return `<button class="pitch-btn${on ? ' sel' : ''}" data-pitch="${a.key}" role="radio" aria-checked="${on}"><b>${P.label}</b><small>${i + 1}</small></button>`;
        })
        .join('');
    }
  }
  $('pitch-buttons').addEventListener('click', (e) => {
    const b = e.target.closest('.pitch-btn');
    if (!b) return;
    e.stopPropagation();
    A.init();
    selectPitch(b.dataset.pitch);
  });

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------
  function startGame() {
    const st = BB.store.settings();
    const playerColor = st.color;
    let cpuDef;
    if (st.opponent === 'random') {
      const pool = BB.CPU_TEAMS.filter((t) => hexDist(t.color, playerColor) > 90);
      cpuDef = U.pick(rng, pool.length ? pool : BB.CPU_TEAMS);
    } else {
      cpuDef = BB.CPU_TEAMS.find((t) => t.id === st.opponent) || BB.CPU_TEAMS[0];
    }
    let cpuColor = cpuDef.color;
    if (hexDist(cpuColor, playerColor) < 90) {
      cpuColor = (BB.COLORS.find((c) => hexDist(c.hex, playerColor) > 140) || BB.COLORS[9]).hex;
    }
    const opts = {
      innings: st.innings,
      difficulty: st.difficulty,
      playerHome: st.playerHome,
      player: { name: st.teamName || 'My Team', abbr: BB.abbrFor(st.teamName || 'My Team'), color: playerColor, roster: BB.makeRoster(st.rosterSeed) },
      cpu: { name: cpuDef.name, abbr: cpuDef.abbr, color: cpuColor, roster: BB.makeRoster(hashStr(cpuDef.id)) },
    };
    if (opts.player.abbr === opts.cpu.abbr) opts.player.abbr = 'YOU';
    S.opts = opts;
    S.g = G.createGame(opts);
    S.screen = 'game';
    S.paused = false;
    S.timers = [];
    S.view = 'bat';
    S.phase = 'intro';
    S.markers = [];
    S.pitch = null;
    S.play = null;
    S.stealArmed = false;
    $('screen-title').hidden = true;
    $('screen-over').hidden = true;
    $('screen-pause').hidden = true;
    $('hud').hidden = false;
    $('tagup').hidden = true;
    $('banner').hidden = true;
    updateHUD();
    beginHalf();
  }

  function beginHalf() {
    const gm = g();
    S.view = 'bat';
    S.phase = 'intro';
    S.markers = [];
    S.pitch = null;
    S.mitt = null;
    S.batted = null;
    setControls();
    updateHUD();
    const half = gm.half === 0 ? 'TOP' : 'BOTTOM';
    const extra = gm.inning > gm.innings ? ' (EXTRA INNINGS)' : '';
    const sub = playerBatting() ? `${G.battingTeam(gm).name} batting. You're up!` : `${G.battingTeam(gm).name} batting. You're pitching.`;
    showBanner(`${half} ${ord(gm.inning)}${extra}`, sub, '', 1.6, startAtBat);
  }

  function startAtBat() {
    const gm = g();
    const key = gm.half + ':' + G.battingTeam(gm).order + ':' + gm.inning;
    const newBatter = key !== S.batterKey;
    if (newBatter) S.markers = [];
    S.batterKey = key;
    if (newBatter) S.batterRig.play('enter', 0);
    // The CPU manager may go to the bullpen before a new batter.
    const change = newBatter ? G.cpuPitchingChange(gm) : -1;
    if (change >= 0) {
      const team = G.fieldingTeam(gm);
      G.changePitcher(gm, team, change);
      const np = team.pitcher;
      S.phase = 'change';
      setControls();
      updateHUD();
      showBanner('PITCHING CHANGE', `${team.name} bring in ${np.name} (${np.hand}HP) · ${np.arsenal.map((a) => BB.PITCHES[a.key].label).join(', ')}`, '', 1.9, readyPitch);
      return;
    }
    readyPitch();
  }

  function readyPitch() {
    const gm = g();
    S.view = 'bat';
    S.phase = 'ready';
    S.pitch = null;
    S.batted = null;
    S.stealBase = 0;
    S.playSpeed = 1;
    hidePitchInfo();
    updateHUD();
    setControls();
    // Pitcher leans in for the sign; the batter settles in (unless mid-routine).
    S.pitcherRig.play('sign', 0.5);
    if (!S.batterRig.busy() && S.batterRig.name !== 'stance') S.batterRig.play('stance', 0.5);
    if (playerBatting()) {
      // Wait for the batter's routine, then the pitcher comes set and delivers.
      const delay = Math.max(U.rand(rng, 1.0, 1.7), S.batterRig.remaining() + 0.5);
      after(delay - 0.5, () => {
        if (S.phase === 'ready') S.pitcherRig.play('set', 0.4);
      });
      after(delay, () => {
        if (S.phase !== 'ready') return;
        const choice = G.cpuChoosePitch(gm, rng);
        const loc = G.applyCommand(choice.target, choice.sigma, rng);
        windup({ type: choice.type, target: choice.target, loc });
      });
    } else {
      $('pitch-hint').textContent = 'Tap the zone to throw';
      const mp = myPitcher();
      if (G.isTired(mp) && !mp.warned) {
        mp.warned = true;
        showPitchInfo(`${mp.name} is tiring. Tap BULLPEN (B) for a reliever.`, 3);
      }
    }
  }

  function playerSigma() {
    return G.pitchSpec(g(), myPitcher(), S.pitchType, true).sigma;
  }

  function throwPitch(px, py) {
    if (S.phase !== 'ready' || playerBatting()) return;
    const target = { px: U.clamp(px, -2.2, 2.2), py: U.clamp(py, -2.0, 2.0) };
    const loc = G.applyCommand(target, playerSigma(), rng);
    A.click();
    windup({ type: S.pitchType, target, loc });
  }

  function windup(choice) {
    const gm = g();
    const ft = G.fieldingTeam(gm);
    const hand = ft.pitcher.hand;
    const type = choice.type;
    const P = BB.PITCHES[type];
    const sgn = hand === 'L' ? -1 : 1;
    const spec = G.pitchSpec(gm, ft.pitcher, type, ft.isPlayer);
    const travel = spec.travel * U.rand(rng, 0.97, 1.03);
    const brk = 0.75 + 0.25 * spec.q; // better pitches move more
    S.pitch = {
      type,
      target: choice.target,
      loc: choice.loc,
      travel,
      mph: Math.round(spec.mph + U.rand(rng, -1, 1)),
      q: spec.q,
      velo: spec.velo,
      fatigue: spec.fatigue,
      hand,
      R: { x: -1.45 * sgn, y: 5.95, z: 54 }, // matches the pitcher's release pose
      B: { x: P.breakX * sgn * brk, y: P.breakY * brk },
      t: 0,
      wind: 0,
      swung: false,
      contactAt: null,
      contactDone: false,
      result: null,
      cpuSwingAt: null,
    };
    S.phase = 'windup';
    S.mitt = null;
    S.pitcherRig.play('windup', 0.15);
    S.batterRig.play('load', 0.3);
    setControls();
  }

  function release() {
    const gm = g();
    const p = S.pitch;
    S.phase = 'flight';
    p.t = 0;
    A.release();
    // Steals
    if (playerBatting()) {
      const base = G.stealableBase(gm);
      S.stealBase = S.stealArmed && base ? base : 0;
      S.stealArmed = false;
      if (S.stealBase) showPitchInfo(`Runner going to ${U.ordinal(S.stealBase)}!`, 1.4);
    } else {
      S.stealBase = G.cpuStealDecision(gm, rng);
      if (S.stealBase) showPitchInfo(`Runner going to ${U.ordinal(S.stealBase)}!`, 1.4);
    }
    if (!playerBatting()) {
      const delta = G.cpuSwing(gm, { type: p.type, loc: p.loc, q: p.q, velo: p.velo, fatigue: p.fatigue }, rng);
      if (delta !== null) p.cpuSwingAt = p.travel + delta / 1000 - SWING_LAG;
    }
    const showType = !playerBatting() || gm.diff.showPitchType;
    if (showType && !S.stealBase) showPitchInfo(`${BB.PITCHES[p.type].name} · ${p.mph} mph`);
    setControls();
  }

  // 3D position of the pitch at time t after release.
  function pitchPos(p, t) {
    const u = t / p.travel;
    const T = BB.batView.zoneToWorld(p.loc.px, p.loc.py);
    if (u <= 1) {
      return {
        x: p.R.x + (T.x - p.B.x - p.R.x) * u + p.B.x * u * u,
        y: p.R.y + (T.y - p.B.y - p.R.y) * u + p.B.y * u * u,
        z: p.R.z * (1 - u),
      };
    }
    const vx = T.x - p.R.x + p.B.x;
    const vy = T.y - p.R.y + p.B.y;
    return { x: T.x + vx * (u - 1), y: T.y + vy * (u - 1), z: -p.R.z * (u - 1) };
  }

  function doSwing() {
    const p = S.pitch;
    if (!p || p.swung || S.phase !== 'flight') return;
    p.swung = true;
    // The swing animation reaches the ball at SWING_LAG, the same moment contact is judged.
    const at = BB.batView.zoneToWorld(p.loc.px, p.loc.py);
    const dir = G.currentBatter(g()).hand === 'L' ? -1 : 1;
    // Figure space: the batter stands 2.35 ft off the plate, facing it.
    S.batterRig.play('swing', 0.02, { ballY: at.y, ballX: 2.35 + dir * at.x });
    p.contactAt = p.t + SWING_LAG;
    p.delta = (p.contactAt - p.travel) * 1000;
  }

  function timingWord(delta, win) {
    const a = Math.abs(delta);
    if (a <= win.perfect) return 'Perfect timing!';
    const side = delta < 0 ? 'early' : 'late';
    if (a <= win.good) return `A bit ${side}`;
    if (a <= win.foul) return `${side === 'early' ? 'Early' : 'Late'}`;
    return `Way ${side}`;
  }

  function resolveContact() {
    const gm = g();
    const p = S.pitch;
    p.contactDone = true;
    const b = G.currentBatter(gm);
    const pb = playerBatting();
    // Better pitches shrink your timing window; a tired pitcher widens it.
    const pm = (b.contact / p.q) * (1 + 0.1 * p.fatigue);
    const win = pb
      ? {
          perfect: gm.diff.windows.perfect * pm,
          good: gm.diff.windows.good * pm,
          foul: gm.diff.windows.foul * pm,
        }
      : BB.CPU_WINDOWS;
    const powerMul = pb ? 1 : gm.diff.cpuPower;
    const sw = BB.sim.contact(p.delta, win, p.loc, b, rng, powerMul, G.contactFx(p));
    if (pb) showPitchInfo(timingWord(p.delta, win) + (gm.diff.showPitchType ? '' : ` · ${BB.PITCHES[p.type].name}`), 1.6);
    p.result = sw.kind;
    if (sw.kind === 'miss') {
      A.whoosh();
      return;
    }
    const at = pitchPos(p, p.t);
    S.markers.push({ px: p.loc.px, py: p.loc.py, strike: true });
    if (sw.kind === 'foul') {
      A.foulTip();
      A.crack(0.25);
      const back = rng() < 0.6;
      const side = rng() < 0.5 ? -1 : 1;
      S.batted = {
        t: 0,
        from: at,
        v: back ? { x: side * U.rand(rng, 5, 20), y: U.rand(rng, 35, 60), z: -U.rand(rng, 40, 70) } : { x: side * U.rand(rng, 60, 90), y: U.rand(rng, 15, 40), z: U.rand(rng, 20, 60) },
      };
      after(0.7, () => pitchOutcome(G.foulBall(gm, p.type), 'foul'));
      return;
    }
    // In play (may still turn out foul).
    A.crack(sw.quality);
    const play = BB.sim.simulate({
      swing: sw,
      batter: { idx: b.slot, name: b.name, speed: b.speed, hand: b.hand },
      bases: gm.bases,
      outs: gm.outs,
      defenseQuality: G.defenseQuality(gm),
      rng,
      stealing: S.stealBase ? S.stealBase - 1 : 0,
    });
    const vh = sw.ev * Math.cos(U.rad(sw.phi));
    S.batted = {
      t: 0,
      from: at,
      v: { x: Math.sin(U.rad(sw.theta)) * vh, y: sw.ev * Math.sin(U.rad(sw.phi)), z: Math.cos(U.rad(sw.theta)) * vh },
      ground: sw.phi < 8,
    };
    S.flash = sw.quality >= 0.95 ? 0.32 : 0.14;
    if (play.result && play.result.foul) {
      after(0.8, () => pitchOutcome(G.foulBall(gm, p.type), 'foul'));
      return;
    }
    S.play = play;
    if (sw.quality >= 0.95 && pb) showCall('CRUSHED!', 'good high', null, 0.6);
    after(0.45, enterField);
  }

  // Pitch finished without a ball in play.
  function endPitchNoContact() {
    const gm = g();
    const p = S.pitch;
    S.phase = 'result';
    const strike = G.isStrike(p.loc);
    S.markers.push({ px: p.loc.px, py: p.loc.py, strike: strike || p.swung });
    S.mitt = { px: p.loc.px, py: p.loc.py, age: 0 };
    A.mitt();
    if (!gm.diff.showPitchType && playerBatting() && !p.swung) showPitchInfo(`${BB.PITCHES[p.type].name} · ${p.mph} mph`, 1.6);
    const ev = p.swung ? G.swingMiss(gm, p.type) : G.takePitch(gm, strike, p.type);
    after(p.swung ? 0.5 : 0.25, () => {
      if (S.phase === 'result' && !S.batterRig.busy()) S.batterRig.play('stance', 0.6);
    });
    pitchOutcome(ev, p.swung ? 'miss' : strike ? 'strike' : 'ball');
  }

  function callFor(ev) {
    const pb = playerBatting();
    switch (ev.type) {
      case 'ball':
        return { text: 'BALL', cls: '', ump: 'Ball' };
      case 'strike':
        return { text: ev.label, cls: '', ump: 'Strike!' };
      case 'foul':
        return { text: 'FOUL BALL', cls: '', ump: 'Foul ball' };
      case 'strikeout':
        return { text: ev.label, cls: pb ? 'bad' : 'good', ump: 'Strike three!' };
      case 'walk':
        return { text: ev.runs ? 'BALL FOUR · RUN SCORES' : 'BALL FOUR', cls: pb ? 'good' : 'bad', ump: 'Ball four' };
      default:
        return { text: ev.label, cls: '', ump: '' };
    }
  }

  function pitchOutcome(ev, kind) {
    const gm = g();
    S.phase = 'result';
    const wasBatting = gm.half; // half before any change
    const c = callFor(ev);
    const countSub = ev.type === 'ball' || ev.type === 'strike' || ev.type === 'foul' ? `${gm.balls}-${gm.strikes}` : null;
    showCall(c.text, c.cls, countSub, 1.0);
    if (c.ump) A.ump(c.ump);
    // Now and then the batter steps out to adjust between pitches.
    if ((ev.type === 'ball' || ev.type === 'strike' || ev.type === 'foul') && rng() < 0.3) {
      after(0.6, () => {
        if (S.phase === 'result' || S.phase === 'ready') S.batterRig.play('adjust', 0.4);
      });
    }
    if (ev.type === 'strikeout') (playerBatting() ? A.groan : () => A.cheer(0.35))();
    if (ev.type === 'walk' && ev.runs) A.cheer(0.5);
    updateHUD();
    setControls();
    // Steal attempt resolves on pitches not put in play.
    const base = S.stealBase;
    S.stealBase = 0;
    if (base && kind !== 'foul' && ev.type !== 'walk' && !ev.halfOver && gm.half === wasBatting && G.stealableBase(gm) === base) {
      after(0.9, () => {
        const runner = gm.bases[base - 2];
        const pen = playerBatting() ? gm.diff.cpuCatcher : 0;
        const res = BB.sim.stealResult(runner, base, S.pitch ? S.pitch.type : 'fb', pen, rng);
        const sev = G.steal(gm, base, res.safe);
        const good = playerBatting() === res.safe;
        showCall(res.safe ? 'SAFE!' : 'OUT!', good ? 'good' : 'bad', res.safe ? `Stolen base · ${runner.name}` : `Caught stealing · ${runner.name}`, 1.1);
        A.ump(res.safe ? 'Safe!' : "He's out!");
        if (good) A.cheer(0.4);
        updateHUD();
        after(1.2, () => afterEvent(sev));
      });
      return;
    }
    after(ev.type === 'ball' || ev.type === 'strike' || ev.type === 'foul' ? 1.0 : 1.4, () => afterEvent(ev));
  }

  function afterEvent(ev) {
    const gm = g();
    updateHUD();
    if (ev && ev.gameOver) {
      S.phase = 'over';
      setControls();
      const [away, home] = gm.teams;
      const playerWon = gm.winner === gm.playerIdx;
      let main = gm.winner === null ? 'TIE GAME' : playerWon ? 'YOU WIN!' : 'YOU LOSE';
      if (gm.endReason === 'walkoff') main = playerWon ? 'WALK-OFF WIN!' : 'WALK-OFF LOSS';
      if (playerWon) {
        A.organ();
        A.cheer(1);
      } else if (gm.winner !== null) A.groan();
      showBanner(main, `${away.abbr} ${away.runs}, ${home.abbr} ${home.runs}`, playerWon ? 'good' : gm.winner === null ? '' : 'bad', 2.4, showGameOver);
      return;
    }
    if (ev && ev.halfOver) {
      S.phase = 'halfend';
      setControls();
      const [away, home] = gm.teams;
      const label = gm.half === 0 ? `MIDDLE ${ord(gm.inning)}` : `END OF ${ord(gm.inning)}`;
      showBanner(label, `${away.abbr} ${away.runs}, ${home.abbr} ${home.runs}`, '', 1.6, () => {
        G.startNextHalf(gm);
        beginHalf();
      });
      return;
    }
    startAtBat();
  }

  // ---------------------------------------------------------------------------
  // Field view (ball in play)
  // ---------------------------------------------------------------------------
  function enterField() {
    S.view = 'field';
    S.phase = 'field';
    S.playT = 0;
    S.playSpeed = 1;
    S.lastPlayT = 0;
    hidePitchInfo();
    hideCall();
    setControls();
  }

  function fieldSounds(t0, t1) {
    const script = S.play.script;
    for (const e of script.events) {
      if (e.t > t0 && e.t <= t1) {
        if (e.kind === 'out') {
          A.glove();
          A.ump('Out!');
          if (!playerBatting()) A.cheer(0.3);
        } else if (e.kind === 'score') {
          if (playerBatting()) A.cheer(0.7);
          else A.groan();
        } else if (e.kind === 'hr') {
          if (playerBatting()) {
            A.cheer(1);
            A.organ();
          } else A.groan();
        } else if (e.kind === 'safe' && e.text === 'SAFE!') {
          A.ump('Safe!');
        }
      }
    }
    for (const seg of script.ball) {
      if (seg.kind === 'throw' && seg.t1 > t0 && seg.t1 <= t1) A.glove();
    }
  }

  function updateField(dt) {
    const play = S.play;
    if (S.phase === 'tagup') return;
    const prev = S.playT;
    S.playT += dt * PLAY_SPEED * S.playSpeed;
    if (play.tagUp && !play.tagUp.resolved && S.playT >= play.tagUp.tC) {
      S.playT = play.tagUp.tC;
      if (playerBatting()) {
        askTagUp();
        fieldSounds(prev, S.playT);
        return;
      }
      BB.sim.resolveTagUp(play, G.cpuTagUp(play.tagUp.margin));
    }
    fieldSounds(prev, S.playT);
    if (S.playT >= play.script.end) finishPlay();
  }

  function askTagUp() {
    const tu = S.play.tagUp;
    S.phase = 'tagup';
    setControls();
    const r = tu.runner;
    $('tagup-title').textContent = tu.target === 4 ? `Send ${r.name} home?` : `Send ${r.name} to 3rd?`;
    let sub = 'Caught! The runner can tag up and run.';
    if (g().diff.label === 'Easy') {
      sub = tu.margin > 0.45 ? 'Deep fly. Looks safe.' : tu.margin > 0 ? 'It will be close.' : 'Shallow. Risky.';
    }
    $('tagup-sub').textContent = sub;
    $('tagup').hidden = false;
  }

  function answerTagUp(send) {
    if (S.phase !== 'tagup') return;
    $('tagup').hidden = true;
    BB.sim.resolveTagUp(S.play, send);
    S.phase = 'field';
    setControls();
  }

  function finishPlay() {
    const gm = g();
    const play = S.play;
    S.phase = 'playresult';
    setControls();
    const pb = playerBatting();
    const r = play.result;
    const ev = G.inPlay(gm, r, S.pitch.type);
    const goodForBatter = r.hit || r.scored.length > 0;
    const cls = goodForBatter === pb ? 'good' : 'bad';
    let sub = r.desc;
    if (r.kind === 'hr' && r.hrDist) sub += ` ${r.hrDist} ft.`;
    showBanner(r.label, sub, cls + ' low', r.kind === 'hr' ? 2.4 : 1.9, () => {
      S.view = 'bat';
      S.play = null;
      afterEvent(ev);
    });
    updateHUD();
  }

  // ---------------------------------------------------------------------------
  // Update & render
  // ---------------------------------------------------------------------------
  function update(dt) {
    runTimers(dt);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2.2);
    if (S.mitt) S.mitt.age += dt * 1.4;
    if (S.batted) S.batted.t += dt;
    const p = S.pitch;
    if (S.phase === 'windup' && p) {
      p.wind += dt;
      if (p.wind >= WINDUP) release();
    } else if (S.phase === 'flight' && p) {
      p.t += dt;
      if (p.cpuSwingAt !== null && !p.swung && p.t >= p.cpuSwingAt) doSwing();
      if (p.contactAt !== null && !p.contactDone && p.t >= p.contactAt) resolveContact();
      const contacted = p.result === 'inplay' || p.result === 'foul';
      if (!contacted && p.t >= p.travel * 1.07) endPitchNoContact();
      else if (contacted) S.phase = 'contact';
    }
    if (S.view === 'field' && S.play && (S.phase === 'field' || S.phase === 'tagup')) updateField(dt);
    else if (S.view === 'field' && S.play && S.phase === 'playresult') {
      // Let the last moments of the play keep moving under the banner.
      S.playT = Math.min(S.play.script.end + 1.5, S.playT + dt * PLAY_SPEED);
    }
  }

  function render() {
    if (S.screen !== 'game' || !S.g) {
      renderIdle();
      return;
    }
    const gm = g();
    if (S.view === 'field' && S.play) {
      BB.fieldView.draw(ctx, {
        script: S.play.script,
        t: S.playT,
        fieldColor: G.fieldingTeam(gm).color,
        batColor: G.battingTeam(gm).color,
      });
      return;
    }
    const bt = G.battingTeam(gm);
    const ft = G.fieldingTeam(gm);
    const b = G.currentBatter(gm);
    const p = S.pitch;
    let ball = null;
    const trail = [];
    if (p) {
      // Ball position at time tt, plus a short motion trail behind it.
      let at = null;
      if (S.batted) {
        const B = S.batted;
        at = (tt) => {
          if (tt < 0) return null;
          let y = B.from.y + B.v.y * tt - 16.1 * tt * tt;
          if (y < 0) y = B.ground ? Math.abs(Math.sin(tt * 12)) * 1.2 : 0;
          const q = { x: B.from.x + B.v.x * tt, y, z: B.from.z + B.v.z * tt };
          return q.z < -15 ? null : q;
        };
        ball = at(B.t);
        for (let k = 1; k <= 5; k++) {
          const q = at(B.t - k * 0.018);
          if (q) trail.push(q);
        }
      } else if (S.phase === 'flight' || S.phase === 'contact') {
        at = (tt) => (tt < 0 ? null : pitchPos(p, tt));
        const pos = at(p.t);
        if (pos.z > -3.5) {
          ball = pos;
          for (let k = 1; k <= 5; k++) {
            const q = at(p.t - k * 0.02);
            if (q) trail.push(q);
          }
        }
      }
    }
    let hint = null;
    if (p && S.phase === 'flight' && playerBatting() && gm.diff.showLocation && p.t > p.travel * 0.3 && !p.swung) {
      hint = { px: p.loc.px, py: p.loc.py, alpha: U.clamp((p.t / p.travel - 0.3) * 2, 0, 0.9) };
    }
    let aim = null;
    if (!playerBatting() && S.phase === 'ready') {
      const h = S.hover || S.keyAim;
      aim = { px: h.px, py: h.py, sigma: playerSigma() };
    }
    BB.batView.draw(ctx, {
      fieldColor: ft.color,
      batColor: bt.color,
      pitcherHand: ft.pitcher.hand,
      batterHand: b.hand,
      batterNum: b.num,
      pitcherRig: S.pitcherRig,
      batterRig: S.batterRig,
      ball,
      trail,
      ballGlow: !!S.batted,
      markers: S.markers,
      hint,
      aim,
      aiming: !playerBatting() && S.phase === 'ready',
      mitt: S.mitt && S.mitt.age < 1 ? S.mitt : null,
      flash: S.flash,
    });
  }

  // Title backdrop: the empty ballpark.
  function renderIdle() {
    BB.batView.draw(ctx, {
      fieldColor: '#24427a',
      batColor: BB.store.settings().color,
      pitcherHand: 'R',
      batterHand: 'R',
      batterNum: 7,
      pitcherRig: S.pitcherRig,
      batterRig: S.batterRig,
      ball: null,
      markers: [],
    });
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) * S.timeScale;
    last = now;
    if (S.screen === 'game' && !S.paused) update(dt);
    if (!S.paused) {
      S.pitcherRig.update(dt);
      S.batterRig.update(dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function pointerZone(e) {
    const rect = canvas.getBoundingClientRect();
    return BB.batView.screenToZone(e.clientX - rect.left, e.clientY - rect.top);
  }
  function inAimArea(z) {
    return Math.abs(z.px) <= 2.4 && Math.abs(z.py) <= 2.2;
  }

  function primaryAction() {
    if (S.screen !== 'game' || S.paused) return;
    if (S.phase === 'flight' && playerBatting()) doSwing();
    else if (S.phase === 'field') S.playSpeed = 3;
  }

  canvas.addEventListener('pointerdown', (e) => {
    A.init();
    if (S.screen !== 'game' || S.paused) return;
    if (S.phase === 'ready' && !playerBatting() && S.view === 'bat') {
      const z = pointerZone(e);
      if (inAimArea(z)) {
        S.hover = z;
        throwPitch(z.px, z.py);
      }
      return;
    }
    primaryAction();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (S.screen !== 'game' || e.pointerType === 'touch') return;
    if (S.phase === 'ready' && !playerBatting()) {
      const z = pointerZone(e);
      S.hover = inAimArea(z) ? z : null;
    }
  });

  function selectPitch(type) {
    if (!BB.PITCHES[type]) return;
    S.pitchType = type;
    A.click();
    setControls();
  }

  // ---------------------------------------------------------------------------
  // Bullpen
  // ---------------------------------------------------------------------------
  function canUseBullpen() {
    return S.screen === 'game' && !S.paused && S.g && !S.g.over && !playerBatting() && S.phase === 'ready' && S.view === 'bat';
  }
  function openBullpen() {
    if (!canUseBullpen()) return;
    A.init();
    const gm = g();
    const team = gm.teams[gm.playerIdx];
    const list = $('bp-list');
    list.innerHTML = team.staff
      .map((p, i) => {
        const cur = p === team.pitcher;
        const status = cur ? 'Pitching now' : p.done ? 'Out of the game' : 'Ready';
        const role = { SP: 'Starter', RP: 'Reliever', CL: 'Closer' }[p.role];
        const velo = Math.round(gm.diff.mphFb + p.velo);
        const ctl = p.control < 0.96 ? 'Good control' : p.control > 1.05 ? 'Wild' : 'Average control';
        return (
          `<button class="bp-row${cur ? ' current' : ''}" data-i="${i}" ${cur || p.used ? 'disabled' : ''}>` +
          `<div><span class="bp-name">${escapeHtml(p.name)}</span><span class="bp-role">${role}</span> <small>${p.hand}HP</small></div>` +
          `<div class="bp-status">${status}<br>${energyBar(p)}</div>` +
          `<div class="bp-pitches">${p.arsenal.map((a) => `<span>${BB.PITCHES[a.key].label}</span>`).join('')} &middot; ${velo} mph &middot; ${ctl}</div>` +
          `</button>`
        );
      })
      .join('');
    $('bp-sub').textContent = `${team.pitcher.name} has thrown ${team.pitcher.stats.pitches} pitches. A pitcher who comes out can't go back in.`;
    S.paused = true;
    $('screen-bullpen').hidden = false;
  }
  function closeBullpen() {
    $('screen-bullpen').hidden = true;
    S.paused = false;
  }
  function bringIn(i) {
    const gm = g();
    const team = gm.teams[gm.playerIdx];
    closeBullpen();
    if (!G.changePitcher(gm, team, i)) return;
    const np = team.pitcher;
    S.phase = 'change';
    S.pitchType = np.arsenal[0].key;
    setControls();
    updateHUD();
    A.click();
    showBanner('PITCHING CHANGE', `${np.name} takes the mound · ${np.arsenal.map((a) => BB.PITCHES[a.key].label).join(', ')}`, '', 1.6, readyPitch);
  }
  $('bp-list').addEventListener('click', (e) => {
    const b = e.target.closest('.bp-row');
    if (b && !b.disabled) bringIn(+b.dataset.i);
  });
  $('btn-bp-close').addEventListener('click', closeBullpen);
  $('btn-bullpen').addEventListener('click', (e) => {
    e.stopPropagation();
    openBullpen();
  });

  function toggleSteal() {
    const gm = g();
    if (!gm || !playerBatting() || !(S.phase === 'ready' || S.phase === 'windup') || !G.stealableBase(gm)) return;
    S.stealArmed = !S.stealArmed;
    A.click();
    updateSteal();
  }
  $('btn-steal').addEventListener('click', (e) => {
    e.stopPropagation();
    A.init();
    toggleSteal();
  });
  $('btn-send').addEventListener('click', () => answerTagUp(true));
  $('btn-hold').addEventListener('click', () => answerTagUp(false));

  function setPaused(p) {
    if (S.screen !== 'game' || (S.g && S.g.over && p)) return;
    S.paused = p;
    $('screen-pause').hidden = !p;
  }
  $('btn-pause').addEventListener('click', () => setPaused(true));
  $('btn-resume').addEventListener('click', () => setPaused(false));
  $('btn-quit').addEventListener('click', () => {
    S.paused = false;
    $('screen-pause').hidden = true;
    toTitle();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.screen === 'game' && !S.paused && !(S.g && S.g.over)) setPaused(true);
  });

  function setMuted(m) {
    A.setMuted(m);
    $('btn-mute').innerHTML = m ? '&#128263;' : '&#128266;';
    $('btn-mute').setAttribute('aria-label', m ? 'Unmute' : 'Mute');
    BB.store.setSettings({ muted: m });
  }
  $('btn-mute').addEventListener('click', () => {
    A.init();
    setMuted(!A.isMuted());
  });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (S.screen === 'title') {
      if (k === 'enter' && document.activeElement && document.activeElement.tagName !== 'BUTTON' && document.activeElement.tagName !== 'SUMMARY') {
        A.init();
        startGame();
      }
      return;
    }
    if (S.screen !== 'game') return;
    if (!$('screen-bullpen').hidden) {
      if (k === 'escape' || k === 'b') closeBullpen();
      return;
    }
    if (k === 'p' || k === 'escape') {
      setPaused(!S.paused);
      e.preventDefault();
      return;
    }
    if (k === 'm') {
      A.init();
      setMuted(!A.isMuted());
      return;
    }
    if (S.paused) return;
    A.init();
    if (S.phase === 'tagup') {
      if (k === 'y') answerTagUp(true);
      if (k === 'n') answerTagUp(false);
      return;
    }
    if (/^[1-5]$/.test(k)) {
      const mp = myPitcher();
      if (!playerBatting() && mp && mp.arsenal[+k - 1]) selectPitch(mp.arsenal[+k - 1].key);
      return;
    }
    if (k === 'b') {
      openBullpen();
      return;
    }
    if (k === 's') {
      toggleSteal();
      return;
    }
    if (!playerBatting() && S.phase === 'ready' && S.view === 'bat') {
      const step = 0.25;
      const a = S.keyAim;
      if (k === 'arrowleft') a.px = Math.max(-2, a.px - step);
      else if (k === 'arrowright') a.px = Math.min(2, a.px + step);
      else if (k === 'arrowup') a.py = Math.min(1.8, a.py + step);
      else if (k === 'arrowdown') a.py = Math.max(-1.8, a.py - step);
      else if (k === ' ' || k === 'enter') throwPitch(a.px, a.py);
      else return;
      S.hover = null;
      e.preventDefault();
      return;
    }
    if (k === ' ' || k === 'enter') {
      e.preventDefault();
      primaryAction();
    }
  });

  // ---------------------------------------------------------------------------
  // Title / setup screen
  // ---------------------------------------------------------------------------
  function toTitle() {
    S.screen = 'title';
    S.g = null;
    S.timers = [];
    S.pitcherRig.play('sign', 0.4);
    S.batterRig.play('stance', 0.4);
    $('hud').hidden = true;
    $('screen-over').hidden = true;
    $('screen-title').hidden = false;
    renderRecords();
  }

  function setSeg(id, value) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('sel', b.dataset.v === String(value)));
  }

  const DIFF_NOTES = {
    easy: 'Slower pitches, a wide timing window, and a ring that shows where each pitch will cross the plate.',
    medium: 'Real pitch mix. The pitch type shows at release, but not where it will go.',
    hard: 'Fast pitches, a tight timing window, no pitch labels, and a CPU that lays off bad pitches.',
  };

  function initTitle() {
    const st = BB.store.settings();
    $('team-name').value = st.teamName;
    $('team-name').addEventListener('input', (e) => {
      BB.store.setSettings({ teamName: e.target.value.trim() || 'My Team' });
    });
    const sw = $('swatches');
    BB.COLORS.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = c.hex;
      b.setAttribute('aria-label', c.name);
      b.setAttribute('role', 'radio');
      b.dataset.hex = c.hex;
      b.addEventListener('click', () => {
        BB.store.setSettings({ color: c.hex });
        markSwatches();
      });
      sw.appendChild(b);
    });
    function markSwatches() {
      const cur = BB.store.settings().color;
      sw.querySelectorAll('.swatch').forEach((b) => {
        b.classList.toggle('sel', b.dataset.hex === cur);
        b.setAttribute('aria-checked', b.dataset.hex === cur ? 'true' : 'false');
      });
    }
    markSwatches();
    const sel = $('opponent');
    sel.innerHTML = '<option value="random">Random opponent</option>' + BB.CPU_TEAMS.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
    sel.value = st.opponent;
    sel.addEventListener('change', () => BB.store.setSettings({ opponent: sel.value }));

    setSeg('seg-innings', st.innings);
    setSeg('seg-side', st.playerHome ? 'home' : 'away');
    setSeg('seg-diff', st.difficulty);
    $('diff-note').textContent = DIFF_NOTES[st.difficulty];
    document.querySelectorAll('#seg-innings button').forEach((b) =>
      b.addEventListener('click', () => {
        BB.store.setSettings({ innings: +b.dataset.v });
        setSeg('seg-innings', b.dataset.v);
      }),
    );
    document.querySelectorAll('#seg-side button').forEach((b) =>
      b.addEventListener('click', () => {
        BB.store.setSettings({ playerHome: b.dataset.v === 'home' });
        setSeg('seg-side', b.dataset.v);
      }),
    );
    document.querySelectorAll('#seg-diff button').forEach((b) =>
      b.addEventListener('click', () => {
        BB.store.setSettings({ difficulty: b.dataset.v });
        setSeg('seg-diff', b.dataset.v);
        $('diff-note').textContent = DIFF_NOTES[b.dataset.v];
      }),
    );
    $('btn-play').addEventListener('click', () => {
      A.init();
      startGame();
    });
    $('btn-again').addEventListener('click', () => {
      A.init();
      startGame();
    });
    $('btn-menu').addEventListener('click', toTitle);
    setMuted(!!st.muted);
    renderRecords();
  }

  function renderRecords() {
    const r = BB.store.records();
    const diffs = ['easy', 'medium', 'hard'];
    const played = diffs.some((d) => r.byDiff[d].w + r.byDiff[d].l + r.byDiff[d].t > 0);
    if (!played) {
      $('records-body').innerHTML = '<p class="empty">No games played yet. Your wins, losses and personal bests show up here.</p>';
      return;
    }
    let html = '<table><tr><th></th><th>W</th><th>L</th><th>T</th></tr>';
    for (const d of diffs) {
      const x = r.byDiff[d];
      html += `<tr><td>${BB.DIFFICULTIES[d].label}</td><td>${x.w}</td><td>${x.l}</td><td>${x.t}</td></tr>`;
    }
    html += '</table>';
    const labels = { runs: 'Most runs', hr: 'Most home runs', hits: 'Most hits', k: 'Most strikeouts', margin: 'Biggest win' };
    const bests = Object.keys(labels).filter((k) => r.best[k]);
    if (bests.length) {
      html += '<h4>Personal bests</h4><table>';
      for (const k of bests) {
        const b = r.best[k];
        html += `<tr><td>${labels[k]}</td><td>${b.value}</td><td>${BB.DIFFICULTIES[b.diff].label}</td></tr>`;
      }
      html += '</table>';
    }
    if (r.recent.length) {
      html += '<h4>Recent games</h4><table>';
      for (const x of r.recent) {
        html += `<tr><td>${x.result}</td><td>${x.you}-${x.opp} vs ${escapeHtml(x.oppName)}</td><td>${BB.DIFFICULTIES[x.diff].label}, ${x.innings} inn</td></tr>`;
      }
      html += '</table>';
    }
    $('records-body').innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // Game over / box score
  // ---------------------------------------------------------------------------
  function ip(outs) {
    return `${Math.floor(outs / 3)}.${outs % 3}`;
  }

  function showGameOver() {
    if (leagueGameOver()) return; // franchise: league games return to the hub instead
    const gm = g();
    S.screen = 'over';
    $('hud').hidden = true;
    const me = gm.teams[gm.playerIdx];
    const them = gm.teams[1 - gm.playerIdx];
    const result = gm.winner === null ? 'T' : gm.winner === gm.playerIdx ? 'W' : 'L';
    const hr = me.lineup.reduce((a, p) => a + p.stats.hr, 0);
    const bests = BB.store.recordGame({
      diff: gm.opts.difficulty,
      innings: gm.innings,
      you: me.runs,
      opp: them.runs,
      oppName: them.name,
      hr,
      k: me.staff.reduce((a, p) => a + p.stats.k, 0),
      hits: me.hits,
      result,
    });
    $('over-title').textContent = result === 'W' ? 'You win!' : result === 'L' ? 'You lose' : 'Tie game';
    let final = 'Final';
    if (gm.inning > gm.innings) final += `/${gm.inning}`;
    if (gm.endReason === 'mercy') final += ' (mercy rule)';
    if (gm.endReason === 'walkoff') final += ' (walk-off)';
    $('over-sub').textContent = `${final}: ${me.name} ${me.runs}, ${them.name} ${them.runs} · ${gm.diff.label}`;
    $('over-bests').innerHTML = bests.map((b) => `<span>New best: ${escapeHtml(b)}</span>`).join('');

    // Line score
    const n = Math.max(gm.innings, gm.inning);
    let html = '<tr><th></th>';
    for (let i = 1; i <= n; i++) html += `<th>${i}</th>`;
    html += '<th class="tot">R</th><th class="tot">H</th></tr>';
    gm.teams.forEach((t, idx) => {
      html += `<tr><td><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${t.color};margin-right:6px"></span>${escapeHtml(t.abbr)}</td>`;
      for (let i = 0; i < n; i++) {
        const v = gm.line[idx][i];
        html += `<td>${v === undefined ? '' : v}</td>`;
      }
      html += `<td class="tot">${t.runs}</td><td class="tot">${t.hits}</td></tr>`;
    });
    $('linescore').innerHTML = html;

    const tabs = $('box-tabs');
    tabs.innerHTML = '';
    const showBox = (t) => {
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.textContent === t.abbr));
      let h = '<tr><th>Batting</th><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>BB</th><th>K</th></tr>';
      const tot = { ab: 0, r: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0 };
      for (const p of t.lineup) {
        const s = p.stats;
        for (const k in tot) tot[k] += s[k];
        h += `<tr><td>${escapeHtml(p.name)} <small>${p.pos}</small></td><td>${s.ab}</td><td>${s.r}</td><td>${s.h}</td><td>${s.hr}</td><td>${s.rbi}</td><td>${s.bb}</td><td>${s.k}</td></tr>`;
      }
      h += `<tr class="total"><td>Totals</td><td>${tot.ab}</td><td>${tot.r}</td><td>${tot.h}</td><td>${tot.hr}</td><td>${tot.rbi}</td><td>${tot.bb}</td><td>${tot.k}</td></tr>`;
      $('boxscore').innerHTML = h;
      $('pitchbox').innerHTML =
        '<tr><th>Pitching</th><th>IP</th><th>H</th><th>R</th><th>BB</th><th>K</th><th>HR</th><th>P</th></tr>' +
        t.staff
          .filter((p) => p.used)
          .map((p) => {
            const ps = p.stats;
            return `<tr><td>${escapeHtml(p.name)} <small>${p.role}</small></td><td>${ip(ps.outs)}</td><td>${ps.h}</td><td>${ps.r}</td><td>${ps.bb}</td><td>${ps.k}</td><td>${ps.hr}</td><td>${ps.pitches}</td></tr>`;
          })
          .join('');
    };
    for (const t of [me, them]) {
      const b = document.createElement('button');
      b.textContent = t.abbr;
      b.addEventListener('click', () => showBox(t));
      tabs.appendChild(b);
    }
    showBox(me);
    $('screen-over').hidden = false;
    $('screen-over').scrollTop = 0;
  }

  // ---------------------------------------------------------------------------
  // Franchise mode (UI agent): main menu, BB.ui.playGame and league games in
  // the playable view (window.DD.playLeagueGame). Kept apart from the
  // exhibition code above; the only hook there is the first line of showGameOver.
  // ---------------------------------------------------------------------------
  function showMenuView(view) {
    $('main-menu').hidden = view !== 'menu';
    $('quick-setup').hidden = view !== 'quick';
  }

  // Franchise card on the main menu: Continue when a save exists.
  function refreshFranchiseCard() {
    const show = (L) => {
      const t = L && BB.season.userTeam(L);
      $('btn-fr-continue').hidden = !t;
      $('btn-fr-reset').hidden = !t;
      $('btn-fr-new').hidden = !!t;
      if (!t) {
        $('mm-save').textContent = 'Run a club through a full 162-game season.';
        return;
      }
      const d = BB.season.today(L);
      const phase = { spring: 'Spring training', regular: 'Regular season', postseason: 'Postseason', offseason: 'Offseason' }[L.phase] || '';
      const rec = L.phase === 'spring' ? t.springRec : t.rec;
      $('mm-save').innerHTML =
        `<span class="mm-chip" style="background:${escapeHtml(t.color)}"></span><b>${escapeHtml(t.city + ' ' + t.name)}</b>` +
        `<span>${escapeHtml(phase)} ${L.year}${d.date ? ' · ' + escapeHtml(BB.ui.fmt.date(d.date)) : ''} · ${rec.w}-${rec.l}</span>`;
    };
    const mem = BB.ui.league();
    if (mem) return show(mem);
    $('mm-save').textContent = 'Checking for a saved franchise…';
    return BB.db
      .load()
      .then((L) => show(L || null))
      .catch(() => show(null));
  }

  function openFranchise(L, screen) {
    A.init();
    $('screen-title').hidden = true;
    S.screen = 'franchise';
    BB.ui.show(L, screen);
  }

  function initFranchiseMenu() {
    showMenuView('menu');
    $('btn-quick').addEventListener('click', () => {
      A.init();
      showMenuView('quick');
    });
    $('btn-quick-back').addEventListener('click', () => showMenuView('menu'));
    $('btn-fr-continue').addEventListener('click', () => {
      const mem = BB.ui.league();
      const go = (L) => {
        if (!L) {
          refreshFranchiseCard();
          return;
        }
        openFranchise(L, 'home');
      };
      if (mem) return go(mem);
      $('btn-fr-continue').disabled = true;
      BB.db
        .load()
        .then(go)
        .catch(() => go(null))
        .finally(() => ($('btn-fr-continue').disabled = false));
    });
    $('btn-fr-new').addEventListener('click', () => {
      BB.ui.setLeague(null);
      openFranchise(null, 'newFranchise');
    });
    $('btn-fr-reset').addEventListener('click', () => {
      BB.ui.confirm('Delete your saved franchise and start a new one? This cannot be undone.', 'Start over').then((ok) => {
        if (!ok) return;
        BB.db.clear().then(() => {
          BB.ui.setLeague(null);
          refreshFranchiseCard();
          openFranchise(null, 'newFranchise');
        });
      });
    });
    // Leaving an exhibition game goes back to the main menu.
    $('btn-menu').addEventListener('click', () => showMenuView('menu'));
    $('btn-quit').addEventListener('click', () => showMenuView('menu'));
    // On the main menu itself, Enter doesn't start an exhibition game.
    window.addEventListener(
      'keydown',
      (e) => {
        if (S.screen === 'title' && e.key === 'Enter' && $('quick-setup').hidden) e.stopPropagation();
      },
      true,
    );
    BB.ui.onExit = () => {
      S.screen = 'title';
      showMenuView('menu');
      $('screen-title').hidden = false;
      refreshFranchiseCard();
    };
    BB.ui.playGame = playFranchiseGame;
    refreshFranchiseCard();
  }

  // BB.ui.playGame: hand a league game to the playable view, record it after.
  function playFranchiseGame(gameId, mode) {
    const L = BB.ui.league();
    if (!L) return;
    A.init();
    let r;
    try {
      r = BB.season.startUserGame(L, gameId, mode);
    } catch (err) {
      console.error(err);
      BB.ui.toast("Couldn't start that game.");
      return;
    }
    if (!r) {
      BB.ui.toast('That game has already been played.');
      BB.ui.refresh();
      return;
    }
    if (r.done) {
      BB.ui.saveNow();
      BB.ui.refresh();
      BB.ui.openBox(gameId);
      BB.ui.toast('No key moment came up: the game was decided early.');
      return;
    }
    BB.ui.hide();
    playLeagueGame(r.g, {
      allowSimToEnd: true,
      onDone: (gm) => {
        try {
          BB.season.finishUserGame(L, gameId, gm);
        } catch (err) {
          console.error(err);
        }
        BB.ui.saveNow();
        BB.ui.show(L, 'home');
        BB.ui.openBox(gameId);
      },
    });
  }

  // Two similar uniform colors: the team the user doesn't control changes.
  function leagueColors(gm) {
    const [a, b] = gm.teams;
    const hex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
    if (!hex(a.color) || !hex(b.color) || hexDist(a.color, b.color) >= 90) return;
    const t = gm.playerIdx === 0 ? b : a;
    const other = t === a ? b : a;
    const L = BB.ui && BB.ui.league ? BB.ui.league() : null;
    const lt = (L && BB.season.team(L, t.id)) || (BB.league && BB.league.TEAMS.find((x) => x.id === t.id));
    if (lt && hex(lt.color2) && hexDist(lt.color2, other.color) > 120) t.color = lt.color2;
    else t.color = (BB.COLORS.find((c) => hexDist(c.hex, other.color) > 140) || BB.COLORS[9]).hex;
  }

  // Start the playable view with a ready league game (first pitch, or the top
  // of a half-inning after a quick-play sim).
  function playLeagueGame(gm, opts) {
    const o = opts || {};
    if (!gm.opts) gm.opts = {};
    if (!gm.opts.difficulty) gm.opts.difficulty = Object.keys(BB.DIFFICULTIES).find((k) => BB.DIFFICULTIES[k] === gm.diff) || 'medium';
    leagueColors(gm);
    S.leagueGame = { onDone: o.onDone || null, allowSimToEnd: o.allowSimToEnd !== false };
    S.opts = null;
    S.g = gm;
    S.screen = 'game';
    S.paused = false;
    S.timers = [];
    S.view = 'bat';
    S.phase = 'intro';
    S.markers = [];
    S.pitch = null;
    S.play = null;
    S.mitt = null;
    S.batted = null;
    S.hover = null;
    S.batterKey = '';
    S.stealArmed = false;
    S.stealBase = 0;
    $('screen-title').hidden = true;
    $('screen-over').hidden = true;
    $('screen-pause').hidden = true;
    $('screen-bullpen').hidden = true;
    $('hud').hidden = false;
    $('tagup').hidden = true;
    $('banner').hidden = true;
    $('btn-simend').hidden = !S.leagueGame.allowSimToEnd;
    $('btn-quit').textContent = 'QUIT GAME';
    $('pause-note').hidden = false;
    S.pitcherRig.play('sign', 0.3);
    S.batterRig.play('stance', 0.3);
    updateHUD();
    setControls();
    const [away, home] = gm.teams;
    const m = gm.meta || {};
    const resumed = gm.inning > 1 || gm.half > 0 || gm.teams.some((t) => t.lineup.some((b) => b.stats.pa > 0));
    if (resumed) {
      const where = `${gm.half === 0 ? 'Top' : 'Bottom'} of the ${U.ordinal(gm.inning)}`;
      showBanner('KEY MOMENT', `${away.abbr} ${away.runs}, ${home.abbr} ${home.runs} · ${where}`, 'good', 2.2, beginHalf);
    } else {
      const label = m.seriesText || m.label || '';
      showBanner(`${away.abbr} @ ${home.abbr}`, label ? `${label} · ${away.name} at ${home.name}` : `${away.name} at ${home.name}`, '', 1.8, beginHalf);
    }
  }

  // Back to the franchise: clear the playable view and hand the game over.
  function finishLeagueView() {
    const ctx = S.leagueGame;
    const gm = S.g;
    S.leagueGame = null;
    S.timers = [];
    S.paused = false;
    S.g = null;
    S.pitch = null;
    S.play = null;
    S.view = 'bat';
    S.screen = 'franchise';
    $('hud').hidden = true;
    $('screen-pause').hidden = true;
    $('screen-bullpen').hidden = true;
    $('screen-over').hidden = true;
    $('tagup').hidden = true;
    $('banner').hidden = true;
    $('btn-simend').hidden = true;
    $('btn-quit').textContent = 'QUIT TO MENU';
    $('pause-note').hidden = true;
    hideCall();
    hidePitchInfo();
    if (ctx && ctx.onDone) ctx.onDone(gm);
  }

  // Called from showGameOver after the final banner.
  function leagueGameOver() {
    if (!S.leagueGame) return false;
    finishLeagueView();
    return true;
  }

  // Pause menu "Sim to end" (and quitting): the rest of the game is simulated.
  function simLeagueToEnd() {
    const gm = S.g;
    if (!S.leagueGame || !gm) return;
    S.timers = [];
    if (!gm.over) {
      // A half that just ended is waiting for its banner: move to the next one.
      if (gm.outs >= 3) G.startNextHalf(gm);
      BB.engine.finishHeadless(gm);
    }
    finishLeagueView();
  }
  $('btn-simend').addEventListener('click', simLeagueToEnd);
  $('screen-pause').addEventListener(
    'click',
    (e) => {
      if (S.leagueGame && e.target.closest('#btn-quit')) {
        e.stopPropagation();
        simLeagueToEnd();
      }
    },
    true,
  );

  window.DD = Object.assign(window.DD || {}, { playLeagueGame, simLeagueToEnd });
  initFranchiseMenu();

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  resize();
  initTitle();
  requestAnimationFrame(frame);

  // Expose a small hook for automated tests.
  window.__dd = { S, startGame, toTitle, throwPitch, answerTagUp, openBullpen, bringIn };
})();
