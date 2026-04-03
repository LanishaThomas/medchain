@echo off
REM Start MedChain Frontend Server

cd /d "%~dp0frontend"

echo.
echo ╔═══════════════════════════════════════════════════╗
echo ║        Starting MedChain Frontend Server          ║
echo ╚═══════════════════════════════════════════════════╝
echo.

npm run dev

pause
