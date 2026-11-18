# Signature Required

A comic-book game that plays in the browser. The page is bigger than the screen; the camera moves from frame to frame, story frames are read by tapping, action frames are played, and a good punch can knock someone into the next frame.

Issue #1, "Signature Required": Milo, a night courier, has until midnight to get a locked case to Pier 27.

## Run it

Double-click `start.command`, or:

    python3 -m http.server 8777 --bind 127.0.0.1

then open http://127.0.0.1:8777/. The level map is at `/storyboard.html`.

Keys: arrows or A/D to move, Space to jump, J or X to punch, Enter or tap to continue, R to restart.
Add `?page=3` to start on a page.

## Layout

- `src/level1.js` - the level map: every page and frame, its shot, lettering and teaser
- `src/main.js` - the game: camera, story frames, action frames, fights, page turns
- `src/art.js` - layers, stand-in scenery, art loading
- `src/puppet.js` - characters and pose-sheet slicing
- `src/letters.js` - balloons, captions and bursts
- `art/` - artwork and `manifest.json`, which says which frame uses which picture
- `vendor/` - three.js 0.160 (MIT licence)

Most frames still use stand-in art.
