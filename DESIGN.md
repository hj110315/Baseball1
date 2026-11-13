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
