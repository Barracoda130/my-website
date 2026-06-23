@echo off
setlocal

rem Start both development servers from the project root.
rem Backend:  Django REST API on http://localhost:8000
rem Frontend: Vite React app on http://localhost:5173

echo Starting backend and frontend development servers...

start "Backend - Django" cmd /k cd /d "%~dp0backend" ^&^& python manage.py runserver
start "Frontend - Vite" cmd /k cd /d "%~dp0frontend" ^&^& npm run dev

echo.
echo Backend should be available at:  http://localhost:8000
echo Frontend should be available at: http://localhost:5173
echo.
echo Two terminal windows have been opened. Close those windows or press Ctrl+C in each one to stop the servers.

endlocal