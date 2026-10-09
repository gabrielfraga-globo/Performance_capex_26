@echo off
rem Igual ao atualizar.cmd e, se a conferência passar, faz commit dos dados (public/data) e git push.
rem Use quando a Vercel estiver ligada ao repositório do GitHub (deploy automático a cada push).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\atualizar-dados.ps1" -Build -Publicar %*
echo.
pause
