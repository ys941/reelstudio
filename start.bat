@echo off
title ReelStudio  -  http://localhost:4490
cd /d "%~dp0"

echo ============================================================
echo                       R E E L S T U D I O
echo            Browser video editor  -  localhost:4490
echo ============================================================
echo.

REM --- Install dependencies on first run (or if node_modules is missing) ---
if not exist "node_modules" (
  echo [ReelStudio] Installing dependencies ^(first run, this can take a minute^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ReelStudio] npm install failed. Make sure Node.js 18+ is installed.
    pause
    exit /b 1
  )
)

echo [ReelStudio] Starting the dev server...
echo [ReelStudio] Your browser will open at http://localhost:4490 shortly.
echo [ReelStudio] Press Ctrl+C in this window to stop.
echo.

REM --- Open the browser a few seconds after the server boots ---
start "" /b cmd /c "timeout /t 6 >nul & start http://localhost:4490"

REM --- Run the dev server (blocks this window) ---
call npm run dev

pause
