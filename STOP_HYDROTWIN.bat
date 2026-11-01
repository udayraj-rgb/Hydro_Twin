@echo off
title Stop HydroTwin-PHM Services
color 0c
echo =====================================================================
echo    Stopping HydroTwin-PHM Backend and Frontend Services...
echo =====================================================================
echo.

taskkill /F /IM uvicorn.exe /T 2>nul
taskkill /F /FI "WINDOWTITLE eq HydroTwin-PHM Backend*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq HydroTwin-PHM Frontend*" /T 2>nul

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a 2>nul

echo.
echo All HydroTwin-PHM services have been shut down cleanly.
echo.
timeout /t 2 /nobreak >nul
