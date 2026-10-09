@echo off
rem Atualiza os dados do painel a partir do Power BI Desktop aberto e gera o site (pasta dist).
rem Antes: abra o PBIP "[SM] Acompanhamento Mensal Caixa" no Power BI Desktop e clique em Atualizar.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\atualizar-dados.ps1" -Build %*
echo.
pause
