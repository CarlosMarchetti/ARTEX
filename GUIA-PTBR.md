# ARTEX PT-BR — uso e testes

Este fork adapta o ARTEX para uma interface em português e um fluxo guiado de pentest e bug bounty. A versão modificada preserva os créditos e a licença AGPL-3.0 do projeto original.

## Windows: pacote pronto

1. Extraia o pacote inteiro em uma pasta de sua preferência.
2. Abra **INICIAR.cmd**. O iniciador cria um banco PostgreSQL exclusivo para este ARTEX e abre o console em **http://127.0.0.1:8787**.
3. No primeiro acesso, defina uma senha. Não há senha padrão.
4. Em **Primeiros passos → Configurar minha IA**, crie um perfil, escolha o provedor e informe a chave.
5. Use **Buscar modelos**, selecione o ID e clique em **Testar compatibilidade com ferramentas**. Salve e ative o perfil.
6. Escolha **Novo teste guiado** e informe programa, ativos permitidos, exclusões, regras e duração.

Para encerrar, pause os testes em andamento e abra **PARAR.cmd**. O encerramento preserva dados e configurações. No Windows nativo, o processo do backend é encerrado pelo iniciador de parada; pause as tarefas antes para evitar interrupções de chamadas em andamento.

O pacote inclui o PostgreSQL, sem precisar instalar um serviço nem alterar sua instalação existente. Usa a porta **55438**, usuário e banco `artex_local`, com uma senha aleatória gerada em `runtime/database.json`. A interface e o proxy ficam acessíveis apenas nesta máquina. Mantenha a pasta `runtime` privada: ela contém dados, configurações e credenciais locais.

Se estiver executando a partir do código-fonte, coloque `artex.exe` compilado com `-tags embedui` na raiz e instale PostgreSQL ou defina `ARTEX_POSTGRES_HOME`. O iniciador procura primeiro `vendor/postgresql` e depois instalações registradas do PostgreSQL.

## Primeiro teste: laboratório incluído

Abra **TESTAR-LABORATORIO.cmd**. Isso disponibiliza um site demonstrativo em **http://127.0.0.1:8790**, somente na sua máquina. O site permite verificar conexão, cabeçalhos e o fluxo de relatório; não é um catálogo de vulnerabilidades exploráveis.

No teste guiado:

- Programa: `Laboratório local`.
- Ativos permitidos: `http://127.0.0.1:8790`.
- Duração: `1` minuto para começar.
- Restrições: `Apenas acessar a página e /status, observar cabeçalhos e produzir um resumo. Não explorar nem alterar dados.`

Para testar seu próprio site, substitua o ativo pelo domínio ou URL autorizado e copie as regras aplicáveis ao ambiente. Um domínio exato não autoriza seus subdomínios. `*.example.com` autoriza subdomínios, mas não o domínio raiz. URLs são regras exatas; inclua explicitamente os endpoints necessários. Exclusões têm prioridade. O cadastro de ativos e o planejamento usam essas regras; ferramentas de terminal podem abrir conexões diretas, portanto elas não equivalem a um firewall ou sandbox.

## Kafox e outros provedores

A configuração Kafox preenche `https://api.kafox.dev/v1`, formato **OpenAI Chat Completions** e modelo `kafox-free`. A chave é informada no console e nunca é incluída no código-fonte ou no pacote.

Use o **ID completo** retornado pelo provedor, incluindo `(free)` ou `:free`. O filtro de gratuitos reconhece esses sufixos e os aliases conhecidos; não consulta nem garante preços em tempo real. Verifique a cota e o preço no painel do serviço.

O teste inicial de integração deste fork confirmou chamadas de ferramentas com `kafox-free` e `openai/gpt-oss-120b (free)`. Isso verifica o protocolo, não garante a qualidade de análise nem a disponibilidade futura desses modelos. O serviço retornou limite temporário para outra opção gratuita durante a verificação.

Também há opções de configuração para OpenRouter, Gemini, Groq, Ollama, LM Studio, OpenAI, Anthropic e endpoints personalizados. A compatibilidade depende de o modelo aceitar chamadas de ferramentas no protocolo escolhido. Serviços que só oferecem chat pelo navegador precisam de uma integração específica.

As opções prontas usam limites iniciais conservadores de requisições; ajuste-os para a sua conta. A troca de perfis não aumenta a cota gratuita de um serviço. Não configure um modelo pago como alternativa se quiser manter o uso exclusivamente gratuito.

No Windows nativo, `Bash` usa PowerShell; no Docker, usa Bash. Ferramentas adicionais, como Nmap ou ferramentas de navegador, precisam estar instaladas no ambiente correspondente. O pacote Windows não promete incluir toda ferramenta externa; o Dockerfile inclui o conjunto Linux do projeto.

## Docker: construir sua versão

Com Docker em execução, use `./iniciar.sh` no Linux/macOS ou `./iniciar.ps1` no PowerShell. O Compose constrói a imagem a partir deste fork, em vez de baixar uma versão de outro mantenedor. O primeiro build exige conexão à internet.

```sh
docker compose up --build -d
docker compose logs -f artex
docker compose stop
```

Para acessar um Ollama/LM Studio instalado no host a partir do Docker, use `host.docker.internal` em vez de `localhost`.

## Compilar a partir do código

Requisitos: Node.js 22+, Go conforme `go.mod` e PostgreSQL 16+.

```sh
cd web
npm ci --ignore-scripts
npm run build:static
cd ..
```

Copie o conteúdo de `web/out` para `server/webui/dist` e compile:

```sh
go build -tags embedui -trimpath -ldflags "-X main.version=ptbr-1.0.0" -o artex ./cmd/artex
```

No Windows, use `-o artex.exe`. As atualizações automáticas apontam para este fork; sem uma release publicada, atualize pelo código/pacote, sem instalar binários do upstream por cima desta adaptação.

## Dados e limites

Relatórios, botões, navegação e erros internos traduzidos usam português. Evidências originais, mensagens externas e identificadores de API são preservados. Modelos de IA recebem instruções para responder em PT-BR; isso não é uma garantia de idioma em todo conteúdo gerado pelo provedor.

O fork não garante encontrar vulnerabilidades nem pagamentos de bug bounty. Revise reprodução, impacto e evidências antes de enviar um achado. Nenhum alvo externo é testado automaticamente durante a instalação.
