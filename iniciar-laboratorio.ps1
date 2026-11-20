$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'laboratorio.ps1'
try { $existing = Invoke-WebRequest -Uri 'http://127.0.0.1:8790/status' -UseBasicParsing -TimeoutSec 2 } catch { $existing = $null }
if (-not $existing) {
    Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-File', ('"' + $scriptPath + '"')) -WindowStyle Hidden
    Start-Sleep -Seconds 1
}
Start-Process 'http://127.0.0.1:8790'
Write-Host 'No ARTEX, use Novo teste guiado e informe http://127.0.0.1:8790 como ativo permitido.'
