@echo off
echo Starten des lokalen Webservers auf http://localhost:8000...
echo Druecken Sie Strg+C im Terminal, um den Server zu stoppen.
start msedge "http://localhost:8000"
python -m http.server 8000
