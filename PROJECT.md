# Signature Required — project notes

Issue #1: **Last Run of the Night**. Status as of 2026-11-23.

- Play it: https://snorbworks.github.io/signature-required/
- Storyboard (every frame, its dialog and what the picture should show): https://snorbworks.github.io/signature-required/storyboard.html
- Phone preview (upright and sideways, side by side): https://snorbworks.github.io/signature-required/tools/phone.html

## What it is

A comic book you play. The page is bigger than the screen and seen at an angle. The camera frames one panel at a time; the rest of the page stays visible but soft. Some panels are **story frames** (an illustration with balloons, tap to continue) and some are **action frames** (you run, jump, fight or dodge inside the panel, then cross the gutter into the next one).

## The story in short

Milo was never meant to be a courier. His brother Danny, courier No. 7, vanished a year ago on a signature-required delivery to Pier 27. Milo rides Danny's route to find out why.

- **Prologue, one year ago (2 pages):** Milo's first clumsy delivery. Two thugs take the package ("package tax"). He finds Danny's last, unsigned slip.
- **Earlier tonight (1 page):** two ordinary deliveries. A prescription on Harlow Street (two corner thugs want a toll) and an envelope for the Anchor bar (a doorman he cannot beat).
- **Pages 1–7, 11:12 PM to midnight:** Dot sends him on one last signature job to Pier 27. Pickup, cross-town run, pier fights with Tommy and Slim, foreman Gage steals the case, chase through the yard and up Crane 4, the case is won back, delivery to Vera, and the clue: "COURIER No. 7 — SHIPPED".

Story rules that must not be broken:

- Milo is not a superhero. He wins by timing and improvising, and he can lose or run.
- Contemporary city. Not cyberpunk, not futuristic, no holograms.
- Dot knows more than she says. She is evasive, not a simple villain. Her silences are lettered ("..." balloons, "Dot doesn't answer.").
- Vera's link to Danny and the organisation stay unexplained.
- The reader sees the clerk shot; Milo never learns of it.
- The black van is a recurring thread. The ending is hope, not proof.
- Fights can end three ways (fought and won, got away, robbed). The next frame changes to match, but the story always goes the same direction.
- The motorcycle is background detail only. The game is on foot.

## Game rules built so far

- A delivery clock runs on each job. Early pays a bonus, late docks pay, a lost package pays nothing. Losing never ends the game.
- Pay is shown per delivery with a "Tonight $" total. No shop yet.
- Controls: arrows or A/D to move, Space to jump, J punch, K block, L dodge. Phones get on-screen buttons.

## How to run it at home

1. Download the repo from https://github.com/SnorbWorks/signature-required (green Code button, Download ZIP, or clone it).
2. In the folder, run `python3 -m http.server 8777 --bind 127.0.0.1` (or double-click `start.command` on a Mac).
3. Open http://127.0.0.1:8777/

No install or build step. Useful addresses: `?page=P1`, `P2`, `R`, or `1` to `7` starts on that page; `?frame=5.7` starts on one frame; `?auto=1` taps through story frames by itself.

## Where things are

| File | What it holds |
|---|---|
| `src/level0.js` | Prologue and "Earlier tonight" pages: every frame, picture description, dialog |
| `src/level1.js` | Pages 1–7, same format |
| `src/main.js` | The engine: page, camera, clock, pay, fights, the scripted scenes |
| `src/puppet.js` | Stand-in characters and the pose-sheet slicer |
| `src/art.js` | Stand-in scenery and the art loader |
| `art/manifest.json` | Which picture belongs to which frame or character |
| `art/` | All finished pictures |

Not in this repo: the full written script `Signature_Required_Issue_001_Revised_Storyboard.md` and the two style reference pictures `Rainy Harbor Showdown.png` and `Rainy Harbor Showdown_ Pow!.png`. They were in Downloads on the office computer until 2026-11-23 and are no longer there. Until they turn up, use finished art as the style sample (`art/p2_near.png`, `art/p2_far.png`, `art/sr_1_1.png`).

## Rules for making the images

