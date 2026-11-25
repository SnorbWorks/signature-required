#!/bin/bash
# takenamed.sh: move every picture saved from Flow under a game name (sr_*.jpg or bg_*.jpg in Downloads) into art/ as a .png
cd "$(dirname "$0")/../art" || exit 1
for f in ~/Downloads/sr_*.jpg ~/Downloads/bg_*.jpg; do [ -f "$f" ] || continue
  n=$(basename "$f" .jpg)
  sips -s format png "$f" --out "$n.png" >/dev/null 2>&1 && rm "$f" && echo "$n $(sips -g pixelWidth -g pixelHeight "$n.png" | tail -2 | awk '{print $2}' | tr '\n' ' ')"
done
