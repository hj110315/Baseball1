// Game rules and state: count, outs, bases, innings, box score, plus the
// CPU's decisions (pitch selection, swing decisions, steals, tag-ups).
// No DOM access.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;

  function newBatLine() {
    return { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, bb: 0, k: 0 };
  }
  function newPitchLine() {
    return { pitches: 0, strikes: 0, outs: 0, h: 0, r: 0, bb: 0, k: 0, hr: 0 };
  }

  function makeTeam(t, isPlayer) {
    return {
      name: t.name,
      abbr: t.abbr,
      color: t.color,
      isPlayer,
      lineup: t.roster.lineup.map((p) => Object.assign({}, p, { stats: newBatLine() })),
      staff: t.roster.staff.map((p) => Object.assign({}, p, { stats: newPitchLine(), used: false, done: false })),
      pitcher: null,
      order: 0,
      runs: 0,
      hits: 0,
      lob: 0,
    };
  }

  function createGame(opts) {
    const player = makeTeam(opts.player, true);
    const cpu = makeTeam(opts.cpu, false);
    for (const t of [player, cpu]) {
      t.pitcher = t.staff[0];
      t.pitcher.used = true;
    }
    const g = {
      opts,
      diff: BB.DIFFICULTIES[opts.difficulty],
      innings: opts.innings,
      maxInnings: opts.innings + 3,
      teams: opts.playerHome ? [cpu, player] : [player, cpu],
      playerIdx: opts.playerHome ? 1 : 0,
      inning: 1,
      half: 0,
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: [null, null, null],
      line: [[], []],
      over: false,
      winner: null,
      endReason: '',
      log: [],
      lastPitch: null, // pitch type thrown before this one (in this at-bat)
    };
    g.line[0].push(0);
    return g;
  }

  const battingIdx = (g) => g.half;
  const battingTeam = (g) => g.teams[g.half];
  const fieldingTeam = (g) => g.teams[1 - g.half];
  const playerBatting = (g) => g.half === g.playerIdx;
  const currentBatter = (g) => {
    const t = battingTeam(g);
    return t.lineup[t.order];
  };

  function runnerFor(g, batter) {
    return { idx: batter.slot, name: batter.name, speed: batter.speed };
  }

  function addLog(g, text) {
    g.log.push({ inning: g.inning, half: g.half, text });
  }

  function scoreRuns(g, ids, rbiBatter, rbi) {
    const bt = battingTeam(g);
    const ft = fieldingTeam(g);
    for (const id of ids) {
      bt.lineup[id].stats.r++;
      bt.runs++;
      g.line[g.half][g.inning - 1]++;
      ft.pitcher.stats.r++;
    }
    if (rbiBatter && rbi) rbiBatter.stats.rbi += rbi;
  }

  // Ends the at-bat: next batter up, count reset.
  function nextBatter(g) {
    const t = battingTeam(g);
    t.order = (t.order + 1) % 9;
    g.balls = 0;
    g.strikes = 0;
    g.lastPitch = null;
  }

  // Returns { halfOver, gameOver } after checking the situation.
  function checkState(g) {
    const [away, home] = g.teams;
    // Walk-off.
    if (g.half === 1 && g.inning >= g.innings && home.runs > away.runs) {
      endGame(g, 'walkoff');
      return { halfOver: true, gameOver: true };
    }
    if (g.outs >= 3) return endHalf(g);
    return { halfOver: false, gameOver: false };
  }

  function endHalf(g) {
    const [away, home] = g.teams;
    battingTeam(g).lob += g.bases.filter(Boolean).length;
    const diff = home.runs - away.runs;
    if (g.innings === 9 && g.inning >= 7 && ((g.half === 0 && diff >= 10) || (g.half === 1 && Math.abs(diff) >= 10))) {
      endGame(g, 'mercy');
      return { halfOver: true, gameOver: true };
    }
    if (g.half === 0 && g.inning >= g.innings && diff > 0) {
      endGame(g, 'final');
      return { halfOver: true, gameOver: true };
    }
    if (g.half === 1 && g.inning >= g.innings) {
      if (diff !== 0) {
        endGame(g, 'final');
        return { halfOver: true, gameOver: true };
      }
      if (g.inning >= g.maxInnings) {
        endGame(g, 'tie');
        return { halfOver: true, gameOver: true };
      }
    }
    return { halfOver: true, gameOver: false };
  }

  function startNextHalf(g) {
    if (g.half === 0) {
      g.half = 1;
    } else {
      g.half = 0;
      g.inning++;
    }
    if (g.line[g.half].length < g.inning) g.line[g.half].push(0);
    g.outs = 0;
    g.balls = 0;
    g.strikes = 0;
    g.bases = [null, null, null];
    g.lastPitch = null;
  }

  function endGame(g, reason) {
    g.over = true;
    g.endReason = reason;
    const [away, home] = g.teams;
    if (away.runs === home.runs) g.winner = null;
    else g.winner = away.runs > home.runs ? 0 : 1;
    // Unplayed bottom half shows as "X" in the line score.
    if (g.half === 0 && reason !== 'mercy') g.line[1][g.inning - 1] = 'X';
    if (g.half === 0 && reason === 'mercy') g.line[1][g.inning - 1] = 'X';
  }

  // ---------------------------------------------------------------------------
  // Pitch outcomes. Each returns an event the UI can show.
  // ---------------------------------------------------------------------------
  function countPitch(g, strike) {
    const p = fieldingTeam(g).pitcher.stats;
    p.pitches++;
    if (strike) p.strikes++;
  }

  function takePitch(g, isStrike, pitchKey) {
    countPitch(g, isStrike);
    g.lastPitch = pitchKey;
    if (isStrike) return addStrike(g, 'looking');
    g.balls++;
    if (g.balls >= 4) return walk(g);
    return Object.assign({ type: 'ball', label: 'BALL' }, checkState(g));
  }

  function swingMiss(g, pitchKey) {
    countPitch(g, true);
    g.lastPitch = pitchKey;
    return addStrike(g, 'swinging');
  }

  function addStrike(g, how) {
    g.strikes++;
    if (g.strikes >= 3) {
      const b = currentBatter(g);
      b.stats.pa++;
      b.stats.ab++;
      b.stats.k++;
      const ps = fieldingTeam(g).pitcher.stats;
      ps.k++;
      ps.outs++;
      g.outs++;
      addLog(g, `${b.name} strikes out ${how}.`);
      nextBatter(g);
      return Object.assign({ type: 'strikeout', label: how === 'looking' ? 'STRIKE THREE!' : 'STRIKEOUT!', outs: 1 }, checkState(g));
    }
    return Object.assign({ type: 'strike', label: how === 'looking' ? 'STRIKE' : 'SWING & MISS' }, checkState(g));
  }

  function foulBall(g, pitchKey) {
    countPitch(g, true);
    g.lastPitch = pitchKey;
    if (g.strikes < 2) g.strikes++;
    return { type: 'foul', label: 'FOUL BALL', halfOver: false, gameOver: false };
  }

  function walk(g) {
    const b = currentBatter(g);
    b.stats.pa++;
    b.stats.bb++;
    fieldingTeam(g).pitcher.stats.bb++;
    const scored = [];
    const runner = runnerFor(g, b);
    if (g.bases[0]) {
      if (g.bases[1]) {
        if (g.bases[2]) scored.push(g.bases[2].idx);
        g.bases[2] = g.bases[1];
      }
      g.bases[1] = g.bases[0];
    }
    g.bases[0] = runner;
    scoreRuns(g, scored, b, scored.length);
    addLog(g, `${b.name} walks.` + (scored.length ? ' A run scores.' : ''));
    nextBatter(g);
    return Object.assign({ type: 'walk', label: 'BALL FOUR', runs: scored.length }, checkState(g));
  }

  function inPlay(g, result, pitchKey) {
    countPitch(g, true);
    const b = currentBatter(g);
    const ps = fieldingTeam(g).pitcher.stats;
    const bt = battingTeam(g);
    b.stats.pa++;
    if (result.ab) b.stats.ab++;
    if (result.hit) {
      b.stats.h++;
      bt.hits++;
      ps.h++;
      if (result.batterBase === 2) b.stats.d++;
      if (result.batterBase === 3) b.stats.t++;
      if (result.batterBase === 4) {
        b.stats.hr++;
        ps.hr++;
      }
    }
    ps.outs += result.outs;
    g.outs += result.outs;
    // Bases from the sim hold the runners on base after the play (batter included).
    const bases = result.bases.slice();
    if (result.batterBase >= 1 && result.batterBase <= 3 && g.outs < 3) bases[result.batterBase - 1] = runnerFor(g, b);
    g.bases = g.outs >= 3 ? [null, null, null] : bases;
    if (result.batterBase === 4 && !result.scored.includes(b.slot)) result.scored.push(b.slot);
    scoreRuns(g, result.scored, b, result.rbi);
    addLog(g, result.desc);
    g.lastPitch = pitchKey;
    nextBatter(g);
    return Object.assign({ type: 'inplay', label: result.label, runs: result.scored.length, outs: result.outs }, checkState(g));
  }

  function steal(g, base, safe) {
    const r = g.bases[base - 2];
    if (!r) return null;
    g.bases[base - 2] = null;
    if (safe) {
      g.bases[base - 1] = r;
      addLog(g, `${r.name} steals ${U.ordinal(base)}.`);
      return Object.assign({ type: 'steal', label: 'STOLEN BASE', safe: true }, checkState(g));
    }
    g.outs++;
    fieldingTeam(g).pitcher.stats.outs++;
    addLog(g, `${r.name} is caught stealing ${U.ordinal(base)}.`);
    return Object.assign({ type: 'steal', label: 'CAUGHT STEALING', safe: false, outs: 1 }, checkState(g));
  }

  // Which base the lead runner could steal (0 if none).
  function stealableBase(g) {
    if (g.outs >= 3) return 0;
    if (g.bases[1] && !g.bases[2]) return 3;
    if (g.bases[0] && !g.bases[1]) return 2;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // CPU decisions.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Pitchers: fatigue, pitch specs and the bullpen.
  // ---------------------------------------------------------------------------
  // 0 while fresh, rising once the pitcher passes their stamina.
  function pitcherFatigue(p) {
    return U.clamp((p.stats.pitches - p.stamina) / 30, 0, 1.5);
  }
  function fatigue(g) {
    return pitcherFatigue(fieldingTeam(g).pitcher);
  }
  // 1 = fresh, 0 = at stamina (from there on the pitcher is tiring). For the HUD.
  function energy(p) {
    return U.clamp(1 - p.stats.pitches / p.stamina, 0, 1);
  }
  function isTired(p) {
    return p.stats.pitches >= p.stamina;
  }

  function arsenalEntry(p, type) {
    return p.arsenal.find((a) => a.key === type) || { key: type, q: 1 };
  }

  // Speed, travel time, location error and quality of a pitch from this pitcher.
  // isPlayer: the pitcher belongs to the human player (uses playerControl).
  function pitchSpec(g, p, type, isPlayer) {
    const d = g.diff;
    const P = BB.PITCHES[type];
    const fat = pitcherFatigue(p);
    const velo = p.velo - 3 * fat;
    const base = isPlayer ? d.playerControl : d.cpuCommand;
    return {
      mph: Math.round(d.mphFb + velo + P.mphDelta),
      travel: d.travelFb * P.travelMul * (d.mphFb / (d.mphFb + velo)),
      sigma: (base + P.extraSigma) * p.control * (1 + 0.8 * fat),
      q: arsenalEntry(p, type).q,
      fatigue: fat,
    };
  }

  // How a pitch changes contact: launch angle shift and exit velocity.
  function contactFx(pitch) {
    const P = BB.PITCHES[pitch.type];
    const q = pitch.q || 1;
    return { phiShift: P.phiShift, evMul: P.evMul * (1 - (q - 1) * 0.6) * (1 + 0.06 * (pitch.fatigue || 0)) };
  }

  function changePitcher(g, team, idx) {
    const next = team.staff[idx];
    if (!next || next.used || next === team.pitcher) return false;
    team.pitcher.done = true;
    team.pitcher = next;
    next.used = true;
    g.lastPitch = null;
    addLog(g, `Pitching change: ${next.name} comes in for ${team.name}.`);
    return true;
  }

  function availableRelievers(team) {
    return team.staff.map((p, i) => ({ p, i })).filter((x) => !x.p.used);
  }

  // CPU manager: returns a staff index to bring in, or -1.
  function cpuPitchingChange(g) {
    const team = fieldingTeam(g);
    if (team.isPlayer) return -1;
    const p = team.pitcher;
    const tired = pitcherFatigue(p) > 0.25;
    const shelled = p.stats.r >= 4 && p.stats.pitches > 20 && p.role === 'SP';
    const reliefShelled = p.role !== 'SP' && p.stats.r >= 3;
    if (!tired && !shelled && !reliefShelled) return -1;
    const avail = availableRelievers(team);
    if (!avail.length) return -1;
    const lead = team.runs - battingTeam(g).runs;
    const late = g.inning >= g.innings;
    const closer = avail.find((x) => x.p.role === 'CL');
    if (closer && late && lead >= 0 && lead <= 3) return closer.i;
    const other = avail.find((x) => x.p.role !== 'CL');
    return (other || avail[0]).i;
  }

  function cpuChoosePitch(g, rng) {
    const d = g.diff;
    const pitcher = fieldingTeam(g).pitcher;
    let fastShare = d.cpuFbShare;
    if (g.strikes === 2) fastShare -= 0.15;
    if (g.balls === 3) fastShare = 0.85;
    if (g.lastPitch && BB.PITCHES[g.lastPitch].family === 'off') fastShare += 0.1; // mix it up
    fastShare = U.clamp(fastShare, 0.15, 0.95);
    const fams = { fast: 0, off: 0 };
    for (const a of pitcher.arsenal) fams[BB.PITCHES[a.key].family]++;
    const mix = {};
    for (const a of pitcher.arsenal) {
      const fam = BB.PITCHES[a.key].family;
      const share = fams.fast && fams.off ? (fam === 'fast' ? fastShare : 1 - fastShare) : 1;
      mix[a.key] = (share / fams[fam]) * a.q * a.q;
    }
    const type = U.weighted(rng, mix);
    let strikeP = 0.46 + d.cpuStrikeBias;
    if (g.balls === 3) strikeP = 0.86;
    else if (g.strikes === 2 && g.balls < 2) strikeP = 0.42;
    else if (g.balls === 0 && g.strikes === 0) strikeP = 0.55 + d.cpuStrikeBias;
    let target;
    if (rng() < strikeP) {
      const edge = g.opts.difficulty === 'hard' ? 0.55 : g.opts.difficulty === 'medium' ? 0.35 : 0.15;
      const r = () => {
        const v = U.rand(rng, edge * 0.8, 0.85);
        return rng() < 0.5 ? -v : v;
      };
      target = { px: rng() < 0.5 ? r() : U.rand(rng, -0.6, 0.6), py: rng() < 0.5 ? r() : U.rand(rng, -0.6, 0.6) };
    } else {
      // Just off the plate.
      const out = U.rand(rng, 1.2, 1.8) * (rng() < 0.5 ? -1 : 1);
      const inside = U.rand(rng, -0.9, 0.9);
      const high = BB.PITCHES[type].family === 'fast';
      target = rng() < 0.5 ? { px: out, py: inside } : { px: inside, py: high ? Math.abs(out) : -Math.abs(out) };
    }
    const spec = pitchSpec(g, pitcher, type, false);
    return { type, target, sigma: spec.sigma };
  }

  function applyCommand(target, sigma, rng) {
    return {
      px: U.clamp(target.px + U.gauss(rng, 0, sigma), -2.6, 2.6),
      py: U.clamp(target.py + U.gauss(rng, 0, sigma), -2.4, 2.4),
    };
  }

  function isStrike(loc) {
    return Math.abs(loc.px) <= 1 && Math.abs(loc.py) <= 1;
  }

  // Returns null to take the pitch, or a timing delta in ms.
  function cpuSwing(g, pitch, rng) {
    const d = g.diff;
    const b = currentBatter(g);
    const loc = pitch.loc;
    const off = Math.max(0, Math.max(Math.abs(loc.px), Math.abs(loc.py)) - 1);
    const inZone = off === 0;
    let p;
    if (inZone) {
      const edge = Math.max(Math.abs(loc.px), Math.abs(loc.py));
      p = 0.74 - edge * 0.12;
    } else {
      p = Math.max(0.03, 0.4 - off * 0.55);
      p += BB.PITCHES[pitch.type].chase * (pitch.q || 1);
      p *= d.cpuChase;
    }
    if (g.strikes === 2) p = inZone ? 0.92 : Math.min(0.7, p + 0.14);
    if (g.balls === 3 && g.strikes < 2) p *= inZone ? 0.75 : 0.5;
    if (g.balls === 3 && g.strikes === 0) p *= 0.4;
    if (rng() >= p) return null;
    // Changing speeds throws off timing: slower after faster makes hitters early.
    let bias = 0;
    if (g.lastPitch && g.lastPitch !== pitch.type) {
      const P = BB.PITCHES[pitch.type];
      const dv = BB.PITCHES[g.lastPitch].mphDelta - P.mphDelta;
      bias = dv > 0 ? -dv * 3 * P.fool : -dv * 2.4;
    }
    if (g.opts.difficulty === 'hard') bias *= 0.6;
    const edge = Math.min(1, Math.max(Math.abs(loc.px), Math.abs(loc.py)));
    const sigma = (d.cpuSigma / (b.contact || 1)) * (1 + 0.25 * edge) * (pitch.q || 1) * (1 - 0.2 * (pitch.fatigue || 0));
    return U.gauss(rng, bias, sigma);
  }

  function cpuStealDecision(g, rng) {
    const base = stealableBase(g);
    if (!base || g.outs >= 2 || g.balls === 3) return 0;
    const r = g.bases[base - 2];
    if (!r || r.speed < 0.98) return 0;
    const p = g.diff.cpuSteal * (base === 3 ? 0.45 : 1) * (r.speed > 1.05 ? 1.6 : 1);
    return rng() < p ? base : 0;
  }

  function cpuTagUp(margin) {
    return margin > 0.25;
  }

  BB.game = {
    createGame, battingTeam, fieldingTeam, playerBatting, currentBatter, battingIdx,
    takePitch, swingMiss, foulBall, inPlay, steal, stealableBase, startNextHalf,
    cpuChoosePitch, applyCommand, isStrike, cpuSwing, cpuStealDecision, cpuTagUp, fatigue,
    pitcherFatigue, energy, isTired, pitchSpec, contactFx, changePitcher, availableRelievers, cpuPitchingChange,
  };
})(typeof window !== 'undefined' ? window : globalThis);
