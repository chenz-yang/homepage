@echo off
title Wild West Duel - Autostart Setup
cd /d "%~dp0"

echo.
echo ===================================================
echo     Wild West Duel - Autostart Setup
echo ===================================================
echo.
echo Dieses Skript sorgt dafuer, dass der lokale Spiel-Server
echo automatisch mit Windows startet.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut($env:APPDATA + '\Microsoft\Windows\Start Menu\Programs\Startup\WildWestDuelServer.lnk'); $Shortcut.TargetPath = '%~dp0start_server_only.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.WindowStyle = 7; $Shortcut.Save()"

if %ERRORLEVEL% equ 0 (
    echo [ERFOLG] Der Autostart wurde erfolgreich eingerichtet!
    echo Der Server wird ab dem naechsten Systemstart automatisch geladen.
) else (
    echo [FEHLER] Autostart konnte nicht eingerichtet werden.
)
echo.
pause
