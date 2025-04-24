@echo off
echo Starting server...
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000 --no-access-log
pause 