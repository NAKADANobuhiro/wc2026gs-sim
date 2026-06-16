@echo off
cd /d "%~dp0"
echo Starting local server on http://localhost:8080/ ...
python serve.py 8080
if errorlevel 1 (
    echo python not found. Falling back to uv run python...
    uv run python serve.py 8080
)
pause
