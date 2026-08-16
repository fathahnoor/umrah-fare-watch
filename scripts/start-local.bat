@echo off
rem ============================================================
rem  Umrah Fare Watch - Start
rem  One-click: run the web app at http://localhost:3000
rem  The server runs in its own window; close that window or run
rem  the "Hentikan" script to stop it.
rem ============================================================
setlocal
title Umrah Fare Watch - Start

set "PROJECT=C:\DevPath\260809_umrah-fare-watch"
set "PORT=3000"
set "SERVER_TITLE=Umrah Fare Watch - Server"

cd /d "%PROJECT%" || (
    echo Project folder tidak ditemukan: %PROJECT%
    echo Ubah baris "set PROJECT=..." di script ini jika path berbeda.
    pause
    exit /b 1
)

rem --- Check Node.js ---
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js tidak ditemukan. Install dari https://nodejs.org lalu coba lagi.
    pause
    exit /b 1
)

rem --- Install dependencies on first run ---
if not exist "node_modules" (
    echo Menginstall dependencies untuk pertama kali...
    call npm install
    if errorlevel 1 (
        echo Gagal menginstall dependencies.
        pause
        exit /b 1
    )
)

rem --- Build if the production bundle is missing ---
if not exist "dist\api\server.js" (
    echo Membangun aplikasi untuk pertama kali...
    call npm run build
    if errorlevel 1 (
        echo Build gagal.
        pause
        exit /b 1
    )
)

rem --- Already running? Just open the browser ---
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if not errorlevel 1 (
    echo Aplikasi sudah berjalan di http://localhost:%PORT%
    start "" "http://localhost:%PORT%"
    exit /b 0
)

rem --- Start the server in its own console window ---
echo Menjalankan server di http://localhost:%PORT% ...
start "%SERVER_TITLE%" cmd /k "npm start"

rem --- Wait until the port is listening ---
set /a tries=0
:waitloop
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if not errorlevel 1 goto up
set /a tries+=1
if %tries% geq 60 goto timeout
timeout /t 1 /nobreak >nul
goto waitloop

:up
rem --- Save the server PID so the stop script can kill it ---
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do set "SERVER_PID=%%p"
if defined SERVER_PID echo %SERVER_PID%> "%PROJECT%\.server.pid"
echo Server siap! Membuka browser...
start "" "http://localhost:%PORT%"
timeout /t 3 /nobreak >nul
exit /b 0

:timeout
echo Server tidak merespon dalam 60 detik. Cek jendela server untuk error.
pause
exit /b 1
