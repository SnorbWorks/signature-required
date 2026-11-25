#!/bin/bash
# takeflow.sh <name>: move the newest picture downloaded from Flow (a .jpg in Downloads) into art/ as <name>.png and make a small copy to look at
n="$1"; f=$(ls -t ~/Downloads/*.jp*g 2>/dev/null | head -1); [ -z "$f" ] && { echo "nothing downloaded"; exit 1; }
sips -s format png "$f" --out ~/comic-game/art/$n.png >/dev/null && rm "$f"
sips -g pixelWidth -g pixelHeight ~/comic-game/art/$n.png | tail -2
sips -Z 1400 ~/comic-game/art/$n.png --out "${2:-/tmp}/v.png" >/dev/null
