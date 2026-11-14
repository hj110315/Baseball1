// Headless franchise loop: plays spring → regular season → postseason →
// offseason → next spring for several seasons, auto-making every user
// decision, checks invariants every day and prints a summary.
// Run: node tools/franchisetest.js [seasons=2] [seed=11]
'use strict';
const path = require('path');
for (const f of ['util', 'data', 'sim', 'game', 'league', 'engine', 'season', 'depth', 'postseason', 'offseason', 'trades', 'db']) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
}
const BB = globalThis.BB;
const S = BB.season;
const D = BB.depth;
const O = BB.offseason;
const TR = BB.trades;
const U = BB.U;

const SEASONS = Math.max(1, +(process.argv[2] || 2));
const SEED = +(process.argv[3] || 11);
const USER = 'LAK';
const MANUAL = process.env.MANUAL === '1'; // the user's depth chart is hand-edited (team.manual)
D.rng = U.seeded(SEED * 7 + 1);
const rnd = U.seeded(SEED * 13 + 5);

let failures = 0;
const fail = (msg) => {
  failures++;
  if (failures <= 25) console.log('  FAIL ' + msg);
};
const assert = (cond, msg) => {
  if (!cond) fail(msg);
};

// Injuries are counted by depth.js as they happen.
const counter = D.tally;

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------
function checkDay(L, where) {
  const inSeason = L.phase === 'regular' || L.phase === 'postseason';
  const errs = D.integrity(L, { inSeason, depth: L.phase !== 'offseason' });
  for (const e of errs.slice(0, 5)) fail(`${where}: ${e}`);
  if (L.phase === 'offseason') return;
  for (const t of L.teams) {
    // The lineup and the starter the engine would actually use today.
    const lu = BB.engine.lineupFor(L, t);
    if (lu.length !== 9) fail(`${where}: ${t.id} engine lineup has ${lu.length}`);
    if (lu.some((e) => !t.roster.includes(e.pid) || L.players[e.pid].injury)) fail(`${where}: ${t.id} engine lineup uses an injured or non-roster player`);
    for (const id of t.rotation) if (L.players[id].injury) fail(`${where}: ${t.id} rotation has injured ${id}`);
    const pit = t.roster.filter((id) => D.isPitcher(L.players[id])).length;
    if (inSeason && (pit < 10 || pit > 16)) fail(`${where}: ${t.id} carries ${pit} pitchers`);
  }
}

// One day, sometimes through the user's game paths (quick and play-to-finish).
function playDay(L, stats) {
  const t = S.today(L);
  const ug = t.userGame;
  if (ug && ug.status !== 'final' && (ug.type === 'allstar' || rnd() < 0.08)) {
    const mode = ug.type === 'allstar' || rnd() < 0.5 ? 'play' : 'quick';
    const r = S.startUserGame(L, ug.id, mode);
    if (!r) fail('startUserGame returned nothing for ' + ug.id);
    else if (!r.done) {
      if (mode === 'play') assert(r.g.inning === 1 && r.g.outs === 0, 'play mode should start at the first pitch');
      if (ug.type === 'post') assert(r.g.meta && r.g.meta.label && r.g.meta.seriesText, 'postseason game meta has label and seriesText');
      if (ug.type === 'allstar') assert(r.g.meta && r.g.meta.label === 'All-Star Game' && r.g.playerIdx >= 0, 'All-Star game is the user\'s');
      S.finishUserGame(L, ug.id, r.g);
    }
    stats.userPaths++;
    if (L.days[L.day] && L.days[L.day].date === t.date) S.simDay(L); // finish the day if anything is left
  } else S.simDay(L);
  checkDay(L, `${L.year} ${L.phase} ${t.date}`);
}

