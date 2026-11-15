# Diamond Dash: design notes

This summary comes from the design interview. Use it as the reference for later work. Items marked *(default)* were open questions in the interview. They have a sensible default for now and can be changed at any time.

## Core game
- A full mini baseball game: you bat and pitch against a CPU team.
- Before each game you pick **1, 3 or 9 innings**.
- It runs in the browser with no build step: open `index.html`. Hoop Frenzy (the Basketball1 repo) is the reference for the overall approach.

## Controls
- **Batting is timing only.** Tap, click or press Space to swing. Swinging **early** pulls the ball (left field for a right-handed batter) and swinging **late** sends it the opposite way. A perfectly timed swing gives the hardest contact. Pitches outside the zone are harder to hit well, so you can also choose to take a pitch.
- **Pitching:** pick one of your pitcher's pitches (each pitcher throws 3–5 of the 7 pitch types; see "Pitch types and bullpen"), then tap where in the zone to throw it. Control isn't perfect, so the pitch lands near the spot you aimed at.
- **Fielding and baserunning are automatic**, with two exceptions you control:
  - **Steal:** before a pitch, send the runner (steal 2nd or 3rd).
  - **Tag up:** after a catch in the outfield, choose whether the lead runner tags up and runs.

## Presentation
- **Camera behind the batter** (catcher's view) for every pitch.
- When the ball is put in play, the view cuts to a **top-down field view** that shows the fielders, the runners and the throws. *(This was an inference from the interview, not something you said.)*
- The art is clean, flat 2D, drawn on a canvas.
- It works on **phone and desktop**, with touch, mouse and keyboard.

## Included in the first version
- **Easy / Medium / Hard.** Difficulty changes pitch speed, the swing timing window, how well the CPU hits, CPU pitch mix and control, and how many hints you get (Easy shows the pitch type and where it will cross the plate).
- **Team names and colors.** You name your team and pick a color. You pick a CPU opponent from preset fictional teams.
- **Box score and records.** A line score and per-player batting and pitching lines. Win/loss records and personal bests are saved in the browser (localStorage).
- **Sound effects.** Bat crack, mitt pop, crowd and umpire calls, all generated in code with Web Audio. The umpire voice uses speech synthesis where the browser supports it.

## Open questions and their current defaults
- **Game name:** "Diamond Dash" *(default)*
- **CPU team players:** generated fictional names with small rating differences (contact, power, speed) *(default)*
- **Home/away:** you pick on the setup screen whether you bat first (away) or second (home) *(default)*
- **Extra innings:** play until there's a winner, up to 3 extra innings, then the game ends in a tie *(default)*
- **Mercy rule:** only in 9-inning games, a 10-run lead after 7 innings ends the game *(default)*

## Players: visual direction (second interview)

Only the players change this round. The stadium, the menus and HUD, and the field layout stay as they are.

**Problems with the first version:** the figures looked too simple, and the animation was stiff.

**Look**
- Sleek, athletic silhouettes with minimal detail and elegant poses.
- A near-black body with team-color trim on the cap, sleeves, jersey number, belt and socks. A light rim highlight keeps dark figures readable against the field. *(The rim highlight and the belt and socks trim are defaults; they weren't discussed.)*
- Hands and faces are dark too, so the whole figure is one silhouette *(default)*.

**Motion: smooth and realistic**
- **Top priority is the idle and ready poses:**
  - breathing and sway, so players never freeze
  - the batter waggles the bat and settles into the stance
  - the pitcher leans in for the sign, then comes set
  - between at-bats, the batter steps out, adjusts, and steps back in
- **The windup and swing are redone with the same realistic feel:**
  - the windup goes from the stretch: set, leg kick, stride, arm whip, follow-through
  - the batter loads as the pitch is delivered, then the swing turns the hips and follows through
- Built with a jointed skeleton (inverse kinematics for arms and legs) and keyframed poses, blending smoothly between animations.
- The timing from release to the plate doesn't change, so gameplay and difficulty tuning stay the same.

**Field view:** the dots are replaced by tiny top-down figures with running legs, a dark body and a team-color cap.

**Later:** player reactions, such as the batter dropping the bat to run or the pitcher reacting to a big hit.

**Planned, not built:** `docs/blueprint.md` (W3) plans to replace the silhouette look with real characters in a 3D look. Until that is built, this section describes the game as it is.

## Pitch types and bullpen
- **7 pitch types:** four-seam fastball, sinker, cutter, slider, curveball, change-up and splitter. Each one has its own speed, movement, effect on contact (for example, sinkers and splitters produce more ground balls), and how much it fools hitters after a pitch of a different speed.
- **Each pitcher throws 3–5 of them**, with their own velocity, control and stamina.
- **Bullpen:** each team has a starter and 4 relievers.
  - You can bring in a reliever between pitches while you're pitching (BULLPEN button, or `B`).
  - A pitcher who has been taken out can't come back.
  - The CPU makes a pitching change when its pitcher tires or is getting hit hard.
- **Fatigue:** once a pitcher passes their stamina, control gets worse and velocity drops. The HUD shows your pitcher's energy.
- Franchise bullpens (8 relievers, rest rules and roles) are described under "Bullpen workload" below.

## Franchise mode (third interview)

### What you asked for
- **Animations:** more natural motion with variety for the batter and pitcher (they still looked stiff, and every swing and pitch looked the same); reactions (celebrations, bat flips, pitcher frustration); a follow cam during plays plus replays of big moments; special presentation in the postseason.
- **Players:** visible ratings, varied looks (body types, batting stances, windups), and growth driven by both age and performance.
- **Profiles and stats:** season stats, career history, ratings and bio, a game log, and splits.
- **Season:** a full 162-game season in a 30-team league with 2 leagues and 6 divisions. Every way to play: play or sim each game, sim to a date, or quick-play only the key moments. Postseason with special presentation. Standings and leaders, awards and an All-Star game, injuries and rest with a 5-man rotation, trades, free agency, a draft, and **spring training**.
- **Build order:** the season foundation first.

### Defaults (chosen because these questions were left open)
- You control **one team**. You can take over any of the 30 teams, rename it and recolor it.
- **Quick exhibition games stay** as a separate mode on the main menu.
- **Postseason: 12 teams**, 6 per league (3 division winners plus 3 wild cards). The top 2 seeds in each league get a bye. Wild Card Series is best of 3, Division Series best of 5, League Championship Series best of 7, and the final (the "Diamond Series") best of 7.
- **One franchise save slot**, autosaved in the browser (IndexedDB).
- **Simulated games keep full box scores and stats**, just like games you play.
- Difficulty only affects games you play. Simulated games use neutral (Medium) physics, so league stats stay realistic.
- **Spring training:** about 15 exhibition games before each season. Stats are kept separately and don't count. Young players can break out or slump a little. You set your 26-man Opening Day roster at the end (the CPU sets its own). Spring results also set each player's form on Opening Day (see "In-season form").
- **Rosters:** 26 active (13 position players, 5 starting pitchers, 8 relievers including a closer) plus a reserve squad for injuries and prospects.
- **Ratings** run 20–99, and 60 is an average big-leaguer. Hitters have Contact, Power, Eye, Speed, Fielding and Arm. Pitchers have Velocity, Control, Stamina and Stuff, plus their own pitch set.
- **Contracts and money** are kept simple: salaries in $M, years remaining, and a payroll budget per team. Payroll always means the whole organization (active roster, injured list, reserves and prospects) plus released players still being paid. Every screen and rule uses that one total (owner's choice, Nov 14, 2026).

### Build phases
1. **Season foundation:** league, schedule, play/quick-play/sim, standings, stats, player profiles, saving.
2. **Players:** ratings in the sim, looks, growth.
3. **Season depth:** rotation and rest, injuries, All-Star game, awards, postseason.
4. **Offseason:** retirements, progression, contracts and free agency, trades, draft, spring training, next season.
5. **Animation pass:** natural, varied motion, reactions, follow cam, replays, postseason presentation.

See `ARCHITECTURE.md` for how the code is organized.

## Project goal (planning interview, Nov 14, 2026)
- **Goal:** share Diamond Dash with friends.
- **How they get it:** a public web page they open in a browser on a phone or computer (for example GitHub Pages). An app version may come later.
- **Planning:** happens in a claude.ai project and building in Claude Code sessions. The coding session keeps `docs/plan.md` current, and milestone size is flexible.

## Strikeout and slugging balance (Milestone 1b, Nov 14, 2026)

**Owner's choices:** raise strikeouts slightly, lower batting average, raise slugging through extra-base hits; more diversity instead of everyone bunched near the middle, with 1–2 (maybe 3 or 4) standout pitchers and hitters per league way above the pack; keep runs per team-game near 4.5; accept fewer doubles for now and let more of the slugging come from home runs. The target numbers were proposed by Claude from general baseball knowledge (not research) and approved by the owner.

**What changed** (league games only; exhibition games and the playable game's physics are untouched)
- **Putting hitters away:** with two strikes, a league pitcher's pitches are harder to time. The size of that edge comes from Stuff (three quarters) and Velocity (one quarter). *(Milestone 2b made it all Stuff; see "Balance pass 2".)* The few pitchers past 82 on that mix get a much bigger edge: they are the strikeout aces.
- **Ratings count for more:** each point of Contact, Power and Stuff moves results more than before, and elite Contact is no longer soft-capped. Before this, a pitcher's Stuff moved his results about 5% at most and a hidden random quality on each pitch mattered as much, so low-rated starters won Cy Young awards.
- **Fewer singles, more extra-base hits:** infielders cover more ground, outfielders cover less, and every hitter has a little more power.
- **Games you play:** CPU hitters strike out a little more against your pitching, and the best CPU pitchers are a little harder to hit hard (approved by the owner).
- A "standout" is a qualified starter striking out 28% or more, or a qualified hitter slugging .600 or more *(default)*.

**Targets and results** (six simulated seasons after the change; `node tools/measure.js`)
| Measure | Before | After | Target |
|---|---|---|---|
| Runs per team-game | 4.47–4.61 | 4.48–4.65 | about 4.5 |
| League strikeout rate | 18.1–18.6% | 20.9–21.4% | about 21% |
| League AVG | .284–.287 | .268–.274 | about .268 |
| League SLG | .427–.435 | .445–.457 | about .440 |
| League OBP | .325–.328 | .311–.316 | about .310 |
| Extra-base hits per team-game | 2.22–2.29 (22% of hits) | 2.86–2.99 (30–31%) | about 2.8 (31%) |
| Doubles per team-game | 0.73–0.78 | 1.10–1.16 | about 1.2 or more |
| Home runs per team-game | 1.41–1.49 | 1.52–1.62 | no higher than before |
| Best starter by K% | 22.5% (about 190 K) | 29–33% (about 240–250 K) | about 29–31% |
| Starters at 28% K or more, per league | 0 | 0–4, average 1.5 | 1–2, maybe 3–4 |
| 200-strikeout pitchers | 0 | 8–13 | about 6–10 |
| .300 hitters | 63–74 | 25–40 | about 25–35 |
| Hitters slugging .600 or more, per league | 0–1 in the whole league | 0–4, average 2 | 1–2, maybe 3–4 |
| Best slugger | .555–.600 | .600–.660, 45–59 HR | about .620–.660 |

**Short of target:** doubles are up by half but still a little under 1.2 per team-game, home runs are up about 8% (the owner accepted this trade), and SLG runs a little over .450 in about one season in three. A league with no elite-rated pitcher or slugger has no standout that year, so "1–2 per league" holds on average, not every season.

**Side effects, checked**
- Team records spread a little wider: the best team wins 101–107 and the worst 46–65 (before: about 100–109 and 58–68).
- Milestone 1's bullpen and WAR numbers were re-measured and their tables below are updated.

## Balance pass 2 (Milestone 2b, Nov 15, 2026)

**Owner's choices:** more doubles (1.4 or more per team-game on average) from a ball-physics change in every game type, with runs allowed to fall to about 4.3; Stuff for whiffs and Velocity for weak contact; fewer .300 hitters, with more regulars under .240 than at .300; Contact ahead of Power for batting average; 25 hidden archetypes. The target table (proposed by Claude, approved by the owner with changes) is in `docs/plan.md` under Milestone 2b. This section is filled in as each part is built.

### Doubles (ball physics, every game type)
- **What was wrong:** almost every double was a fly ball over an outfielder's head to the wall. Outfielders fielded 3.8 line drives per team-game on the ground and 99.5% of them were singles, however far the outfielder had to run. There were no gap doubles.
- **The change** (`BB.sim.PHYS` in `js/sim.js`; exhibitions, league games, games you play and `simtest` all use it):
  - An outfielder who has to cover a lot of ground can't field a rolling ball in stride. Each foot of his run past 30 costs 0.022 seconds, up to 1 second. A ball at the wall comes back to him, so wall plays are unchanged.
  - Infielders cover 16% more ground and outfielders 5% less in every game type. These replace Milestone 1b's league-only settings (infield ×1.17, outfield ×0.9), which are now 1.
  - League hitters' power setting comes down a little (1.033 to 1.025), so home runs return to about 1.5 per team-game.
- **Results** (four simulated seasons; `simtest` is 300 exhibition games)
  | Measure | Before | After | Target |
  |---|---|---|---|
  | Doubles per team-game, league | 1.09–1.15 | 1.62–1.65 | 1.4 or more |
  | Triples per team-game, league | 0.22–0.24 | 0.10–0.11 | 0.2 or fewer |
  | Home runs per team-game, league | 1.51–1.64 | 1.44–1.56 | about 1.5 |
  | Runs per team-game, league | 4.42–4.66 | 4.27–4.51 | 4.3–4.6 |
  | League AVG | .269–.274 | .258–.264 | about .260 |
  | `simtest`: runs, AVG, doubles, triples, home runs | 4.63, .288, 0.76, 0.08, 1.48 | 4.53, .267, 1.64, 0.20, 1.48 | runs 4.3–4.6 |
- Exhibition triples rose from 0.08 to 0.20 per team-game because exhibition lineups have faster runners than league lineups; league triples fell.
- In the field view the outfielder and the ball now reach the spot together, deeper in the gap, and the batter takes second.

### Stuff and Velocity (every game type)
- **What was wrong:** Stuff did both jobs. Ten points of Stuff were worth +2.4 points of strikeout rate and 3.6 fewer hard-hit balls per 100; ten points of Velocity were worth +0.7 and 0.1, though Velocity is 25–30% of a pitcher's overall.
- **Stuff is for whiffs** (owner's choice). It makes every pitch harder to time and to lay off, and it is now all of the two-strike put-away edge (Milestone 1b used three quarters Stuff, one quarter Velocity). It no longer lowers exit velocity. The put-away edge rises steadily up to Stuff 72, more slowly from 72 to 85, and steeply past 85: those few are the strikeout aces.
- **Velocity is for weak contact** (owner's choice). Each mph above a typical pitcher takes 0.9% off exit velocity, and CPU hitters are 5 ms late per mph, so more balls go the other way. It adds almost no strikeouts. When you bat, a fast pitch still arrives sooner, as before. A tired pitcher loses velocity, so he is hit harder for that reason too.
- Exhibition pitchers have no Stuff rating; the same rules run on their pitch quality and velocity.
- The league's power setting is now 1 (it was 1.033 in Milestone 1b): league and exhibition hitters drive the ball alike.
- **Games you play:** CPU hitters still strike out a little more against your league pitchers. The best CPU pitchers are still harder to hit hard, now because of their Velocity (before, their Stuff); their Stuff still narrows your timing window.
- **Results** (eight simulated seasons, form on; "10 points" holds the other ratings fixed)
  | Measure | Before | After | Target |
  |---|---|---|---|
  | 10 points of Stuff, in pitcher K% | +2.4 | +3.7 to +3.8 | about +4 |
  | 10 points of Velocity, in pitcher K% | +0.7 | +0.1 | +0.5 or less |
  | 10 points of Velocity, in hard-hit rate | −0.1 | −2.9 to −3.0 | about −3 |
  | 10 points of Stuff, in hard-hit rate | −3.6 | −0.3 to −0.4 | about 0 |
  | K% of pitchers with Stuff under 50 / 80 or more | 16.7% / 27% | 14.7% / 27.5% | about 14–15% / about 30% |
  | Hard-hit rate against Velocity under 50 / 80 or more | 44% / 39% | 47.5% / 36.9% | about 47% / about 35% |
  | High Stuff with low Velocity: K%, hard-hit | 22.9%, 37.4% | 25.2%, 43.9% | — |
  | Low Stuff with high Velocity: K%, hard-hit | 19.7%, 45.7% | 17.9%, 38.4% | — |
  | League strikeout rate | 20.6–21.3% | 20.5–21.3% | about 21% |
  | Spread of qualified starters' K% (SD) | 2.5–3.5 | 3.3–3.8 | about 4 |
  | Best / lowest qualified starter | 29.5–32.4% / 12.4–17.3% | 28.2–32.7% / 11.4–14.6% | — |
  | Starters at 28% K or more, per league | 0–4, average 1.5 | 0–6, average about 2.2 | 1–2, maybe 3–4 |
  | Runs per team-game, league / `simtest` | 4.27–4.51 / 4.53 | 4.32–4.51 / 4.48 | 4.3–4.6 |
- **Short of target:** pitchers with Stuff 80 or more strike out 27.5%, not 30% (the band is mostly 80–85; the aces past 85 reach 30–33%). Starters at 28% vary a lot by league and season (0 to 6).

## Bullpen workload (Milestone 1, Nov 14, 2026)

The owner's simulated season showed the weakest relievers pitching 140 games and 180 innings while closers threw 35. These rules are **Claude's defaults**; the targets come from general baseball knowledge, not research.

**Rest rules** (every team, every game type)
- No reliever pitches 3 days in a row.
- A long outing needs extra rest: over 20 pitches means 1 day off, over 35 means 2, over 50 means 3.
- If fewer than 3 relievers are rested, the least-tired ones go, but still never on a third straight day.
- On the roster screens a reliever who is out today shows "Resting today". He isn't in that day's bullpen, in games you play too.

**Bullpen roles** (automatic, set each day from the arms that are available; not a roster feature you manage)
- **Closer:** your chosen closer when he's available, otherwise the best available arm. He takes the 9th inning or later when the lead is 0–3 runs.
- **Setup men:** the next two best available arms. They take the 7th and 8th of a close game (from 1 run behind to 3 ahead), one inning each. A reliever who pitched yesterday ranks a little lower, so the late innings rotate.
- **Middle relief:** everyone else. In a close game the freshest arm goes first (then the better one). Otherwise any arm with a day off goes, fewest innings this season first, so low-leverage work is shared.
- These rules run the CPU teams, simulated games and simulated stretches of your games. In a game you play, your pitching changes are still yours (your pitcher is never pulled automatically).

**Starters**
- Stamina in pitches is now `68 + 0.32 × Stamina rating` (was `55 + 0.55 ×`), so a durable ace throws about 97 pitches before tiring instead of 105.
- Pace guard (Milestone 2, Claude's default): a starter with 8 or more starts averaging over 6.2 innings a start gets 10% less stamina that day. Hot streaks had pushed the season's top starter to 222–230 IP about one season in three; with the guard it is back to 203–216 over 12 measured seasons, and typical starters are unchanged (5.3–5.4 IP a start).
- With a deep bullpen available (5 or more arms), a starter near his limit doesn't start the 7th (70% of his stamina) or the 8th and 9th (60%), unless he's working on a shutout. (Milestone 1b lowered these from 80% and 65%, because strikeout aces were going deeper.) Exhibition teams have 4 relievers, so their starters still go until they tire.

**Scoring:** better relievers in more innings cut league scoring by about 0.15 runs per team-game, so every league hitter gets a 1.5% contact lift to keep it at about 4.5. Exhibition games don't use it. (Milestone 1b later retuned the whole league line; see above.)

**Targets and results** (`node tools/measure.js`; "After 1b" is six seasons on the Milestone 1b balance)
| Measure | Before | After Milestone 1 | After 1b | Target |
|---|---|---|---|---|
| Relief appearances on a 3rd straight day | 3,500–3,900 a season | 0 | 0 | 0 |
| Busiest reliever, innings in relief | 179–228 | 85–100 (109 once) | 90–107 | about 60–80, warning above about 95 |
| Most games by a reliever | 145–151 | 75–82 | 76–88 | at most about 75 |
| Average arm by bullpen slot | 36 IP (best) to 153 IP (worst) | 60–76 IP, 45–69 games | 62–77 IP, 48–69 games | — |
| Top starter | 232–250 IP | 202–218 IP | 202–218 IP | under about 210 |
| Starters with 28+ starts | 6.0 IP per start | 5.3–5.4 IP per start | 5.2–5.4 IP per start | — |
| Runs per team-game | 4.54–4.66 | 4.42–4.72 (average 4.5) | 4.48–4.65 | about 4.5 |

**Slightly over target:** the busiest reliever, the games leader and (in about one season in three) the top starter. They are close to real-life league leaders. Every inning a starter gives up goes to the bullpen, so pushing one number down pushes another up; tightening all three would need a ninth reliever.

**Reliever of the Year** counts only pitchers with at least 80% of their games in relief (and at least 20% of the team's games). Winners are now closers and setup men with about 55–80 innings.

## WAR and the awards (Milestone 1, Nov 14, 2026)

WAR is the game's own estimate (`BB.depth.value`), shown on the awards and re-signing screens. The targets are **Claude's defaults** from general baseball knowledge, not research.

**What the playtest numbers showed.** Before this milestone the league total was already about 1,000 WAR. The top of the scale was too flat: the best hitter was worth about 7, so MVPs came out at 5.5–9.0 and a good rookie could match the MVP. Relievers earned almost nothing (the worst arms pitched the most). Rookies were not too strong.

**Changes**
- Hitters: runs above or below average are stretched, and replacement level is about 20 runs per 600 PA. The stretch stands in for the game's best hitters standing out less than real MVPs do; it is a display choice, not a claim about real WAR. Milestone 1 set it to 1.45; Milestone 1b gave the league real standout hitters and lowered it to 1.25 (replacement 19.8).
- Pitchers: replacement level is a multiple of the league ERA: 1.22 for starters and 1.16 for relievers after Milestone 1b (Milestone 1 used 1.245 and 1.13).
- Rookies: from the second season on, a player with no big-league time counts as a rookie only up to age 27. The league starts without a past, so older players with empty careers were generated veterans, and they were winning Rookie of the Year at 30.
- What a player asks for in contract talks compares his WAR with what his rating usually brings; that expectation was refitted to the new scale.

**Targets and results** ("After 1b" is six seasons on the Milestone 1b balance)
| Measure | Before | After Milestone 1 | After 1b | Target |
|---|---|---|---|---|
| League WAR total | 980–1,018 | 998–1,037 | 1,003–1,019 | about 1,000 (900–1,100) |
| Hitters / pitchers | 60% / 40% | 55–57% / 43–45% | 55–57% / 43–45% | about 57% / 43% |
| Relievers' WAR, league total | 1–24 | 87–117 | 109–134 | — |
| MVP | 5.5–9.0, mostly 6–7 | 7.4–10.2, average 8.9 | 7.4–9.9, average 8.6 (10 of 12 at 7.9 or more) | about 8–10 |
| Best season in the league | 7–9 | 8–11, sometimes 12 | 8–10, none at 11 | no one much past 11 |
| Rookie of the Year | 3.1–6.3, some aged 30 | 2.6–6.6, all aged 20–25 | 1.9–6.2, aged 20–27 | typically 3–6 |
| Best pitcher | 7–8.6 | 6.3–8.3 | 7.1–7.8 | — |

The best season varies from year to year, so no single setting puts every MVP inside 8–10: about one MVP in six lands a little under 8.

**Noticed in Milestone 1, fixed in 1b:** a starting pitcher's results depended only weakly on his overall rating (about 0.09 WAR per rating point, against 0.24 for hitters). After Milestone 1b it is about 0.17 for starters and 0.27 for hitters.

## Playing your postseason games (Milestone 1, Nov 14, 2026)
- You can play, quick-play or sim every postseason game your team is in, through the Diamond Series (owner's choice).
- The top 2 seeds have a bye past the Wild Card Series, so they have no game for the first days. The Postseason screen and Home say so, and offer **Sim to my first game** (later **Sim to my next game**), which stops when your game comes up *(default)*.
- While your team is still playing, sims never play your postseason games by accident *(default)*: Home's Day, Week, Month and "Sim to date" stop at your next game, and "Sim to the end" / "End of postseason" ask first. The Sim button on a game still sims that one game. Regular-season sims are unchanged and include your games.

## Releasing players (Nov 14, 2026)
- You can release any player in your organization from his profile: active roster, reserves, prospects or injured list. He becomes a free agent that any team can sign.
- Blocked during the draft, and blocked if it would leave fewer than 10 healthy position players or 11 healthy pitchers on the active roster (the same rule as sending a player down).
- You keep paying his salary until his contract would have ended (owner's choice), even if another team signs him. It shows under "Released players still being paid" on the Payroll screen, and counts toward your payroll and budget. Contracts count down at the offseason re-signing step, and the dead money drops off there when it reaches zero.
- The same rule applies when CPU teams release players under contract.

## In-season form (Milestone 2, Nov 15, 2026)

In the owner's playtest nobody slumped or broke out during the season. Now players run hot or cold for a few weeks, and a few make a lasting change.

**Owner's choices**
- Temporary hot and cold form, plus lasting breakouts and declines. Nothing goes to the news; each lasting change leaves a note on the player's profile instead.
- One hot icon (🔥) and one cold icon (❄️) next to the player's name wherever it appears (roster, lineup, profile, leaders, box scores), and on the batter and pitcher in the game HUD. No levels of hot and cold.
- Spring games don't use form, but spring results set each player's form on Opening Day.
- Breakouts can be big and can push a player past his potential; going way past it is rare. Big breakouts go mostly to players 27 and under, with a rare late bloomer up to about 31 (from the plan check: players 29 and older have potential equal to overall, so any veteran gain is "past potential").
- Young prospects can take a lasting mid-season drop that also lowers their potential.

**How form works** (Claude's defaults)
- Form is a number of rating points, from −6 to +6. In a game it adds to a hitter's Contact, Power and Eye, or a pitcher's Stuff, Control and Velocity. It applies in regular-season and postseason games, played or simmed; not in spring, All-Star or exhibition games.
- After each game, form moves by the player's results against what his rating predicts (each plate appearance or batter faced counts, so a big game moves it more than one at-bat). "Predicts" comes from a league-wide fit that follows the league, so form averages out to zero and good players aren't always hot.
- Every day form fades (half of it is gone in about 12 days) and drifts a little by luck. The cap and the fade stop it feeding itself: a hot player's slightly better results add far less than the fade takes away.
- Opening Day: spring results plus a little luck set the starting form. A player with no spring games starts neutral. Existing spring breakouts and slumps are unchanged.
- The icon shows at form ±2.8 or more, which is about the top and bottom 10% of active players (measured: 8.5–13% hot and 9–12% cold at midseason; 73–115 players hot and 67–110 cold on Opening Day).
- Early in the season the leaders lists are mostly hot players, because leading in April usually means beating your rating.

**Lasting changes** (Claude's defaults; counts are across all 30 teams per regular season)
| Kind | Who | Size | Target a season | Measured (22 test seasons) |
|---|---|---|---|---|
| Step forward | hot players, mostly 25 and under | +1 to +3 on 1–3 of the main ratings | about 9 | 2–14 |
| Step back | cold players, mostly 30 and older | −1 to −3 on 1–3 ratings (Speed and Fielding too) | about 8 | 4–14 |
| Big breakout | hot players, mostly 27 and under | +5 to +10 on 2–3 main ratings (about +3 to +7 overall) | 1–3 | 0–6, average about 2 |
| Prospect bust | 24 and under with room to grow: cold big-leaguers, or prospects in the organization | −5 to −10 on 2–3 main ratings; potential drops as far as overall plus 2–6 | similar to breakouts | 0–4, average about 2 |
| Way past potential | a breakout that ends more than 5 above his old potential | — | about once every season or two | 6 in 22 seasons (about once every 3–4): a little rarer than the target |

- One lasting change per player per season. A big breakout or bust also cools his form.
- When a breakout passes a player's potential, potential rises to match, so offseason growth doesn't pull him back.
- Profile note format: "Breakout: +7 power, +6 eye (Jun 12)", "Prospect bust: −8 contact, −9 power, potential 60 → 53 (Apr 20)". Older seasons show the year.
- Offseason growth already nudges ratings by a season's results against ratings; a player with a lasting change that season gets no nudge, so the same results don't count twice.
- Changing potential also changes trade values for players 25 and under. The CPU draft is unaffected (draft prospects are created during the offseason).
- Built so the later W5b growth model can take these over: every change goes through `BB.form.lastingChange` and leaves a note.

**Balance** (Claude's default: the form effect averages out, so balance targets don't move)
- Runs per team-game with form: 4.40–4.66 across the test seasons, against 4.49–4.60 for the same seeds without form (about +0.02). simtest runs exhibition games only, so it can't move (4.63).
- The season's top starter needed the pace guard (see "Bullpen workload").
- Old saves load with neutral form and no notes, then work as normal from the next game.

