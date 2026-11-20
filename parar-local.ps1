$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$statePath = Join-Path $projectRoot 'runtime/process.json'
if (Test-Path -LiteralPath $statePath) {
    $instance = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $running = Get-Process -Id $instance.processId -ErrorAction SilentlyContinue
    $expectedBinary = Join-Path $projectRoot 'artex.exe'
    if ($running -and $running.Path -eq $expectedBinary) { Stop-Process -Id $running.Id }
    $pgControl = Join-Path $instance.postgresHome 'bin/pg_ctl.exe'
    $pgData = Join-Path $projectRoot 'runtime/postgres-data'
    if ((Test-Path -LiteralPath $pgControl) -and (Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION'))) {
        & $pgControl -D $pgData -m fast -w stop
    }
    $labState = Join-Path $projectRoot 'runtime/laboratorio.json'
    if (Test-Path -LiteralPath $labState) {
        $lab = Get-Content -LiteralPath $labState -Raw | ConvertFrom-Json
        $labProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($lab.processId)" -ErrorAction SilentlyContinue
        if ($labProcess -and $labProcess.CommandLine.Contains((Join-Path $projectRoot 'laboratorio.ps1'))) { Stop-Process -Id $lab.processId -ErrorAction SilentlyContinue }
    }
}
Write-Host 'ARTEX encerrado. Dados e configurações preservados.'
