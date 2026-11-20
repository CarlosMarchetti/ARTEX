# Validação da versão PT-BR

Verificações executadas em 20/11/2026 no Windows.

- TypeScript: `tsc --noEmit` sem erros.
- Build estático Next.js: 32 páginas geradas, incluindo Primeiros passos.
- Auditoria npm após atualização compatível e correção de dependência transitiva: zero vulnerabilidades conhecidas.
- Testes direcionados em PostgreSQL exclusivo e limpo: aprovados em `bounty`, `localize`, `report`, `agent`, `db`, `evidence` e `server`.
- Comportamentos cobertos: validação de escopo, exclusões prioritárias, correspondência de subdomínios, integração de ferramentas, mensagens em português, preservação de evidências e exportação, armazenamento no Windows, contexto de escopo do planejador e rotas afetadas pela tradução.
- Executável Windows amd64 com frontend embutido: compilado e iniciado.
- Iniciadores locais: configuração do banco, parada e reinício verificados.
- HTTP: console e rotas de login, configuração, primeiros passos, provedores e tarefas retornaram 200. `/api/health` informou `ptbr-1.0.0`.
- Laboratório local: `/status` respondeu `ok`.
- Kafox: verificação real da API listou 126 modelos, 25 com IDs gratuitos; `kafox-free` e `openai/gpt-oss-120b (free)` retornaram chamadas de ferramentas válidas. Outra opção gratuita respondeu HTTP 429. Nenhum pentest externo foi executado.

Comando de regressão usado com um banco isolado:

```sh
go test -p 1 -timeout 90s ./bounty ./localize ./report ./agent ./db ./evidence ./server \
  -run 'Test(Policy|BuiltIn|Catalog|Portuguese|ToolConnection|GraphOverviewExpandsAssociatedCompanyScope|DomainSuffix|Bounty|Evidence|InterceptDetailHTTP|UploadSkillEncrypted|TaskCategoryBatchRoute|WorkerControlRoutes|NotifyChannelAPICreateValidation)' \
  -count=1
```

A suíte ampla herdada também foi executada e não ficou integralmente verde no Windows: apresentou falhas de isolamento/estado compartilhado entre testes e de limpeza de processos temporários. As verificações acima não devem ser interpretadas como aprovação de toda a suíte original. As falhas encontradas no caminho de evidências do Windows e nas expectativas de mensagens traduzidas foram corrigidas e verificadas nos testes direcionados.

O build Docker foi validado quanto à configuração do Compose, mas não foi executado nesta máquina porque o mecanismo Docker estava parado. A versão efetivamente iniciada e testada foi a Windows nativa. A prévia por automação de navegador não estava disponível nesta sessão; a entrega foi verificada por compilação, testes e respostas HTTP, sem alegar uma revisão visual completa.

O modelo de IA e as ferramentas externas determinam a cobertura prática. O teste de compatibilidade verifica uma chamada estruturada e não certifica a qualidade de um modelo em todas as tarefas. Escopo de ativos e instruções não substituem isolamento de rede para comandos de terminal.
