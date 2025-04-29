@echo off
setlocal enabledelayedexpansion

if "%~1" == "" (
    echo Viewing all server logs in real-time. Press Ctrl+C to exit.
    powershell -command "Get-Content -Path server_log.txt -Wait"
) else (
    echo Viewing server logs filtered by keyword: %~1. Press Ctrl+C to exit.
    powershell -command "Get-Content -Path server_log.txt -Wait | Select-String -Pattern '%~1'"
)
endlocal 