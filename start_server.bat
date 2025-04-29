@echo off
echo Starting server with logs redirected to server_log.txt...
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000 --log-level debug > server_log.txt 2>&1
echo Server is running. Logs are being written to server_log.txt
echo.
echo To view logs in real-time, open another PowerShell window and run:
echo powershell -command "Get-Content -Path server_log.txt -Wait"
pause 