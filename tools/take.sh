#!/bin/bash
# take.sh <name>: move a picture just saved from AI Studio (Downloads/<name>.png, really a JPEG) into art/ as a true PNG, and make a small copy to look at
n="$1"; sleep 2
sips -s format png ~/Downloads/$n.png --out ~/comic-game/art/$n.png >/dev/null && rm ~/Downloads/$n.png
sips -Z 900 ~/comic-game/art/$n.png --out "/private/tmp/claude-501/-Users-marketing/e6df1947-2271-4b04-950d-45b771be83dd/scratchpad/v.png" >/dev/null; echo ok
