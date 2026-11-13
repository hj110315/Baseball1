// Game rules and state: count, outs, bases, innings, box score, plus the
// CPU's decisions (pitch selection, swing decisions, steals, tag-ups).
// No DOM access.
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const U = BB.U;

  function newSplit() {
    return { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, k: 0 };
  }
  function newBatLine() {
    return { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, bb: 0, k: 0, sb: 0, cs: 0 };
  }
  function newPitchLine() {
    return { pitches: 0, strikes: 0, outs: 0, h: 0, r: 0, bb: 0, k: 0, hr: 0 };
  }

  // lineup: GameBatter[], staff: GamePitcher[] (see ARCHITECTURE.md)
  function makeTeam(t, lineup, staff, isPlayer) {
    const team = {
      id: t.id || null,
      name: t.name,
      abbr: t.abbr,
      color: t.color,
      isPlayer,
      lineup: lineup.map((p, i) =>
        Object.assign({}, p, { slot: i, stats: newBatLine(), split: { L: newSplit(), R: newSplit() } }),
      ),
      staff: staff.map((p) =>
        Object.assign({}, p, { stats: newPitchLine(), split: { L: newSplit(), R: newSplit() }, used: false, done: false }),
      ),
      defense: t.defense || null, // per-position { q, arm } map, or null for the difficulty default
      pitcher: null,
      appear: [], // pitchers in order of appearance
      order: 0,
      runs: 0,
      hits: 0,
      lob: 0,
    };
    for (const b of team.lineup) if (!b.bats) b.bats = b.hand;
    team.pitcher = team.staff[0];
    team.pitcher.used = true;
    team.appear.push(team.pitcher);
    return team;
  }

  // Two forms (see ARCHITECTURE.md): exhibition { player, cpu, playerHome } or
  // league { away, home, userSide, meta }.
  function createGame(opts) {
    let teams;
    let playerIdx;
    if (opts.away && opts.home) {
      playerIdx = opts.userSide === 'away' ? 0 : opts.userSide === 'home' ? 1 : -1;
      teams = [
        makeTeam(opts.away, opts.away.lineup, opts.away.staff, playerIdx === 0),
        makeTeam(opts.home, opts.home.lineup, opts.home.staff, playerIdx === 1),
      ];
    } else {
      const player = makeTeam(opts.player, opts.player.roster.lineup, opts.player.roster.staff, true);
      const cpu = makeTeam(opts.cpu, opts.cpu.roster.lineup, opts.cpu.roster.staff, false);
      teams = opts.playerHome ? [cpu, player] : [player, cpu];
      playerIdx = opts.playerHome ? 1 : 0;
    }
    const league = !!(opts.away && opts.home);
    const g = {
      opts,
      meta: opts.meta || { type: 'exhibition' },
      diff: BB.DIFFICULTIES[opts.difficulty || 'medium'],
      innings: opts.innings || 9,
      // League games are played until someone wins; exhibitions stop after 3 extra innings.
      maxInnings: league ? 99 : (opts.innings || 9) + 3,
      mercy: !league, // 10-run rule only in exhibitions
      ghostRunner: !!opts.ghostRunner, // extra innings start with a runner on 2nd
      teams,
      playerIdx,
      decisions: null,
      lead: null, // pitchers of record: { team, winP, loseP }
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
    refreshSwitchHitters(g);
    return g;
  }

  // Switch hitters bat from the side opposite the pitcher they're facing.
  function refreshSwitchHitters(g) {
    const ph = fieldingTeam(g).pitcher.hand;
    for (const b of battingTeam(g).lineup) if (b.bats === 'S') b.hand = ph === 'L' ? 'R' : 'L';
  }

  // Plate appearance results go to the batter's line, the batter's split vs this
  // pitcher's hand, and the pitcher's split vs this batter's hand.
  function recordPA(g, b, res) {
    const p = fieldingTeam(g).pitcher;
    const bs = b.split[p.hand === 'L' ? 'L' : 'R'];
    const ps = p.split[b.hand === 'L' ? 'L' : 'R'];
    b.stats.pa++;
    bs.pa++;
    ps.pa++;
    for (const k of ['ab', 'h', 'd', 't', 'hr', 'bb', 'k']) {
      const n = res[k] || 0;
      if (!n) continue;
      b.stats[k] += n;
      bs[k] += n;
      ps[k] += n;
    }
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
    const before = bt.runs - ft.runs;
    for (const id of ids) {
      bt.lineup[id].stats.r++;
      bt.runs++;
      g.line[g.half][g.inning - 1]++;
      ft.pitcher.stats.r++;
    }
    if (rbiBatter && rbi) rbiBatter.stats.rbi += rbi;
    // Pitchers of record: set when a team takes the lead, cleared when the game is tied.
    const after = bt.runs - ft.runs;
    if (before <= 0 && after > 0) g.lead = { team: g.half, winP: bt.pitcher, loseP: ft.pitcher };
    else if (after === 0 && before < 0) g.lead = null;
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
    if (g.mercy && g.innings === 9 && g.inning >= 7 && ((g.half === 0 && diff >= 10) || (g.half === 1 && Math.abs(diff) >= 10))) {
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
    refreshSwitchHitters(g);
    // Extra innings (league regular season and spring): runner starts on 2nd.
    if (g.ghostRunner && g.inning > g.innings) {
      const t = battingTeam(g);
      const b = t.lineup[(t.order + 8) % 9];
      g.bases[1] = runnerFor(g, b);
    }
  }

  function endGame(g, reason) {
    g.over = true;
    g.endReason = reason;
    const [away, home] = g.teams;
    if (away.runs === home.runs) g.winner = null;
    else g.winner = away.runs > home.runs ? 0 : 1;
    // Unplayed bottom half shows as "X" in the line score.
    if (g.half === 0) g.line[1][g.inning - 1] = 'X';
    g.decisions = decide(g);
  }

  // Winning, losing and saving pitchers.
  function decide(g) {
    if (g.winner === null || !g.lead || g.lead.team !== g.winner) return { w: null, l: null, sv: null };
    const win = g.teams[g.winner];
    let w = g.lead.winP;
    const l = g.lead.loseP;
    // A starter needs 5 innings for the win; otherwise it goes to the next pitcher used.
    if (w === win.appear[0] && w.stats.outs < 15 && win.appear.length > 1) w = win.appear[1];
    const last = win.pitcher;
    const margin = win.runs - g.teams[1 - g.winner].runs;
    const sv = last !== w && last.stats.outs >= 1 && (margin <= 3 || last.stats.outs >= 9) ? last : null;
    return { w, l, sv };
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
      recordPA(g, b, { ab: 1, k: 1 });
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
    recordPA(g, b, { bb: 1 });
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
    const bb = result.hit ? result.batterBase : 0;
    recordPA(g, b, { ab: result.ab ? 1 : 0, h: result.hit ? 1 : 0, d: bb === 2 ? 1 : 0, t: bb === 3 ? 1 : 0, hr: bb === 4 ? 1 : 0 });
    if (result.hit) {
      bt.hits++;
      ps.h++;
      if (bb === 4) ps.hr++;
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
    const runner = battingTeam(g).lineup[r.idx];
    if (runner) runner.stats[safe ? 'sb' : 'cs']++;
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

  // Defense for the team in the field: per-position ratings in league games, or
  // one number in exhibitions. CPU fielders facing the user get the difficulty factor.
  function defenseQuality(g) {
    const ft = fieldingTeam(g);
    const f = playerBatting(g) ? g.diff.cpuFielding : 1;
    if (!ft.defense) return f;
    const out = {};
    for (const k in ft.defense) out[k] = { q: ft.defense[k].q * f, arm: ft.defense[k].arm * f };
    return out;
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
      velo,
      fatigue: fat,
    };
  }

  // How a pitch changes contact: launch angle shift and exit velocity.
  function contactFx(pitch) {
    const P = BB.PITCHES[pitch.type];
    const q = pitch.q || 1;
    return { phiShift: P.phiShift, evMul: P.evMul * (1 - (q - 1) * 0.3) * (1 + 0.06 * (pitch.fatigue || 0)) };
  }

  function changePitcher(g, team, idx) {
    const next = team.staff[idx];
    if (!next || next.used || next === team.pitcher) return false;
    team.pitcher.done = true;
    team.pitcher = next;
    next.used = true;
    team.appear.push(next);
    g.lastPitch = null;
    refreshSwitchHitters(g);
    addLog(g, `Pitching change: ${next.name} comes in for ${team.name}.`);
    return true;
  }

  function availableRelievers(team) {
    return team.staff.map((p, i) => ({ p, i })).filter((x) => !x.p.used);
  }

  // CPU manager: returns a staff index to bring in, or -1.
  // force: also manage the user's team (simulated stretches of their games).
  function cpuPitchingChange(g, force) {
    const team = fieldingTeam(g);
    if (team.isPlayer && !force) return -1;
    const p = team.pitcher;
    // Starters can work a little past their limit; relievers come out at it.
    const tired = p.role === 'SP' ? pitcherFatigue(p) > 0.25 : p.stats.pitches >= p.stamina;
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
      p *= d.cpuChase * U.clamp(2 - (b.eye || 1), 0.5, 1.5); // good eye = fewer chases
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
    // Harder throwers are harder to time (velo: mph above the difficulty's base).
    const heat = 1 + U.clamp(pitch.velo || 0, -6, 6) * 0.008;
    const sigma = (d.cpuSigma / (b.contact || 1)) * (1 + 0.25 * edge) * (pitch.q || 1) * heat * (1 - 0.2 * (pitch.fatigue || 0));
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
    defenseQuality, refreshSwitchHitters, pitcherFatigue, energy, isTired, pitchSpec, contactFx, changePitcher, availableRelievers, cpuPitchingChange,
  };
})(typeof window !== 'undefined' ? window : globalThis);
