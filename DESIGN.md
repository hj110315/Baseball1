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
