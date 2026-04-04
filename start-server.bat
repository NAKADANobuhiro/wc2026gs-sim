@echo off
cd /d "%~dp0"
echo Starting local server...
python -m http.server 8080
if errorlevel 1 npx serve -p 8080 .
pause
