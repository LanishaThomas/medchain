@echo off
REM Start MedChain Backend Server

cd /d "%~dp0backend"

echo.
echo ╔═══════════════════════════════════════════════════╗
echo ║        Starting MedChain Backend Server           ║
echo ╚═══════════════════════════════════════════════════╝
echo.

npm run dev

pause
