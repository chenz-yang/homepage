@echo off
cd /d "%~dp0"

:: Start server minimized in background
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start /min "" python -m http.server 8000
    exit
)

where npx >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start /min "" npx http-server -p 8000
    exit
)
