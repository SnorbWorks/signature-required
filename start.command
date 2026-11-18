#!/bin/sh
# Double-click to play. Starts a tiny local web server and opens the game.
cd "$(dirname "$0")"
PORT=8777
( sleep 1; open "http://127.0.0.1:$PORT/" ) &
exec python3 -m http.server $PORT --bind 127.0.0.1
