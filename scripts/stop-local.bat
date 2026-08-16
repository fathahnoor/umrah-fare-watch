@echo off
rem ============================================================
rem  Umrah Fare Watch - Stop
rem  One-click: stop the server started by the "Mulai" script.
rem ============================================================
setlocal
title Umrah Fare Watch - Stop

set "PROJECT=C:\DevPath\260809_umrah-fare-watch"
set "PORT=3000"

echo Menghentikan Umrah Fare Watch...

rem --- 1. Close the server console window (kills the whole tree) ---
taskkill /FI "WINDOWTITLE eq Umrah Fare Watch - Server*" /T /F >nul 2>nul

rem --- 2. Fallback: kill whatever is listening on the port ---
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /PID %%p /T /F >nul 2>nul
)

rem --- 3. Clean up the saved PID file ---
if exist "%PROJECT%\.server.pid" del "%PROJECT%\.server.pid"

rem --- Report ---
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if errorlevel 1 (
    echo Server sudah dihentikan.
) else (
    echo Masih ada proses di port %PORT%. Tutup manual bila perlu.
)
pause
