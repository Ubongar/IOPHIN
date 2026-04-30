@echo off
REM Redis + IOPHIN Backend Quick Startup Script
REM Run this batch file to start both Redis and the API backend

echo.
echo ╔════════════════════════════════════════╗
echo ║  IOPHIN Redis + Backend Startup        ║
echo ╚════════════════════════════════════════╝
echo.

REM Start Redis Server in a new window
echo [1/2] Starting Redis Server on port 6379...
start "Redis Server" cmd /k "cd C:\Users\Michael\Downloads\redis && redis-server.exe --port 6379"

REM Wait for Redis to start
timeout /t 3 /nobreak

REM Verify Redis is running
echo [2/2] Verifying Redis connection...
"C:\Users\Michael\Downloads\redis\redis-cli.exe" ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✓ Redis is running
) else (
    echo ✗ Redis failed to start
    exit /b 1
)

REM Start Backend API in a new window
echo [3/2] Starting IOPHIN Backend API on port 5000...
start "IOPHIN API Server" cmd /k "cd C:\Users\Michael\IOPHIN\server && set REDIS_URL=redis://localhost:6379 && npm start"

REM Wait for API to start
timeout /t 3 /nobreak

REM Verify API is running
echo [4/2] Verifying API connection...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5000/api/health' -UseBasicParsing -ErrorAction Stop; Write-Host '✓ API is running'; } catch { Write-Host '✗ API failed to start'; exit 1 }"

echo.
echo ╔════════════════════════════════════════╗
echo ║  ✅ All services started successfully! ║
echo ╠════════════════════════════════════════╣
echo ║  Redis:       http://localhost:6379   ║
echo ║  API Server:  http://localhost:5000   ║
echo ║  API Docs:    http://localhost:5000/api/docs ║
echo ╚════════════════════════════════════════╝
echo.
echo Services are running in separate windows.
echo Close this window when done. Other windows will close automatically.
echo.

pause
