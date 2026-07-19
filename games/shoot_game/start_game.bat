@echo off
title Wild West Duel - Webserver Starter
cd /d "%~dp0"

echo ===================================================
echo     Wild West Duel - Lokaler Server Starter
echo ===================================================
echo.

:: Check for Python
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Python wurde gefunden. Starte Webserver minimiert auf Port 8000...
    start /min "" python -m http.server 8000
    ping -n 2 127.0.0.1 >nul
    start msedge "http://localhost:8000/index.html?v=52"
    goto end
)

:: Check for Node.js / npx
where npx >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Node.js/npx wurde gefunden. Starte Webserver minimiert auf Port 8000...
    start /min "" npx http-server -p 8000
    ping -n 3 127.0.0.1 >nul
    start msedge "http://localhost:8000/index.html?v=52"
    goto end
)

echo.
echo [FEHLER] Weder Python noch Node.js/npx wurden gefunden!
echo Bitte installiere Python oder Node.js, um den lokalen Server zu starten.
echo Alternativ kannst du versuchen, die 'index.html' direkt mit Doppelklick zu oeffnen.
echo.
pause

:end
