// Headless check of the simulation: plays many CPU-vs-CPU games and prints
// league-style stats so the hitting and fielding model can be tuned.
// Run: node tools/simtest.js [games] [difficulty]
'use strict';
const path = require('path');
for (const f of ['util', 'data', 'sim', 'game']) require(path.join(__dirname, '..', 'js', f + '.js'));
const BB = globalThis.BB;
const U = BB.U;

const games = +(process.argv[2] || 400);
const difficulty = process.argv[3] || 'medium';
const rng = U.seeded(12345);
const tot = { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, k: 0, runs: 0, innings: 0, dp: 0, sb: 0, cs: 0, sf: 0, fc: 0, ih: 0, outsOnBases: 0, pitches: 0 };
const bip = { ground: [0, 0], line: [0, 0], fly: [0, 0], pop: [0, 0] };
let maxLoop = 0;
const pitchMix = {};
let pitchersUsed = 0;

for (let n = 0; n < games; n++) {
  const g = BB.game.createGame({
    innings: 9, difficulty, playerHome: false,
    player: { name: 'A', abbr: 'AAA', color: '#f00', roster: BB.makeRoster(n * 2 + 1) },
    cpu: { name: 'B', abbr: 'BBB', color: '#00f', roster: BB.makeRoster(n * 2 + 2) },
  });
  let loops = 0;
  while (!g.over) {
    if (++loops > 5000) throw new Error('game did not end');
    // Pitching changes, as the CPU manager would make them.
    const change = BB.game.cpuPitchingChange(g);
    if (change >= 0 && g.balls === 0 && g.strikes === 0) BB.game.changePitcher(g, BB.game.fieldingTeam(g), change);
    const choice = BB.game.cpuChoosePitch(g, rng);
    const loc = BB.game.applyCommand(choice.target, choice.sigma, rng);
    const spec = BB.game.pitchSpec(g, BB.game.fieldingTeam(g).pitcher, choice.type, false);
    const pitch = { type: choice.type, loc, q: spec.q, fatigue: spec.fatigue };
    pitchMix[choice.type] = (pitchMix[choice.type] || 0) + 1;
    const stealBase = BB.game.cpuStealDecision(g, rng);
    const delta = BB.game.cpuSwing(g, pitch, rng);
    let ev;
    let swing = null;
    if (delta !== null) {
      swing = BB.sim.contact(delta, BB.CPU_WINDOWS, loc, BB.game.currentBatter(g), rng, 1, BB.game.contactFx(pitch));
    }
    if (!swing) ev = BB.game.takePitch(g, BB.game.isStrike(loc), pitch.type);
    else if (swing.kind === 'miss') ev = BB.game.swingMiss(g, pitch.type);
    else {
      const b = BB.game.currentBatter(g);
      const play = BB.sim.simulate({
        swing, batter: { idx: b.slot, name: b.name, speed: b.speed, hand: b.hand }, bases: g.bases, outs: g.outs,
        defenseQuality: 1, rng, stealing: stealBase ? stealBase - 1 : 0,
      });
      if (play.result && play.result.foul) {
        ev = BB.game.foulBall(g, pitch.type);
      } else {
        if (play.tagUp) BB.sim.resolveTagUp(play, BB.game.cpuTagUp(play.tagUp.margin));
        const r = play.result;
        const ft = play.flight.type;
        if (bip[ft]) {
          bip[ft][0]++;
          if (r.hit && r.batterBase < 4) bip[ft][1]++;
        }
        if (r.dp) tot.dp++;
        if (r.sac) tot.sf++;
        if (r.kind === 'fc') tot.fc++;
        if (r.label === 'INFIELD HIT') tot.ih++;
        ev = BB.game.inPlay(g, r, pitch.type);
      }
    }
    if (stealBase && ev && ev.type !== 'inplay' && ev.type !== 'foul' && ev.type !== 'walk' && !ev.halfOver && BB.game.stealableBase(g) === stealBase) {
      const r = g.bases[stealBase - 2];
      const res = BB.sim.stealResult(r, stealBase, pitch.type, 0, rng);
      const sev = BB.game.steal(g, stealBase, res.safe);
      if (res.safe) tot.sb++; else tot.cs++;
      if (sev) ev = sev;
    }
    if (ev && ev.halfOver && !g.over) BB.game.startNextHalf(g);
  }
  maxLoop = Math.max(maxLoop, loops);
  for (const t of g.teams) pitchersUsed += t.staff.filter((p) => p.used).length;
  tot.innings += g.inning;
  for (const t of g.teams) {
    tot.runs += t.runs;
    for (const p of t.staff) tot.pitches += p.stats.pitches;
    for (const p of t.lineup) for (const k of ['pa', 'ab', 'h', 'd', 't', 'hr', 'bb', 'k']) tot[k] += p.stats[k];
  }
}
const f3 = (x) => x.toFixed(3);
console.log(`difficulty=${difficulty} games=${games}`);
console.log(`runs/team/game ${(tot.runs / games / 2).toFixed(2)}  pitches/team/game ${(tot.pitches / games / 2).toFixed(0)}`);
console.log(`AVG ${f3(tot.h / tot.ab)}  OBP ${f3((tot.h + tot.bb) / tot.pa)}  SLG ${f3((tot.h + tot.d + 2 * tot.t + 3 * tot.hr) / tot.ab)}`);
console.log(`K% ${(100 * tot.k / tot.pa).toFixed(1)}  BB% ${(100 * tot.bb / tot.pa).toFixed(1)}  HR% ${(100 * tot.hr / tot.pa).toFixed(1)}`);
console.log(`per team-game: 2B ${(tot.d / games / 2).toFixed(2)} 3B ${(tot.t / games / 2).toFixed(2)} HR ${(tot.hr / games / 2).toFixed(2)} DP ${(tot.dp / games / 2).toFixed(2)} SF ${(tot.sf / games / 2).toFixed(2)} FC ${(tot.fc / games / 2).toFixed(2)} IH ${(tot.ih / games / 2).toFixed(2)} SB ${(tot.sb / games / 2).toFixed(2)} CS ${(tot.cs / games / 2).toFixed(2)}`);
for (const k in bip) console.log(`  ${k.padEnd(6)} share ${(100 * bip[k][0] / Object.values(bip).reduce((a, b) => a + b[0], 0)).toFixed(1)}%  BABIP ${f3(bip[k][1] / Math.max(1, bip[k][0]))}`);
console.log(`max pitches in a game loop: ${maxLoop}`);
console.log(`pitchers used per team-game ${(pitchersUsed / games / 2).toFixed(2)}`);
const totP = Object.values(pitchMix).reduce((a, b) => a + b, 0);
console.log('pitch mix', Object.entries(pitchMix).map(([k, v]) => `${k} ${(100 * v / totP).toFixed(0)}%`).join('  '));
