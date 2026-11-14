# Diamond Dash: design notes

This summary comes from the design interview. Use it as the reference for later work. Items marked *(default)* were open questions in the interview. They have a sensible default for now and can be changed at any time.

## Core game
- A full mini baseball game: you bat and pitch against a CPU team.
- Before each game you pick **1, 3 or 9 innings**.
- It runs in the browser with no build step: open `index.html`. Hoop Frenzy (the Basketball1 repo) is the reference for the overall approach.

## Controls
- **Batting is timing only.** Tap, click or press Space to swing. Swinging **early** pulls the ball (left field for a right-handed batter) and swinging **late** sends it the opposite way. A perfectly timed swing gives the hardest contact. Pitches outside the zone are harder to hit well, so you can also choose to take a pitch.
- **Pitching:** pick a pitch type (fastball, curve or change-up), then tap where in the zone to throw it. Control isn't perfect, so the pitch lands near the spot you aimed at.
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

## Pitch types and bullpen
- **7 pitch types:** four-seam fastball, sinker, cutter, slider, curveball, change-up and splitter. Each one has its own speed, movement, effect on contact (for example, sinkers and splitters produce more ground balls), and how much it fools hitters after a pitch of a different speed.
- **Each pitcher throws 3–5 of them**, with their own velocity, control and stamina.
- **Bullpen:** each team has a starter and 4 relievers.
  - You can bring in a reliever between pitches while you're pitching (BULLPEN button, or `B`).
  - A pitcher who has been taken out can't come back.
  - The CPU makes a pitching change when its pitcher tires or is getting hit hard.
- **Fatigue:** once a pitcher passes their stamina, control gets worse and velocity drops. The HUD shows your pitcher's energy.

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
- **Spring training:** about 15 exhibition games before each season. Stats are kept separately and don't count. Young players can break out or slump a little. You set your 26-man Opening Day roster at the end (the CPU sets its own).
- **Rosters:** 26 active (13 position players, 5 starting pitchers, 8 relievers including a closer) plus a reserve squad for injuries and prospects.
- **Ratings** run 20–99, with a league average around 55. Hitters have Contact, Power, Eye, Speed, Fielding and Arm. Pitchers have Velocity, Control, Stamina and Stuff, plus their own pitch set.
- **Contracts and money** are kept simple: salaries in $M, years remaining, and a payroll budget per team.

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

## Releasing players (Nov 14, 2026)
- You can release any player in your organization from his profile: active roster, reserves, prospects or injured list. He becomes a free agent that any team can sign.
- Blocked during the draft, and blocked if it would leave fewer than 10 healthy position players or 11 healthy pitchers on the active roster (the same rule as sending a player down).
- You keep paying his salary until his contract would have ended (owner's choice), even if another team signs him. It shows under "Released players still being paid" on the Payroll screen, and counts toward your payroll and budget in every payroll total. Contracts count down at the offseason re-signing step, and the dead money drops off there when it reaches zero.
- The same rule applies when CPU teams release players under contract.

