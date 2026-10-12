
<div align="center">

 ARTEX

Sistema de Testes de Penetração Autônomo com IA (Backend em Go + Frontend em Next.js)

🌐 Demo Online (Dados Simulados): [https://artex-demo.mhtsec.com](https://artex-demo.mhtsec.com)

📦 Este repositório é um backup do código-fonte da última versão do ARTEX. A fonte original da imagem Docker `autumn27/artex` está inativa; agora utilizamos a imagem mantida por este repositório `mianhuatang11/artex` (Docker Hub). Caso a extração falhe, você pode executar `docker compose build` para construir localmente a partir do código-fonte, sem dependências externas pré-compiladas.

</div>

---

 Prévia de Capturas de Tela

> Para a interação completa, veja a [Demo Online](https://artex-demo.mhtsec.com) (apenas frontend + dados Mock, não requer backend).

| Dashboard (Visão Geral / Consumo de Tokens / Fluxo de Atividades) | Lista de Tarefas |
| :---: | :---: |
| ![Dashboard](screenshots/dashboard.png) | ![Tarefas](screenshots/tasks.png) |

| Tarefa · Processo de Execução (Sessões / Chamadas de Ferramentas) | Cadeia de Exploração |
| :---: | :---: |
| ![Execução](screenshots/sessions.png) | ![Exploração](screenshots/graph.png) |

| Descobertas | Ativos |
| :---: | :---: |
| ![Descobertas](screenshots/findings.png) | ![Ativos](screenshots/assets.png) |

| Mapa de Cobertura de Ativos (Layout Force-Directed · Testados em Destaque · Nós Expansíveis) |
| :---: |
| ![Cobertura](screenshots/assets_test.png) |

| Gravação de Tráfego | Chat Humano no Loop |
| :---: | :---: |
| ![Tráfego](screenshots/traffic.png) | ![Chat](screenshots/chat.png) |

| Gestão de Agent | Configuração de LLM |
| :---: | :---: |
| ![Agent](screenshots/agents.png) | ![LLM](screenshots/llm.png) |

| Aprovação de Interceptação | Logs do Backend |
| :---: | :---: |
| ![Interceptação](screenshots/intercept.png) | ![Logs](screenshots/logs.png) |

---

 Detalhes do Registro de Aprovação

O "Registro de Aprovação" global, a "Aprovação de Interceptação" dentro das tarefas e os cartões de aprovação nos chats suportam a expansão para visualização de detalhes. A estrutura de exibição segue o componente de detalhes de aprovação do AegisHook, utilizando os componentes e o tema do ARTEX.

 Sincronização de Ativos (ScopeSentry)

Suporta a sincronização direta de dados de ativos do [ScopeSentry](https://github.com/Autumn-27/ScopeSentry), evitando a coleta repetitiva:

- Na página de Sincronização de Ativos, insira o endereço e a API Key do ScopeSentry para conectar a fonte de dados.
- Selecione os alvos e tipos de ativos (domínios / subdomínios / IPs / portas / sites / endpoints...) por dimensão de Projeto ou Tarefa.
- Importe com um clique e organize por escopo de ativos da empresa, integrando-os diretamente ao grafo de ativos do ARTEX para exploração dos agents.

---

 Instalação

> Requer banco de dados PostgreSQL; para a exploração, é necessário configurar um LLM (`ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`, configuráveis também via UI).

 Opção 1: Script de Instalação em Um Clique (Recomendado)

bash
git clone https://github.com/mhtsec/ARTEX.git
cd ARTEX
./install.sh


O script irá: detectar/instalar o Docker $\rightarrow$ permitir que você escolha entre ① Tudo via Docker ou ② Compilação Local:

- ① Tudo via Docker: Defina uma senha para o Postgres (ou pressione Enter para aleatória) $\rightarrow$ gera `.env` automaticamente $\rightarrow$ `docker compose up -d`.
- ② Execução Local: Escolha o banco de dados (conectar a um existente / subir um via Docker) $\rightarrow$ gera `config.json` $\rightarrow$ compila via `go` em um único binário $\rightarrow$ inicia.

Após a instalação, acesse http://localhost:8787 (no primeiro acesso, vá em `/setup` para definir a senha do administrador).

 Opção 2: Docker Compose (Manual)

bash
git clone https://github.com/mhtsec/ARTEX.git
cd ARTEX
cp .env.example .env           Preencha POSTGRES_PASSWORD e, opcionalmente, ANTHROPIC_API_KEY
docker compose up -d           Puxa a imagem mianhuatang11/artex + postgres
 $\rightarrow$ http://localhost:8787


> A fonte original `autumn27/artex` foi removida do Docker Hub; a imagem agora é mantida por este repositório como `mianhuatang11/artex`.
> Caso a imagem esteja indisponível (ou queira alterar o código), construa localmente: `docker compose build && docker compose up -d`.
> O Dockerfile utiliza build multi-estágio (exportação estática do frontend $\rightarrow$ compilação estática em Go $\rightarrow$ imagem de execução).

A imagem já inclui ferramentas comuns (`ripgrep`, `curl`, `vim`, `npm`, `nmap`...); as pastas `./skills` e `./data` são persistidas via bind mount.

 Opção 3: Download de Binário Pré-compilado (Releases)

Baixe o zip da plataforma correspondente nos [Releases](https://github.com/Autumn-27/ARTEX/releases) do repositório original (este backup não hospeda binários). Após descompactar, você terá o `artex` + `start.sh` (Windows: `start.bat`) + `skills/` + `config.example.json`:

bash
cp config.example.json config.json    Configure a conexão do banco de dados
./start.sh                            $\rightarrow$ http://localhost:8787


> Use `start.sh` / `start.bat` para iniciar, e não o `./artex` diretamente. Ele funciona como um script de monitoramento: se o programa fechar, ele decide se deve reiniciar com base no código de saída. A função de Atualização em Um Clique depende dele.
> Para rodar em background: `nohup ./start.sh >artex.log 2>&1 &`.

 Opção 4: Compilação a partir do Código-Fonte

bash
 1) Exportação estática do frontend
cd web && npm ci && npm run build:static && cd ..
 2) Copiar para o diretório embutido
cp -r web/out server/webui/dist
 3) Compilar (a tag -tags embedui é necessária para embutir o frontend)
CGO_ENABLED=0 go build -tags embedui -o artex ./cmd/artex
./start.sh


 Opção 5: Construção de Pacotes Release Multiplataforma

O `build.sh` constrói o frontend, embuto-o e remove informações de debug via Go linker, compactando tudo em zip. Por padrão, gera pacotes para Linux amd64/arm64, macOS amd64/arm64 e Windows amd64:

bash
./build.sh --release
 Resultado: dist/artex-0.3.3-.zip


Para reduzir ainda mais o tamanho do binário, use `--upx` (certifique-se de que o ambiente de destino é compatível):

bash
ARTEX_TARGETS=linux/amd64,windows/amd64 ./build.sh --release
./build.sh --target linux/amd64 --upx


---

 Atualizações

> As atualizações substituem apenas o executável. Os volumes de dados do Postgres `pgdata`, a pasta `./data` (jwt.key / SQLite) e `./skills` são mantidos. O `artex` executa o `schema.sql` automaticamente a cada inicialização para migrações.

Atualização via UI: Em "Configurações do Sistema", você pode atualizar a versão sem acessar o servidor. O sistema valida o SHA256SUM e faz rollback automático se falhar.

Via Script/Docker: Use `./update.sh` ou `docker compose pull artex && docker compose up -d artex` para atualizar a imagem e aplicar as migrações de banco de dados.
