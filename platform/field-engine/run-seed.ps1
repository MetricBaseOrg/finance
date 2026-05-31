# Seeds sample FieldFlow data into the org(s). Reads DSN from ../.env.local.
# Usage:  ./run-seed.ps1            # seed both orgs
#         $env:REMOVE=1; ./run-seed.ps1   # remove the sample data
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$map = @{}
foreach ($line in Get-Content (Join-Path $root ".env.local")) {
  if ($line -match '^\s*#') { continue }
  $i = $line.IndexOf('='); if ($i -lt 1) { continue }
  $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim().Trim('"')
}
$dsn = $map['DIRECT_URL']; if (-not $dsn) { $dsn = $map['DATABASE_URL'] }
$dsn = $dsn -replace '([?&])pgbouncer=true&?', '$1' -replace '[?&]$', ''
$env:PGDSN = $dsn
& (Join-Path $PSScriptRoot ".venv\Scripts\python.exe") (Join-Path $PSScriptRoot "_seed.py")
