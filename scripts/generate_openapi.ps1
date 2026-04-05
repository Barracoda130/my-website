$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location "$repoRoot/backend"

../.venv/Scripts/python.exe manage.py spectacular --file openapi.yaml --validate
Write-Host "OpenAPI schema written to backend/openapi.yaml"
