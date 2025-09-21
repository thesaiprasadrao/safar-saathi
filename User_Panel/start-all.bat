@echo off
echo Starting Safar Saathi System...
echo.

echo Starting User Backend (Port 5000)...
start "User Backend" cmd /k "cd backend && npm install && npm run dev"

echo Starting Driver Backend (Port 5001)...
start "Driver Backend" cmd /k "cd ..\Driver_Panel\backend && npm install && npm run dev"

echo Waiting for backends to start...
timeout /t 5 /nobreak > nul

echo Starting User Panel (Port 3000)...
start "User Panel" cmd /k "cd frontend && npm run dev"

echo Starting Driver Panel (Port 3001)...
start "Driver Panel" cmd /k "cd ..\Driver_Panel\frontend && npm run dev"

echo.
echo All services starting...
echo - User Backend: http://localhost:5000
echo - Driver Backend: http://localhost:5001
echo - User Panel: http://localhost:3000
echo - Driver Panel: http://localhost:3001
echo.
echo Press any key to exit...
pause > nul
