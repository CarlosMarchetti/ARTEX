param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$runtimeRoot = Join-Path $projectRoot 'runtime'
$binaryPath = Join-Path $projectRoot 'artex.exe'
$url = 'http://127.0.0.1:8787'
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

function Wait-Console {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try { $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2; if ($health.version -like 'ptbr-*') { return $true } } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

$statePath = Join-Path $runtimeRoot 'process.json'
if (Test-Path -LiteralPath $statePath) {
    $instance = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $instanceProcess = Get-Process -Id $instance.processId -ErrorAction SilentlyContinue
    if ($instanceProcess -and $instanceProcess.Path -eq $binaryPath) {
        if (-not (Wait-Console)) { throw 'O processo existe, mas o console não respondeu. Consulte runtime/backend.log.' }
        Write-Host "ARTEX já está em execução: $url"
        if (-not $NoBrowser) { Start-Process $url }
        return
    }
}

if (-not (Test-Path -LiteralPath $binaryPath)) {
    throw 'artex.exe não encontrado. Use o pacote Windows pronto ou compile o backend com a interface embutida, conforme o README.'
}

foreach ($port in @(8787, 8788)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "A porta $port já está em uso por outro processo. Pare a outra instância antes de iniciar esta pasta."
    }
}

$pgCandidates = @((Join-Path $projectRoot 'vendor/postgresql'))
if ($env:ARTEX_POSTGRES_HOME) { $pgCandidates += $env:ARTEX_POSTGRES_HOME }
foreach ($registryRoot in @('HKLM:\SOFTWARE\PostgreSQL\Installations', 'HKLM:\SOFTWARE\WOW6432Node\PostgreSQL\Installations')) {
    if (Test-Path $registryRoot) {
        foreach ($installation in (Get-ChildItem $registryRoot)) {
            $configuration = Get-ItemProperty $installation.PSPath
            if ($configuration.'Base Directory') { $pgCandidates += $configuration.'Base Directory' }
        }
    }
}
$pgHome = $pgCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'bin/initdb.exe') } | Select-Object -First 1
if (-not $pgHome) { throw 'PostgreSQL não encontrado. Use o pacote com banco incluído, defina ARTEX_POSTGRES_HOME ou utilize iniciar.ps1 para Docker.' }
$pgBin = Join-Path $pgHome 'bin'
$databaseData = Join-Path $runtimeRoot 'postgres-data'
$configPath = Join-Path $runtimeRoot 'database.json'
if (-not (Test-Path -LiteralPath $configPath)) {
    $randomBytes = New-Object byte[] 32
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $randomGenerator.GetBytes($randomBytes)
    $randomGenerator.Dispose()
    $databaseSecret = -join ($randomBytes | ForEach-Object { $_.ToString('x2') })
    @{password=$databaseSecret; port=55438; user='artex_local'; database='artex_local'} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding ascii
}
$database = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if (-not (Test-Path -LiteralPath (Join-Path $databaseData 'PG_VERSION'))) {
    $passwordPath = Join-Path $runtimeRoot 'init-password.tmp'
    [IO.File]::WriteAllText($passwordPath, $database.password, [Text.Encoding]::ASCII)
    try {
        & (Join-Path $pgBin 'initdb.exe') -D $databaseData -U $database.user --pwfile $passwordPath --auth-host=scram-sha-256 --auth-local=trust --encoding=UTF8 --locale=C *> (Join-Path $runtimeRoot 'postgres-init.log')
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar o banco local. Consulte runtime/postgres-init.log.' }
    } finally { if (Test-Path -LiteralPath $passwordPath) { Remove-Item -LiteralPath $passwordPath } }
}
& (Join-Path $pgBin 'pg_ctl.exe') -D $databaseData status *> $null
if ($LASTEXITCODE -ne 0) {
    $pgLog = Join-Path $runtimeRoot 'postgres.log'
    $pgStart = Start-Process -FilePath (Join-Path $pgBin 'pg_ctl.exe') -ArgumentList @('-D', ('"' + $databaseData + '"'), '-l', ('"' + $pgLog + '"'), '-o', ('"-p ' + $database.port + ' -h 127.0.0.1"'), '-w', 'start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeRoot 'postgres-start.log') -RedirectStandardError (Join-Path $runtimeRoot 'postgres-start-error.log')
    # Wait for pg_ctl itself; Start-Process -Wait waits for its long-lived
    # postgres descendants too, which would keep the launcher stuck forever.
    if (-not $pgStart.WaitForExit(60000)) { throw 'O banco demorou mais de 60 segundos para iniciar.' }
    $pgStart.Refresh()
    if ($pgStart.ExitCode -ne 0) { throw 'Falha ao iniciar o banco. Consulte runtime/postgres.log e verifique a porta 55438.' }
}
$savedPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $database.password
    $exists = & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p $database.port -U $database.user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='artex_local'"
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível conectar ao banco local.' }
    if (($exists -join '').Trim() -ne '1') {
        & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $database.port -U $database.user artex_local
        if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o banco artex_local.' }
    }
} finally { $env:PGPASSWORD = $savedPassword }

$previousDSN = $env:ARTEX_PG_DSN
$previousSkills = $env:ARTEX_SKILL_DIR
try {
    $env:ARTEX_PG_DSN = "postgres://$($database.user):$($database.password)@127.0.0.1:$($database.port)/artex_local?sslmode=disable"
    $env:ARTEX_SKILL_DIR = Join-Path $projectRoot 'skills'
    $backend = Start-Process -FilePath $binaryPath -ArgumentList @('-addr', '127.0.0.1:8787', '-proxy', '127.0.0.1:8788', '-data', ('"' + (Join-Path $runtimeRoot 'data') + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'stdout.log') -RedirectStandardError (Join-Path $runtimeRoot 'backend.log') -PassThru
    @{processId=$backend.Id; binary=$binaryPath; postgresHome=$pgHome} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
} finally { $env:ARTEX_PG_DSN = $previousDSN; $env:ARTEX_SKILL_DIR = $previousSkills }
if (-not (Wait-Console)) { throw 'O console não iniciou. Consulte runtime/backend.log. Se a porta 8787 estiver ocupada, pare o outro serviço.' }
Write-Host "ARTEX pronto: $url" -ForegroundColor Green
Write-Host 'No primeiro acesso, crie a senha do console. Depois configure sua IA e use Novo teste guiado.'
Write-Host 'Para encerrar, use PARAR.cmd. Os dados ficam preservados em runtime.'
if (-not $NoBrowser) { Start-Process $url }
