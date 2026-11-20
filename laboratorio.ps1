# Harmless local website for checking reachability, headers and report flow.
# It contains no credentials, command execution, or external network requests.
$ErrorActionPreference = 'Stop'
$tcp = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 8790)
$tcp.Start()
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'runtime') | Out-Null
@{processId=$PID} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime/laboratorio.json') -Encoding utf8
try {
    while ($true) {
        $client = $tcp.AcceptTcpClient()
        $client.ReceiveTimeout = 5000
        try {
            $stream = $client.GetStream()
            $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
            $firstLine = $reader.ReadLine()
            do { $line = $reader.ReadLine() } while ($line)
            $html = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Laboratório ARTEX</title><body style="background:#101827;color:#e5edf8;font:18px system-ui;padding:60px"><h1>Laboratório local do ARTEX</h1><p>Site demonstrativo para verificar conexão, cabeçalhos HTTP e fluxo de relatório.</p><p>Este ambiente não representa um programa real de bug bounty.</p><a style="color:#65d9cc" href="/status">Verificar status</a></body></html>'
            if ($firstLine -match '^GET /status(?:[ ?])') { $html = '{"status":"ok","environment":"local-lab"}'; $contentType='application/json' } else { $contentType='text/html; charset=utf-8' }
            $payload = [Text.Encoding]::UTF8.GetBytes($html)
            $headers = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($payload.Length)`r`nConnection: close`r`nX-ARTEX-Lab: local`r`n`r`n")
            $stream.Write($headers,0,$headers.Length)
            $stream.Write($payload,0,$payload.Length)
            $stream.Flush()
        } catch {} finally { $client.Close() }
    }
} finally { $tcp.Stop() }
