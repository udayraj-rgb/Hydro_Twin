@echo off
setlocal enabledelayedexpansion
title HydroTwin-PHM Launcher
color 0b

echo =====================================================================
echo    HydroTwin-PHM: Digital Twin & Virtual HIL Full-Stack Testbed
echo    AtomQuest 2026 (Track 2: Water Purifier)
echo    Team Atomizers ^| SCOPE, VIT Bhopal University
echo =====================================================================
echo.

set ROOT_DIR=D:\Atomberg\hydrotwin_project
set BACKEND_DIR=%ROOT_DIR%\backend
set FRONTEND_DIR=%ROOT_DIR%\frontend
set VENV_UVICORN=%ROOT_DIR%\.venv\Scripts\uvicorn.exe

echo [1/3] Verifying Backend Environment...
if not exist "%VENV_UVICORN%" (
    echo [ERROR] Virtual environment not found at %ROOT_DIR%\.venv
    echo Please make sure the Python .venv exists.
    pause
    exit /b 1
)

echo [2/3] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "HydroTwin-PHM Backend (FastAPI)" cmd /k "cd /d %BACKEND_DIR% && %VENV_UVICORN% main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Launching React Frontend on http://localhost:3000 ...
start "HydroTwin-PHM Frontend (React)" cmd /k "cd /d %FRONTEND_DIR% && npm start"

echo.
echo =====================================================================
echo  HydroTwin-PHM is now active:
echo  - Backend API:    http://127.0.0.1:8000
echo  - Swagger Docs:   http://127.0.0.1:8000/docs
echo  - WebSocket:      ws://127.0.0.1:8000/ws/telemetry
echo  - Frontend React: http://localhost:3000
echo =====================================================================
echo.
echo Your browser will open automatically when React compilation completes.
echo To terminate all running background services, double-click STOP_HYDROTWIN.bat.
echo.
pause