function trySomeTrade(L, stats) {
  const me = S.userTeam(L);
  const win = TR.windowOpen(L);
  const others = L.teams.filter((t) => t.id !== USER);
  const partner = others[Math.floor(rnd() * others.length)];
  // Ask for a decent player; offer a mid-roster one, then let balance() suggest more.
  const target = partner.roster.map((id) => L.players[id]).filter((p) => !p.injury && p.ovr >= 58 && p.ovr <= 68)[0];
  const chip = me.roster.map((id) => L.players[id]).filter((p) => !p.injury && p.ovr < 64).sort((a, b) => b.ovr - a.ovr)[0];
  if (!target || !chip) return;
  const offer = { fromTeamId: USER, toTeamId: partner.id, give: [chip.id], get: [target.id] };
  let ev = TR.evaluate(L, offer);
  assert(typeof ev.accept === 'boolean' && typeof ev.delta === 'number' && typeof ev.reason === 'string', 'evaluate returns { accept, reason, delta }');
  if (!win.open) {
    assert(!ev.accept, 'trades are refused outside the window');
    stats.tradeBlocked++;
    return;
  }
  if (!ev.accept) {
    const add = TR.balance(L, offer);
    if (add) {
      offer.give.push(add);
      ev = TR.evaluate(L, offer);
    }
  }
  if (ev.accept) {
    const r = TR.execute(L, offer);
    assert(r.ok, 'accepted trade executes');
    if (r.ok) stats.userTrades++;
    assert(L.players[target.id].teamId === USER && L.players[chip.id].teamId === partner.id, 'traded players changed teams');
  }
  // A lopsided ask must be refused.
  const star = partner.roster.map((id) => L.players[id]).sort((a, b) => b.ovr - a.ovr)[0];
  const junk = me.reserves.map((id) => L.players[id]).sort((a, b) => a.ovr - b.ovr)[0];
  if (star && junk) assert(!TR.evaluate(L, { fromTeamId: USER, toTeamId: partner.id, give: [junk.id], get: [star.id] }).accept, 'CPU refuses junk for its best player');
}

function leagueLine(L) {
  let ab = 0, h = 0, hr = 0, pa = 0;
  for (const id in L.players) {
    const s = L.players[id].stats.reg.bat;
    ab += s.ab; h += s.h; hr += s.hr; pa += s.pa;
  }
  let runs = 0, games = 0;
  for (const t of L.teams) {
    runs += t.rec.rs;
    games += t.rec.w + t.rec.l;
  }
  return { avg: h / ab, hrPct: (100 * hr) / pa, rpg: runs / games };
}

function avgActive(L) {
  let ovr = 0, age = 0, n = 0;
  for (const t of L.teams) for (const id of t.roster) {
    ovr += L.players[id].ovr;
    age += L.players[id].age;
    n++;
  }
  return { ovr: ovr / n, age: age / n };
}

