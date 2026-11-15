// Browser check for played games (Milestone 2b): an exhibition game and a
// franchise game played by a small autopilot, a staged gap double to look at
// the field view, and the leaders screen. Opens index.html from disk
// (file://) at 1280x800 and 390x844 and reports results, page overflow and
// console errors. Screenshots go to outDir.
// Run: node tools/e2e/play-check.js [outDir]
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const OUT = process.argv[2] || path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');

// Runs in the page: swings, pitches and answers tag-ups for the user.
function autopilot() {
  const dd = window.__dd;
  const S = dd.S;
  window.__auto = { swings: 0, pitches: 0 };
  window.__autoTimer = setInterval(() => {
    const g = S.g;
    if (!g || g.over || S.screen !== 'game') return;
    const batting = BB.game.playerBatting(g);
    if (S.phase === 'tagup') dd.answerTagUp(Math.random() < 0.5);
    else if (S.phase === 'ready' && !batting) {
      dd.throwPitch((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6);
      window.__auto.pitches++;
    } else if (S.phase === 'flight' && batting && S.pitch && !S.pitch.swung && S.pitch.t >= S.pitch.travel - 0.1 && Math.random() < 0.8) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      window.__auto.swings++;
    }
  }, 8);
}

function gameLine() {
  const g = window.__dd.S.g;
  const sum = (k) => g.teams.reduce((a, t) => a + t.lineup.reduce((b, p) => b + p.stats[k], 0), 0);
  return { over: g.over, inning: g.inning, score: g.teams.map((t) => t.runs).join('-'), hits: sum('h'), doubles: sum('d'), strikeouts: sum('k') };
}

async function run(size) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForTimeout(300);
  const tag = `${size.width}x${size.height}`;
  const shot = async (name) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const report = { size: tag, overflow: {} };

  // 1. Exhibition: a staged gap double. The user's first swing becomes a
  // hard line drive to right-center that an outfielder has to run down.
  await page.evaluate(() => {
    BB.store.setSettings({ innings: 3, playerHome: false, difficulty: 'easy' });
    const real = BB.sim.contact;
    BB.sim.contact = function () {
      BB.sim.contact = real;
      return { kind: 'inplay', ev: 150, theta: 14, phi: 15, quality: 1 };
    };
    window.__dd.startGame();
  });
  await page.evaluate(autopilot);
  await page.waitForFunction(() => window.__dd.S.view === 'field' && window.__dd.S.play, null, { timeout: 30000 });
  const staged = await page.evaluate(() => {
    const p = window.__dd.S.play;
    return { result: p.result.label, fielder: p.fielded.pos, fieldedAt: +p.fielded.t.toFixed(2), chase: +(p.fielded.chase || 0).toFixed(2) };
  });
  report.staged = staged;
  for (const t of [1.5, 3.2, staged.fieldedAt, staged.fieldedAt + 1.2, staged.fieldedAt + 3]) {
    await page.waitForFunction((tt) => window.__dd.S.view !== 'field' || window.__dd.S.playT >= tt, t, { timeout: 20000 });
    await shot('gap-double-' + t.toFixed(1));
  }
  report.overflow.field = await overflow();

  // 2. The rest of the exhibition game, fast-forwarded.
  await page.evaluate(() => (window.__dd.S.timeScale = 8));
  await page.waitForFunction(() => window.__dd.S.g.over, null, { timeout: 240000 });
  report.exhibition = await page.evaluate(gameLine);
  await page.waitForTimeout(600);
  await shot('exhibition-over');
  report.overflow.exhibition = await overflow();
  await page.evaluate(() => {
    clearInterval(window.__autoTimer);
    window.__dd.S.timeScale = 1;
    window.__dd.toTitle();
  });

  // 3. Franchise: three weeks in, then the leaders screen and a played game.
  await page.evaluate(async () => {
    const S = BB.season;
    const L = S.newFranchise({ userTeamId: 'HAW', difficulty: 'easy', seed: 5 });
    await S.simUntil(L, { to: 'endPhase' }, { includeUser: true });
    BB.offseason.setOpeningDay(L, BB.offseason.suggestRoster(L, S.userTeam(L)));
    S.advancePhase(L);
    for (let i = 0; i < 21; i++) S.simDay(L);
    BB.ui.setLeague(L);
    document.getElementById('screen-title').hidden = true;
    BB.ui.show(L, 'leaders');
  });
  await page.waitForTimeout(300);
  report.overflow.leaders = await overflow();
  report.leaderRows = await page.locator('#franchise table tr').count();
  await shot('leaders');
  const gid = await page.evaluate(() => {
    const L = BB.ui.league();
    const ug = BB.season.today(L).userGame;
    if (ug) BB.ui.playGame(ug.id, 'play');
    return ug ? ug.id : null;
  });
  report.leagueGame = !!gid;
  if (gid) {
    await page.waitForTimeout(1500);
    await shot('league-game');
    report.overflow.leagueGame = await overflow();
    await page.evaluate(autopilot);
    await page.evaluate(() => (window.__dd.S.timeScale = 8));
    // Three innings by hand (autopilot), then the game's own "sim to end".
    await page.waitForFunction(() => window.__dd.S.g.over || window.__dd.S.g.inning >= 4, null, { timeout: 240000 });
    report.league = await page.evaluate(gameLine);
    await page.evaluate(() => {
      clearInterval(window.__autoTimer);
      window.__dd.S.timeScale = 1;
      window.DD.simLeagueToEnd();
    });
    await page.waitForTimeout(800);
    report.leagueFinal = await page.evaluate((id) => {
      const gm = BB.ui.league().games[id];
      return gm ? { status: gm.status, score: gm.score } : null;
    }, gid);
    await shot('league-after');
  }
  report.errors = errors;
  await browser.close();
  return report;
}

(async () => {
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) console.log(JSON.stringify(await run(size), null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
