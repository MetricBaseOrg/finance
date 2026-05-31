# Local launcher for the FieldFlow compute engine.
# Reads DB + token from ../.env.local so secrets stay out of the command line.
# The engine connects READ-ONLY via psycopg; use DIRECT_URL (no pgbouncer param).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"

$map = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*#') { continue }
  $i = $line.IndexOf('=')
  if ($i -lt 1) { continue }
  $k = $line.Substring(0, $i).Trim()
  $v = $line.Substring($i + 1).Trim().Trim('"')
  $map[$k] = $v
}

$dsn = $map['DIRECT_URL']
if (-not $dsn) { $dsn = $map['DATABASE_URL'] }
# psycopg/libpq rejects the pgbouncer query param — strip it if present.
# sslmode is preserved as-is (verify-full): the CA bundle is installed at
# %APPDATA%\postgresql\root.crt so libpq can verify Neon's certificate chain.
$dsn = $dsn -replace '([?&])pgbouncer=true&?', '$1'
$dsn = $dsn -replace '[?&]$', ''

$env:DATABASE_URL = $dsn
$env:FIELD_ENGINE_TOKEN = $map['FIELD_ENGINE_TOKEN']

Write-Output "Starting field-engine on http://127.0.0.1:5001 (token set: $([bool]$env:FIELD_ENGINE_TOKEN))"
& (Join-Path $PSScriptRoot ".venv\Scripts\python.exe") (Join-Path $PSScriptRoot "app.py")