(async () => {
  const T0 = Date.now();
  const L = S.newFranchise({ userTeamId: USER, difficulty: 'medium', seed: SEED });
  const summary = [];
  checkDay(L, 'new franchise');
  for (let season = 0; season < SEASONS; season++) {
    const year = L.year;
    const row = { year, timing: {} };
    const stats = { userPaths: 0, userTrades: 0, tradeBlocked: 0 };
    const inj0 = counter.injuries;
    const il0 = counter.il;
    const trades0 = (L.trades || []).length;
    const start = avgActive(L);

    // Spring training.
    let t0 = Date.now();
    assert(L.phase === 'spring', 'season starts in spring');
    while (!S.phaseDone(L)) playDay(L, stats);
    const ut = S.userTeam(L);
    const pick = O.suggestRoster(L, ut);
    const res = O.setOpeningDay(L, pick);
    assert(res.ok, 'suggested Opening Day roster is valid: ' + res.errors.join(' '));
    row.springEvents = L.spring.events.length;
    S.advancePhase(L);
    assert(L.teams.every((t) => t.roster.length === 26), 'Opening Day rosters are 26');
    assert(pick.every((id) => ut.roster.includes(id) || (L.players[id] && L.players[id].injury)), 'user Opening Day choice applied');
    if (MANUAL) ut.manual = true;
    row.timing.spring = Date.now() - t0;
    checkDay(L, `${year} opening day`);

    // Regular season.
    t0 = Date.now();
    let tradeTried = false;
    while (!S.phaseDone(L)) {
      if (!tradeTried && L.day === 40) {
        trySomeTrade(L, stats);
        tradeTried = true;
      }
      if (L.day === TR.deadlineDay(L) + 2) trySomeTrade(L, stats);
      playDay(L, stats);
    }
    row.timing.regular = Date.now() - t0;
    const gp = L.teams.map((t) => t.rec.w + t.rec.l);
    assert(gp.every((g) => g === 162), 'every team plays 162 (got ' + Math.min(...gp) + '-' + Math.max(...gp) + ')');
    assert(L.allStar && L.allStar.result, 'the All-Star Game was played');
    if (L.allStar) {
      const as = L.allStar;
      const n = as.rosters.map((r) => D.rosterPids(r).length);
      assert(n.every((x) => x >= 24 && x <= 27), 'All-Star rosters ~26 (' + n.join('/') + ')');
      assert(as.rosters.every((r) => r.starters.length === 9), 'All-Star lineups have 9');
      assert(L.games[as.gameId].meta.userPlays && L.games[as.gameId].meta.userSide, 'All-Star game meta');
      row.allStar = `${as.rosters[as.awayLg].abbr} ${as.result.score[0]}, ${as.rosters[as.homeLg].abbr} ${as.result.score[1]}; MVP ${as.result.mvp ? as.result.mvp.name : '-'}`;
    }
    assert(L.awards && L.awards.year === year && L.awards.leagues.length === 2, 'awards computed at the end of the regular season');
    const clinch = L.teams.filter((t) => t.clinch).length;
    row.clinchMarked = clinch;
    row.line = leagueLine(L);
    // Rest pattern: games started by regulars and catchers.
    const starts = [];
    const cStarts = [];
    for (const t of L.teams) {
      for (const e of t.lineup) {
        const p = L.players[e.pid];
        const g = p.stats.reg.bat.g;
        if (p.pos === 'C') cStarts.push(g);
        else if (p.pos !== 'DH') starts.push(g);
      }
    }
    const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
    row.rest = { regular: med(starts), catcher: med(cStarts) };
    const wars = [];
    for (const id in L.players) {
      const p = L.players[id];
      if (p.teamId && (p.stats.reg.bat.pa >= 300 || p.stats.reg.pit.outs >= 300)) wars.push(D.value(L, p));
    }
    wars.sort((a, b) => b - a);
    row.war = { top: wars[0], p90: wars[Math.floor(wars.length * 0.1)], med: wars[Math.floor(wars.length / 2)] };
    row.awards = L.awards.leagues.map((lg) => `${lg.name.split(' ')[0]}: MVP ${lg.mvp ? lg.mvp.name + ' ' + lg.mvp.war : '-'}, Cy ${lg.cy ? lg.cy.name + ' ' + lg.cy.war : '-'}, ROY ${lg.roy ? lg.roy.name : '-'}, RotY ${lg.rel ? lg.rel.name : '-'}`);
    S.advancePhase(L);
    assert(L.phase === 'postseason', 'postseason started');
    assert(L.post && L.post.seeds.every((s) => s.length === 6 && new Set(s).size === 6), 'six seeds per league');

    // Postseason.
    t0 = Date.now();
    let guard = 0;
    while (!S.phaseDone(L) && guard++ < 60) playDay(L, stats);
    row.timing.post = Date.now() - t0;
    const fin = L.post.series.filter((s) => s.key === 'final');
    assert(fin.length === 1 && fin[0].winner && L.post.champion === fin[0].winner, 'exactly one champion');
    assert(L.post.series.length === 4 + 4 + 2 + 1, 'eleven series (got ' + L.post.series.length + ')');
    for (const s of L.post.series) assert(s.winner && s.wins[s.winner] === s.need && s.results.length === s.wins[s.hi] + s.wins[s.lo], `series ${s.id} complete and consistent`);
    const champs = L.news.filter((n) => n.kind === 'champion' && n.text.includes(String(year)));
    assert(champs.length === 1, 'one champion news item');
    for (const id in L.games) {
      const g = L.games[id];
      if (g.type === 'post') {
        assert(g.status === 'final', 'postseason game played ' + id);
        assert(g.meta && /· Game \d/.test(g.meta.label) && g.meta.seriesText, 'postseason label ' + id);
      }
    }
    const champ = S.team(L, L.post.champion);
    row.champion = `${champ.city} ${champ.name} over ${S.team(L, L.post.runnerUp).abbr} ${fin[0].wins[fin[0].winner]}-${fin[0].wins[fin[0].loser]}; MVP ${L.post.mvp ? L.post.mvp.name : '-'}`;
    row.postDays = L.days.length;
    row.injuries = (counter.injuries - inj0) / 30;
    row.il = (counter.il - il0) / 30;
    S.advancePhase(L);

    // Offseason, step by step, auto-deciding for the user.
    t0 = Date.now();
    assert(L.phase === 'offseason' && L.offStep === 'recap', 'offseason starts at recap');
    assert(L.history.length === season + 1 && L.history[season].champion === champ.id, 'history entry written at recap');
    let steps = 0;
    trySomeTrade(L, stats);
    while (L.offStep !== 'done' && steps++ < 30) {
      const step = L.offStep;
      if (step === 'resign') {
        const r = L.off.resign;
        row.resignDecisions = r.list.length;
      }
      if (step === 'draft') {
        O.simDraft(L, { untilUser: true });
        if (O.onClock(L) === USER) {
          const best = L.draft.pool[0];
          assert(O.draftPick(L, best).ok, 'user draft pick works when on the clock');
        }
        assert(!O.draftPick(L, L.draft.pool[0]).ok || O.onClock(L) === USER, 'draft pick refused when not on the clock');
      }
      O.autoUser(L);
      O.advance(L);
      checkDay(L, `${year} offseason ${step}`);
    }
    row.timing.off = Date.now() - t0;
    assert(L.offStep === 'done' && S.phaseDone(L), 'offseason reaches done');
    row.retired = L.off.retired.length;
    row.notableRetired = L.off.retired.filter((r) => r.notable).slice(0, 3).map((r) => `${r.name} (${r.age})`).join(', ');
    row.draft = `${L.draft.picks.length} picks; #1 ${L.draft.picks[0].name} (${L.draft.picks[0].pos}, ${S.team(L, L.draft.picks[0].teamId).abbr})`;
    row.fa = L.off.fa.log.length;
    row.faUser = L.off.fa.log.filter((x) => x.teamId === USER).length;
    row.trades = (L.trades || []).length - trades0;
    row.userTrades = stats.userTrades;
    row.userPaths = stats.userPaths;
    const pr = L.off.progress;
    row.progress = `${pr.rows[0].name} +${pr.rows[0].delta}, ${pr.rows[pr.rows.length - 1].name} ${pr.rows[pr.rows.length - 1].delta}`;
    assert(Object.keys(L.games).length === 0 && L.days.length === 0, 'season games and calendar cleared');
    S.advancePhase(L);
    assert(L.phase === 'spring' && L.year === year + 1, 'next spring in the next year');
    assert(L.post === null && L.awards === null && L.allStar === null, 'season objects reset');
    checkDay(L, `${year + 1} spring start`);
    row.players = Object.keys(L.players).length;
    row.freeAgents = L.freeAgents.length;
    row.avgStart = start;
    row.avgEnd = avgActive(L);
    row.saveMB = JSON.stringify(L).length / 1e6;
    summary.push(row);
  }

  console.log(`\nFranchise test: ${SEASONS} season(s), seed ${SEED}, user ${USER}\n`);
  for (const r of summary) {
    console.log(`== ${r.year} ==`);
    console.log(`  champion      ${r.champion}  (postseason ${r.postDays} days)`);
    for (const a of r.awards) console.log(`  awards        ${a}`);
    console.log(`  All-Star      ${r.allStar}`);
    console.log(`  injuries      ${r.injuries.toFixed(1)} per team-season (${r.il.toFixed(1)} IL stints)`);
    console.log(`  rest          median games started: regulars ${r.rest.regular}, catchers ${r.rest.catcher}`);
    console.log(`  league        ${r.line.rpg.toFixed(2)} runs per team-game, AVG ${r.line.avg.toFixed(3)}, HR% ${r.line.hrPct.toFixed(1)}`);
    console.log(`  value (WAR)   best ${r.war.top.toFixed(1)}, top-10% ${r.war.p90.toFixed(1)}, median regular ${r.war.med.toFixed(1)}`);
    console.log(`  standings     ${r.clinchMarked} teams marked x/w/e at season end`);
    console.log(`  spring        ${r.springEvents} breakouts/slumps`);
    console.log(`  offseason     ${r.retired} retired (${r.notableRetired}); draft ${r.draft}; ${r.fa} free-agent signings (${r.faUser} yours); ${r.resignDecisions} re-sign decisions`);
    console.log(`  trades        ${r.trades} (${r.userTrades} by you); user game paths used ${r.userPaths}x`);
    console.log(`  development   ${r.progress}`);
    console.log(`  league size   ${r.players} players, ${r.freeAgents} free agents; active avg ovr ${r.avgStart.ovr.toFixed(1)} → ${r.avgEnd.ovr.toFixed(1)}, age ${r.avgStart.age.toFixed(1)} → ${r.avgEnd.age.toFixed(1)}; save ${r.saveMB.toFixed(2)} MB`);
    console.log(`  timing        spring ${(r.timing.spring / 1000).toFixed(1)}s, regular ${(r.timing.regular / 1000).toFixed(1)}s, post ${(r.timing.post / 1000).toFixed(1)}s, offseason ${(r.timing.off / 1000).toFixed(1)}s`);
  }
  console.log(`\ninjury types: ${JSON.stringify(counter.byType)}`);
  console.log(`total ${((Date.now() - T0) / 1000).toFixed(1)} s`);
  if (failures) {
    console.log(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nall checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