**Tool:** Google AI Studio, free image model "Nano Banana 2 Lite". About 13 images a day; the limit resets roughly 24 hours after it is hit. One image takes about 30 seconds.

**The look, every image:**

- Match `Rainy Harbor Showdown.png`: gritty heavy black inks and hatching, grainy halftone print texture, deep night blues and purples with warm light, rain.
- Milo: serious angular face, lean older-teen build, hood down, spiky brown hair, yellow hooded jacket, black pants, red and white high-tops, white hand wraps, messenger bag. Never cute, rounded, smiling or grinning.
- Epic comic-book camera angles: low angles, strong foreshortening, tilted frames.
- Present-day city: brick blocks, fire escapes, water towers, ordinary cars and shop signs. Nothing futuristic.

**Story frame pictures:**

- Attach the style reference and `art/hero.png` at the start of a chat. For Tommy and Slim attach `art/thug.png` and `art/goon.png`.
- Start each prompt: "Same art style and the same hero Milo as before. Draw ONE single comic-book panel illustration that fills the whole image edge to edge. No panel border, no text, no captions, no speech balloons, no sound-effect lettering, no signature. SCENE: ..."
- Take the scene from the frame's `shot` line in `level0.js` / `level1.js` (or the storyboard page).
- No lettering in the picture. The game adds balloons. Signs that exist in the world (a pier number, a ledger line, the van's monitor text) are fine and come out readable if the exact wording is given.
- Pick the aspect ratio nearest the frame's shape (1:1, 3:2, 4:3, 5:4, 16:9, 21:9, 4:1, 8:1 and tall versions).
- Save as `art/sr_<page>_<frame>.png` and add it to `art/manifest.json` under `panels` as `"story": "file.png"` with a `"poi": [x, y]`: where the subject is, as fractions from the left and top. The phone camera uses it to keep the subject on screen.

**Character sheets:**

- One image, 16:9, eight full-body poses in 2 rows of 4, same scale, side view facing right, flat pure green (#00FF00) background, no text, no ground, no shadows.
- Top row: standing relaxed, fighting stance, walking left leg forward, walking right leg forward. Bottom row: straight punch, recoiling from a hit, knocked out flat on the back, winding up a big punch (for Milo: jumping).
- **Use a brand-new chat for each sheet.** In a long chat the model puts the previous character's clothes on the recoil and knocked-out poses. Attaching the faulty sheet and asking for a fix just copies the fault.
- In the new chat attach one good sheet (`art/gage.png`) as the layout to copy, describe the new character, and list what must not carry over ("no hard hat, no orange jacket, no hook").
- Check all eight poses are the same person in the same clothes before saving.
- Save as `art/<name>.png` and add it to `manifest.json` under `sprites` with `file`, `height` and the eight `frames` names.
- A walk cycle is a second sheet: 4 frames in 2 rows of 2, made in a fresh chat with only that character's sheet attached.

**Action frame backgrounds** (per playable frame). Scale matters most here: 1 game unit is half a metre, Milo is 3.5 units tall, a door should come out about 4.3 units tall, and feet must land on a painted surface.

- `near`: everything the characters touch (ground, platforms, doors, props), drawn flat-on like a stage set. If it is a wall or a room it fills the picture; if there is open sky, the sky is flat green and gets cut out.
- `far`: only needed behind a `near` with open sky (a distant skyline, no foreground).
- `teaser`: a frozen picture of that frame's action, shown whenever the frame is not the one being played.

How a `near` is made:

1. Add the frame to `SPECS` in `tools/guide.py` and run `python3 tools/guide.py tools/guides`. It writes a flat-colour blockout at the exact shape of the picture: floor, platforms, door, props, and a pink figure the height of a person.
2. New AI Studio chat. Attach the blockout first, then `art/p2_near.png` as the style sample. Set the aspect ratio the tool printed. Prompt: "Image 1 is a flat-colour BLOCKOUT ... drawn to exact scale ... This is a strict paint-over: every coloured block keeps exactly the same position, width and height ... perfectly flat-on, like a theatre stage set, no side walls, no vanishing-point perspective", then say what each colour is, and that the pink figure is only a ruler and must not be drawn.
3. Never attach an earlier attempt at the same scene as the style sample: the model just copies it.
4. The model still drifts: it moves props and draws doors a different size. So measure the finished picture and make the game fit it: set the platform positions in `GAME` in `src/main.js` from the picture, and in `art/manifest.json` set `zoom` (picture size; pick it so a door is about 4.3 units), `lift` (raise or lower the picture so feet meet the ground), and where needed `over` (parts drawn in front of the characters, like a counter), `erase` (parts left out), `patch` (copy clean paint over the tool's corner mark) and `indoor` (no rain).
5. Check in the game with `?page=...&plats=1`, which shows the platforms faintly over the picture.

More manifest settings added 2026-11-23: `props` on a background copies something already in the picture to another spot (used for the extra crates and dumpster in P0.4; the matching platforms are in `GAME`). On story frame 2.6, `clean` plus `cover` paints over the three drawn men with a piece of wall from beside them, so the game can walk three dark figures from the van to the door. Frame 2.7's window is kept dark by an overlay until the POP flashes.

A request to edit a finished picture ("make the door taller, cut a gap here") works about half the time and costs an image.

## What is done

- 13 story frame pictures: 1.1–1.5, 2.2, 2.5–2.8, 3.1, 3.3, 3.5 (1.1, 3.1 and 3.3 were redrawn on 2026-11-20).
- 10 character sheets: Milo, Tommy, Slim, the two package-tax thugs, the two corner thugs, the Anchor doorman, the shopkeeper, Gage. Milo, Tommy and Slim also have walk cycles.
- 2 freeze-frames (1.6, 4.1).
- Backgrounds for 9 playable frames: the first pier fights (4.1, 4.3, 4.4) and, made to scale on 2026-11-23, the whole opening: rooftops P0.2 (with a dusk skyline), shop P0.3, loading platform P0.4, alley P0.5, Harlow Street R.2, the Anchor's back lot R.5.

## Images left to create: about 100

| What | Count | Which |
|---|---|---|
| Story frame pictures | 30 | P0.1, P0.6, P0.7a–d, R.1, R.3 (3 versions), R.4, R.6 (2 versions), 4.2, 4.5–4.8, 5.1, 5.4–5.6, 6.2, 6.4, 6.7, 7.2–7.5, 7.8 |
| Freeze-frames for playable frames | 25 | P0.2–P0.5, R.2, R.5, 1.7, 2.1, 2.3, 2.4, 3.2, 3.4, 3.6, 4.3, 4.4, 5.2, 5.3, 5.7, 5.8, 6.1, 6.3, 6.5, 6.6, 7.1, 7.6 |
| Action backgrounds | 18 to 36 | 1.6, 1.7, 2.1, 2.3, 2.4, 3.2, 3.4, 3.6, 5.2, 5.3, 5.7, 5.8, 6.1, 6.3, 6.5, 6.6, 7.1, 7.6: one picture each, plus a skyline only where there is open sky and no existing one fits |
| Character sheets | 1 | Dock worker |
| Walk cycles | 8 | The seven new characters and the dock worker |

At about 13 a day that is roughly eight days; allow for retries (on 2026-11-23, 13 images gave 7 keepers). Mrs. Okafor, the clerk and Vera only appear in story frames, so they need no sheet; describe them the same way each time.

Suggested order: story frames first (they change the feel most), then freeze-frames, then backgrounds, then walk cycles.

## Known rough edges

- The two "Earlier tonight" deliveries and their dialog were written by the assistant and have not been reviewed.
- Fight difficulty and the clock's time allowances are untuned.
- Walk cycles are still missing for the package-tax thugs, the corner thugs and the doorman (they slide on one pose). Each needs one image.
- The clock frame (P0.4) was simplified to fit its picture: steps, a loading platform and a truck bay, no jump that saves time.
- The rooftop stairwell hut was left out of P0.2 because its door came out too small.
- Doors in the new backgrounds run a little tall (about 1.3 times Milo's height).
- Phone: on-screen BLOCK and DODGE buttons are untested by touch; hints still say "arrow keys".
- The screen-edge blur is new and has only been checked on a desktop.
- The README still describes an older, shorter version.
