// Browser check for in-season form (Milestone 2): hot and cold icons on the
// roster, lineup, leaders and profile, profile notes, and the game HUD.
// Opens index.html from disk (file://), builds a franchise in the page, sims
// spring and a month, then screenshots each screen at 1280x800 and 390x844.
// Run: node tools/e2e/form-check.js [outDir]
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const OUT = process.argv[2] || path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.join(__dirname, '..', '..', 'index.html');

async function run(size) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForTimeout(300);
  // A franchise one month into the season, with a few notes guaranteed.
  const info = await page.evaluate(async () => {
    const S = BB.season;
    const L = S.newFranchise({ userTeamId: 'HAW', difficulty: 'medium', seed: 3 });
    await S.simUntil(L, { to: 'endPhase' }, { includeUser: true });
    BB.offseason.setOpeningDay(L, BB.offseason.suggestRoster(L, S.userTeam(L)));
    S.advancePhase(L);
    await S.simUntil(L, { to: 'month' }, { includeUser: true });
    const t = S.userTeam(L);
    const pl = (id) => L.players[id];
    // Make sure the user's roster shows both icons and a note or two.
    const hitters = t.lineup.map((e) => pl(e.pid));
    BB.form.lastingChange(L, hitters[0], 'breakout', S.today(L).date);
    BB.form.lastingChange(L, hitters[1], 'down', S.today(L).date);
    hitters[0].form = { v: 4.5 }; // after the change, which cools form
    hitters[1].form = { v: -4.5 };
    BB.ui.setLeague(L);
    const hot = Object.values(L.players).filter((p) => BB.form.status(L, p) === 'hot').length;
    const cold = Object.values(L.players).filter((p) => BB.form.status(L, p) === 'cold').length;
    return { hot, cold, pid: hitters[0].id, pitcher: t.rotation[0] };
  });
  // Main menu → Continue would read the save; open the franchise directly.
  await page.evaluate(() => {
    document.getElementById('screen-title').hidden = true;
    BB.ui.show(BB.ui.league(), 'team', { sub: 'roster' });
  });
  const tag = `${size.width}x${size.height}`;
  const shot = async (name) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const report = { size: tag, hot: info.hot, cold: info.cold, icons: {}, overflow: {} };
  await page.waitForTimeout(200);
  report.icons.roster = await page.locator('.fr-form').count();
  report.overflow.roster = await overflow();
  await shot('roster');
  await page.evaluate(() => BB.ui.show(BB.ui.league(), 'team', { sub: 'lineup' }));
  await page.waitForTimeout(200);
  report.icons.lineup = await page.evaluate(() => [...document.querySelectorAll('.fr-lu-p option:checked')].filter((o) => /\u{1F525}|❄/u.test(o.textContent)).length);
  report.overflow.lineup = await overflow();
  await shot('lineup');
  await page.evaluate(() => BB.ui.show(BB.ui.league(), 'leaders'));
  await page.waitForTimeout(200);
  report.icons.leaders = await page.locator('.fr-form').count();
  report.overflow.leaders = await overflow();
  await shot('leaders');
  await page.evaluate((pid) => BB.ui.openPlayer(pid), info.pid);
  await page.waitForTimeout(300);
  report.icons.profile = await page.locator('.fr-prof .fr-form').count();
  report.notes = await page.locator('.fr-notes li').allTextContents();
  report.overflow.profile = await overflow();
  await shot('profile');
  await page.screenshot({ path: path.join(OUT, `${tag}-profile-notes.png`), fullPage: false });
  await page.evaluate(() => document.querySelector('.fr-notes') && document.querySelector('.fr-notes').scrollIntoView());
  await page.waitForTimeout(150);
  await shot('profile-notes');
  await page.keyboard.press('Escape');
  // A played game: make today's batter and pitcher hot and cold, then play.
  const gid = await page.evaluate(() => {
    const L = BB.ui.league();
    const ug = BB.season.today(L).userGame;
    if (!ug) return null;
    for (const t of L.teams) for (const id of t.roster) {
      const p = L.players[id];
      p.form = { v: BB.season.userTeam(L).id === t.id ? 4.5 : -4.5 };
    }
    BB.ui.playGame(ug.id, 'play');
    return ug.id;
  });
  report.game = !!gid;
  if (gid) {
    await page.waitForTimeout(2500);
    report.hud = await page.evaluate(() => ({ batter: document.getElementById('mu-batter').innerHTML.includes('mu-form'), pitcher: document.getElementById('mu-pitcher').innerHTML.includes('mu-form'), text: document.getElementById('matchup').innerText }));
    report.overflow.hud = await overflow();
    await shot('hud');
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
