@echo off
echo Stopping containers...
docker-compose down

echo Building containers with new configuration...
docker-compose build

echo Starting containers...
docker-compose up -d

echo.
echo Containers have been rebuilt and restarted.
echo Frontend should be available at http://localhost:8888
echo Backend API should be available at http://localhost:8000
pause 