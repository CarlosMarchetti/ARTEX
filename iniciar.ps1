$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Instale o Docker Desktop e habilite os contêineres Linux antes de continuar.'
}
docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Abra o Docker Desktop e aguarde o mecanismo iniciar. Depois execute este script novamente.' }
if (-not (Test-Path -LiteralPath '.env')) {
    $randomBytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($randomBytes)
    $generator.Dispose()
    $databasePassword = -join ($randomBytes | ForEach-Object { $_.ToString('x2') })
    @("ARTEX_TAG=local", "POSTGRES_USER=artex", "POSTGRES_PASSWORD=$databasePassword", "POSTGRES_DB=artex", 'ANTHROPIC_API_KEY=', 'OPENAI_API_KEY=') | Set-Content -LiteralPath '.env' -Encoding ascii
    Write-Host 'Configuração local criada. A senha do banco foi gerada automaticamente.'
}
Write-Host 'Construindo e iniciando sua versão do ARTEX. O primeiro build pode levar alguns minutos.'
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível iniciar. Consulte: docker compose logs --tail 100' }
Write-Host 'Acesse http://localhost:8787. Crie a senha de acesso e siga os Primeiros passos.'
Write-Host 'Para parar: docker compose stop. Para acompanhar: docker compose logs -f artex'
