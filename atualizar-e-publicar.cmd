@echo off
rem Igual ao atualizar.cmd e, se a conferência com o modelo passar, publica na Vercel (vercel --prod).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\atualizar-dados.ps1" -Build -Publicar -VercelCli %*
echo.
pause
