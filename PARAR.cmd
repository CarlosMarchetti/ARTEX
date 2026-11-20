@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0parar-local.ps1"
pause
