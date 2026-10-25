@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Veille Ondes

if exist ".venv\Scripts\python.exe" goto lancer

echo Premiere utilisation : installation (une minute environ)...
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 -m venv .venv
) else (
    python -m venv .venv
)
if not exist ".venv\Scripts\python.exe" goto erreur
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto erreur

:lancer
".venv\Scripts\python.exe" -m veille_ondes
if errorlevel 1 pause
exit /b

:erreur
echo.
echo Python 3.10 ou plus recent est necessaire.
echo Installez-le depuis https://www.python.org/downloads/
echo en cochant la case "Add python.exe to PATH", puis relancez ce fichier.
pause
