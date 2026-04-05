$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot "backend"
$frontendPath = Join-Path $repoRoot "frontend"
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    throw "Python executable not found at $pythonExe. Create the virtual environment first."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found in PATH. Install Node.js and npm first."
}

$backendCommand = "Set-Location '$backendPath'; & '$pythonExe' manage.py runserver"
$frontendCommand = "Set-Location '$frontendPath'; npm run dev"

Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand | Out-Null
Start-Sleep -Seconds 1
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand | Out-Null

Write-Host "Started backend and frontend in separate PowerShell windows."
Write-Host "Backend:  http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
