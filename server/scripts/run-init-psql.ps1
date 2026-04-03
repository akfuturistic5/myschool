# Run 001_init_full_schema.sql using psql (handles COPY ... FROM stdin).
# Requires: psql on PATH, PostgreSQL server running.
# Usage (from repo):  cd server; .\scripts\run-init-psql.ps1
# Override: $env:PGHOST='localhost'; $env:PGUSER='postgres'; $env:PGPASSWORD='...'

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Split-Path -Parent $here
$sqlPath = Join-Path $serverRoot 'migrations\001_init_full_schema.sql'
# Must match run-init-migration.js (avoid matching header comment text).
$marker = "`n-- ##############################################################################`n-- === TENANT_SCHEMA_BEGIN ===`n"

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error 'psql not found. Install PostgreSQL client tools or use: npm run db:init'
}

$full = Get-Content -Raw -Path $sqlPath
$idx = $full.IndexOf($marker)
if ($idx -lt 0) { Write-Error "Marker not found: $marker" }

$masterSql = $full.Substring(0, $idx).Trim()
$tenantSql = $full.Substring($idx + $marker.Length).Trim()

$masterDb = if ($env:MASTER_DB_NAME) { $env:MASTER_DB_NAME } else { 'master_db' }
$tenantDb = if ($env:TENANT_INIT_DB_NAME) { $env:TENANT_INIT_DB_NAME } elseif ($env:DB_NAME) { $env:DB_NAME } else { 'school_db' }

$tmpMaster = [System.IO.Path]::GetTempFileName() + '-master.sql'
$tmpTenant = [System.IO.Path]::GetTempFileName() + '-tenant.sql'
try {
  Set-Content -Path $tmpMaster -Value $masterSql -Encoding UTF8
  Set-Content -Path $tmpTenant -Value $tenantSql -Encoding UTF8

  Write-Host "Applying master part to database: $masterDb"
  psql -v ON_ERROR_STOP=1 -d $masterDb -f $tmpMaster
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "Applying tenant part to database: $tenantDb"
  psql -v ON_ERROR_STOP=1 -d $tenantDb -f $tmpTenant
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host 'Done.'
}
finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $tmpMaster, $tmpTenant
}
