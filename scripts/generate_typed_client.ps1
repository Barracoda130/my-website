$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location "$repoRoot"

./scripts/generate_openapi.ps1
Set-Location "$repoRoot/frontend"

npx openapi-typescript ../backend/openapi.yaml --output src/api/generated/schema.ts
Write-Host "Typed client schema written to frontend/src/api/generated/schema.ts"
