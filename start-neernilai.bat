@echo off
title NeerNilai Launcher
cd /d "%~dp0"
set PORT=8000
set SERVERCMD=

where python >nul 2>nul && set SERVERCMD=python -m http.server %PORT%
if not defined SERVERCMD where py >nul 2>nul && set SERVERCMD=py -m http.server %PORT%
if not defined SERVERCMD where npx >nul 2>nul && set SERVERCMD=npx serve -l %PORT%

if not defined SERVERCMD (
    echo.
    echo Could not find Python or Node.js.
    echo Install Python from https://www.python.org/downloads/ and tick "Add to PATH",
    echo or use VS Code Live Server instead.
    echo.
    pause
    exit /b 1
)

echo Starting NeerNilai server on http://localhost:%PORT% ...
start "NeerNilai Server - close this window to stop" /min cmd /c %SERVERCMD%

timeout /t 3 /nobreak >nul

start "" "http://localhost:%PORT%/simulator.html"
start "" "http://localhost:%PORT%/index.html"

echo.
echo NeerNilai is running.
echo   Simulator : http://localhost:%PORT%/simulator.html  (click START SIMULATOR)
echo   Dashboard : http://localhost:%PORT%/index.html
echo   Admin     : http://localhost:%PORT%/admin.html
echo.
echo To stop: close the minimized "NeerNilai Server" window.
echo.
pause
