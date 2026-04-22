@echo off
REM MindPulse Start Script - Double-click to run both servers

echo Starting MindPulse Backend...
start /b python -m uvicorn app.main:app --host 0.0.0.0 --port 5000

timeout /t 5 /nobreak >nul

echo Starting MindPulse Frontend...
start /b npm run dev

echo.
echo ======================================
echo MindPulse is running!
echo   Backend: http://localhost:5000
echo   Frontend: http://localhost:3000
echo ======================================
echo.
echo Press Ctrl+C to stop servers
pause