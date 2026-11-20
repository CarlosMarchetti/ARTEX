# ARTEX PT-BR

**Console de pentest e bug bounty assistido por IA, com interface em português.**

Adaptação do ARTEX com configuração de provedores, primeiros passos, criação guiada de testes e evidências organizadas. Backend em Go, interface em Next.js e persistência em PostgreSQL.

## Começar

**Pacote Windows:** extraia todos os arquivos e abra **INICIAR.cmd**. O pacote pronto inclui o executável e o PostgreSQL local. No primeiro acesso, crie a senha do console e configure o provedor de IA.

**Código-fonte com Docker:** execute `./iniciar.ps1` no PowerShell ou `./iniciar.sh` no Linux/macOS. O build usa o código deste fork.

Console: **http://127.0.0.1:8787**.

Consulte o **[guia completo de instalação, uso e testes](GUIA-PTBR.md)**.

## O que mudou

- Navegação e interface traduzidas para PT-BR, com revisão dos fluxos de entrada e configuração.
- Tela **Primeiros passos** e formulário **Novo teste guiado**, com programa, escopo, exclusões, regras e duração.
- Opções prontas para **Kafox**, OpenRouter, Gemini, Groq, Ollama, LM Studio, OpenAI, Anthropic e gateways personalizados.
- Busca de modelos, filtro por IDs gratuitos e teste de chamadas de ferramentas.
- Regras de subdomínio com correspondência estrita e exclusões prioritárias nos controles de ativos.
- Relatórios em português, preservando os dados técnicos e as evidências originais.
- Iniciadores Windows, banco separado e laboratório local para verificar o fluxo.
- Correções de compatibilidade Windows, inicialização do registro de tokens e dependências web atualizadas.

## Kafox

Escolha Kafox ao criar o perfil, informe sua chave e teste o modelo `kafox-free`. A aplicação também permite escolher qualquer ID disponível para sua conta; use os sufixos completos. Modelos e cotas gratuitas dependem do serviço. Nenhuma chave de usuário acompanha o projeto.

## Escopo de uso

Use em seus próprios ambientes e em programas que autorizem os testes. Cada tarefa registra seu escopo e suas exclusões. Os controles de ativos não são um sandbox de rede: comandos de terminal exigem revisão e isolamento adequados ao ambiente. Não há execução automática contra sites externos na instalação.

## Origem e licença

Fork de [mhtsec/ARTEX](https://github.com/mhtsec/ARTEX), derivado do ARTEX de Autumn-27. Modificações desta adaptação iniciadas em 20/11/2026. Os avisos e as licenças dos componentes originais permanecem nos respectivos arquivos.

Código sob **[GNU AGPL-3.0](LICENSE)**. O diretório `norma/` contém a dependência restaurada pelo upstream e seus avisos próprios. O PostgreSQL distribuído no pacote Windows mantém seus avisos em `vendor/postgresql/`.
