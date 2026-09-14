$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 or newer first.' }
if (-not (Test-Path -LiteralPath 'node_modules/three')) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' } }
& node server.mjs --open
