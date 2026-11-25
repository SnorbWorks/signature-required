#!/bin/bash
# takemany.sh <name> <name> ...: the .jpg pictures in Downloads, oldest first, become art/<name>.png in the order given
i=0; ls -tr ~/Downloads/*.jp*g 2>/dev/null | while read -r f; do i=$((i+1)); n=$(eval echo \${$i}); [ -z "$n" ] && { echo "extra file left: $f"; continue; }
  sips -s format png "$f" --out ~/comic-game/art/$n.png >/dev/null && rm "$f" && echo "$n <- $(basename "$f")"; done
