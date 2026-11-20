@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0iniciar-laboratorio.ps1"
echo No ARTEX, use Novo teste guiado e informe http://127.0.0.1:8790 como ativo permitido.
pause
