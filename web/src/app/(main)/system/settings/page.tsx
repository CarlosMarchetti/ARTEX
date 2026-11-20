"use client";

import * as React from "react";

import { CpuIcon, FlaskConicalIcon, KeyboardIcon, RadioTowerIcon, SearchIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { CHAT_SEND_MODE_OPTIONS, type ChatSendMode, setChatSendMode, useChatSendMode } from "@/lib/chat-send-mode";
import type { Settings } from "@/lib/types";

import { UpdateCard } from "./_components/update-card";

export default function SystemSettingsPage() {
  const [trafficCapture, setTrafficCapture] = React.useState(false);
  const [agentTrafficBinding, setAgentTrafficBinding] = React.useState(false);
  const [webSearch, setWebSearch] = React.useState(false);
  const [backend, setBackend] = React.useState("ddgs");
  const [braveKeySet, setBraveKeySet] = React.useState(false);
  const [braveKeyInput, setBraveKeyInput] = React.useState("");
  const [tavilyKeySet, setTavilyKeySet] = React.useState(false);
  const [tavilyKeyInput, setTavilyKeyInput] = React.useState("");
  const [savingTavilyKey, setSavingTavilyKey] = React.useState(false);
  const [proxyInput, setProxyInput] = React.useState("");
  const [savingProxy, setSavingProxy] = React.useState(false);
  const [globalProxyInput, setGlobalProxyInput] = React.useState("");
  const [savingGlobalProxy, setSavingGlobalProxy] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState(false);
  const [pyInterp, setPyInterp] = React.useState("");
  const [workers, setWorkers] = React.useState("3");
  const [savingWorkers, setSavingWorkers] = React.useState(false);
  // 操作约束注入范围(默认都开)。
  const [injectPlanner, setInjectPlanner] = React.useState(true);
  const [injectWorker, setInjectWorker] = React.useState(true);
  // 实验功能:noa 上下文压缩(默认关)。
  const [noaCompaction, setNoaCompaction] = React.useState(false);
  // 纯前端偏好：不走 /api/settings，直接读写 localStorage。
  const sendMode = useChatSendMode();

  const apply = React.useCallback((s: Settings) => {
    setTrafficCapture(!!s.traffic_capture);
    setAgentTrafficBinding(!!s.agent_traffic_binding);
    setWebSearch(!!s.web_search_enabled);
    setBackend(s.web_search_backend || "ddgs");
    setBraveKeySet(!!s.brave_key_set);
    setTavilyKeySet(!!s.tavily_key_set);
    setProxyInput(s.web_search_proxy ?? "");
    setGlobalProxyInput(s.global_proxy ?? "");
    setPyInterp(s.python_interpreter ?? "");
    setWorkers(String(s.workers ?? 3));
    setInjectPlanner(s.constraints_inject_planner !== false);
    setInjectWorker(s.constraints_inject_worker !== false);
    setNoaCompaction(!!s.noa_compaction);
  }, []);

  const saveWorkers = () => {
    const n = Number(workers);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("O número de simultaneidade deve ser um número inteiro maior que 0");
      return;
    }
    setSavingWorkers(true);
    api
      .setSettings({ workers: n })
      .then((s) => {
        apply(s);
        toast.success("Número de agentes de trabalho simultâneos salvos (efetivo para tarefas iniciadas posteriormente)");
      })
      .catch((e) => toast.error("Não foi possível salvar:" + (e as Error).message))
      .finally(() => setSavingWorkers(false));
  };

  const savePython = () => {
    setSaving(true);
    api
      .setSettings({ python_interpreter: pyInterp.trim() })
      .then((s) => {
        apply(s);
        toast.success("Configuração do interpretador Python salva");
      })
      .catch((e) => toast.error("Não foi possível salvar:" + (e as Error).message))
      .finally(() => setSaving(false));
  };
  const detectPython = () => {
    setSaving(true);
    api
      .detectPython()
      .then((r) => setPyInterp(r.python_interpreter))
      .catch(() => undefined)
      .finally(() => setSaving(false));
  };

  React.useEffect(() => {
    api
      .settings()
      .then(apply)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [apply]);

  const toggleTraffic = (v: boolean) => {
    setTrafficCapture(v); // optimistic
    setSaving(true);
    api
      .setSettings({ traffic_capture: v })
      .then(apply)
      .catch(() => setTrafficCapture(!v)) // revert on failure
      .finally(() => setSaving(false));
  };

  const toggleInjectPlanner = (v: boolean) => {
    setInjectPlanner(v); // optimistic
    api
      .setSettings({ constraints_inject_planner: v })
      .then(apply)
      .catch(() => setInjectPlanner(!v)); // revert on failure
  };

  const toggleAgentTrafficBinding = (v: boolean) => {
    setAgentTrafficBinding(v);
    setSaving(true);
    api
      .setSettings({ agent_traffic_binding: v })
      .then((s) => {
        apply(s);
        toast.success(v ? "O tráfego de ligação automática do agente foi ativado" : "O tráfego de ligação automática do agente foi desativado");
      })
      .catch((e) => {
        setAgentTrafficBinding(!v);
        toast.error(`Não foi possível salvar:${(e as Error).message}`);
      })
      .finally(() => setSaving(false));
  };

  const toggleInjectWorker = (v: boolean) => {
    setInjectWorker(v); // optimistic
    api
      .setSettings({ constraints_inject_worker: v })
      .then(apply)
      .catch(() => setInjectWorker(!v)); // revert on failure
  };

  const toggleNoaCompaction = (v: boolean) => {
    setNoaCompaction(v); // optimistic
    api
      .setSettings({ noa_compaction: v })
      .then((s) => {
        apply(s);
        toast.success(v ? "a compactação de contexto noa está habilitada (efetiva para execuções subsequentes)" : "compactação de contexto noa desativada (restaura a compactação integrada)");
      })
      .catch((e) => {
        setNoaCompaction(!v); // revert on failure
        toast.error(`Não foi possível salvar:${(e as Error).message}`);
      });
  };

  // Persist a web-search patch (enable and/or backend). Optimistic with refetch.
  const saveWebSearch = (patch: Partial<Settings>) => {
    setSaving(true);
    api
      .setSettings(patch)
      .then((s) => {
        apply(s);
        toast.success("Configuração de pesquisa de rede salva");
      })
      .catch((e) => {
        toast.error("Não foi possível salvar:" + (e as Error).message);
        api
          .settings()
          .then(apply)
          .catch(() => undefined);
      })
      .finally(() => setSaving(false));
  };

  const saveBraveKey = () => {
    setSavingKey(true);
    api
      .setSettings({ brave_search_api_key: braveKeyInput })
      .then((s) => {
        apply(s);
        setBraveKeyInput("");
        toast.success("Chave de API Brave salva");
      })
      .catch((e) => toast.error("Não foi possível salvar:" + (e as Error).message))
      .finally(() => setSavingKey(false));
  };

  const saveTavilyKey = () => {
    setSavingTavilyKey(true);
    api
      .setSettings({ tavily_search_api_key: tavilyKeyInput })
      .then((s) => {
        apply(s);
        setTavilyKeyInput("");
        toast.success("Chave API Tavily salva");
      })
      .catch((e) => toast.error("Não foi possível salvar:" + (e as Error).message))
      .finally(() => setSavingTavilyKey(false));
  };

  const saveProxy = () => {
    setSavingProxy(true);
    api
      .setSettings({ web_search_proxy: proxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(proxyInput.trim() ? "Agente de exportação salvo" : "Proxy de saída desmarcado (alterado para conexão direta)");
      })
      .catch((e) => toast.error("Não foi possível salvar:" + (e as Error).message))
      .finally(() => setSavingProxy(false));
  };

  const saveGlobalProxy = () => {
    setSavingGlobalProxy(true);
    api
      .setSettings({ global_proxy: globalProxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(globalProxyInput.trim() ? "Agente global salvo" : "Proxy global limpo (alterado para conexão direta)");
      })
      .catch((e) => toast.error("Não foi possível salvar:" + (e as Error).message))
      .finally(() => setSavingGlobalProxy(false));
  };

  // Run a real "test" search ("test") against the CURRENT form values (backend +
  // proxy + entered key), falling back to saved values server-side. Toasts result.
  const runTest = () => {
    setTesting(true);
    api
      .testWebSearch({
        web_search_backend: backend,
        web_search_proxy: proxyInput.trim(),
        brave_search_api_key: braveKeyInput,
        tavily_search_api_key: tavilyKeyInput,
      })
      .then((r) => {
        if (r.ok) toast.success(`Teste de pesquisa bem-sucedido· ${r.backend} Retorno ${r.count} resultados`);
        else toast.error("Falha no teste de pesquisa:" + (r.error || "Erro desconhecido"));
      })
      .catch((e) => toast.error("Falha no teste de pesquisa:" + (e as Error).message))
      .finally(() => setTesting(false));
  };

  // brave-free selected but no key stored and none being entered → tool stays off.
  const braveNeedsKey = webSearch && backend === "brave-free" && !braveKeySet;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configurações gerais</h1>
        <p className="text-muted-foreground text-sm">Comutador de tempo de execução global</p>
      </div>

      {/* 多列而非 grid：网络搜索卡片比其余高数倍，且高度随所选后端变化（brave/tavily
          的 key 输入是条件渲染）。grid 会按最高的一张撑满整行、在旁边留下大片空白，
          多列则自动按内容高度平衡填充。卡片间距靠 mb 而非 gap——多列布局下
          column-gap 只管列间距，行间距要由子元素自己给。 */}
      <div className="columns-1 gap-4 md:gap-6 lg:columns-2">
        <UpdateCard />

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              Captura de tráfego
            </CardTitle>
            <CardDescription>
              Após a ativação, todo o tráfego HTTP do Agente será registrado no banco de dados por meio do agente de gravação e tráfego_search/traffic_get será injetado no Agente.

 Configuração de ferramenta e agente (a palavra do prompt contém a descrição do agente).
              <br />
              Não registrar nenhum tráfego quando desligado (padrão): Agente
              <b>Não</b>Obtenha as ferramentas de configuração de proxy e tráfego, e as palavras de prompt também são<b>Não contém</b>Conteúdo relacionado ao agente. Após a troca, o Agente será reconstruído imediatamente para entrar em vigor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="traffic-capture" className="text-sm font-normal text-muted-foreground">
              {trafficCapture ? "Habilitado · Gravação de tráfego e injeção de proxy" : "Fechado · Sem registro, sem injeção de proxy"}
            </Label>
            <Switch
              id="traffic-capture"
              checked={trafficCapture}
              disabled={!loaded || saving}
              onCheckedChange={toggleTraffic}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              Agente vincula tráfego automaticamente
            </CardTitle>
            <CardDescription id="agent-traffic-binding-description">
              Desligado por padrão. Quando ativado, o agente relator acionado quando uma vulnerabilidade é registrada no banco de dados verificará as solicitações/respostas HTTP existentes, correlacionará o tráfego correspondente e, em seguida, escreverá um relatório.
              <b>Consultar pacotes de dados e chamadas de ferramentas adicionais aumentarão o consumo de Token.</b>
              <br />
              TCP, nenhuma captura de pacote ou nenhum tráfego correspondente ainda pode ser relatado normalmente. Essa opção não afeta a captura de tráfego, a vinculação manual e a visualização de evidências salvas. Para a próxima rodada de Agente

 entra em vigor; novas vinculações automáticas são rejeitadas imediatamente quando desativadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="agent-traffic-binding" className="text-sm font-normal text-muted-foreground">
              {agentTrafficBinding ? "Habilitado · Aumentará o consumo de Token" : "Fechado · A vinculação manual pode continuar"}
            </Label>
            <Switch
              id="agent-traffic-binding"
              aria-describedby="agent-traffic-binding-description"
              checked={agentTrafficBinding}
              disabled={!loaded || saving}
              onCheckedChange={toggleAgentTrafficBinding}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              Agente global
            </CardTitle>
            <CardDescription>
              Todos os Agentes<b>Fluxo alvo</b>Saia da rede através deste proxy (oculte o IP de origem/pegue o trampolim). suporte <b>http / https / socks5</b>, pode levar{" "}
              <code>user:pass</code> Autenticação. Deixe em branco = conexão direta.
              <br />
              Ligar<b>Captura de tráfego</b>, atua como agente de gravação<b>a montante</b>(O tráfego ainda é totalmente descartado na biblioteca e depois sai da rede por meio deste proxy); quando a captura está desligada, injeção direta

 O bash/WebFetch do agente sai da rede. Independente do agente de pesquisa de rede e do agente LLM.
              <br />
              <b>Dica</b>: meias5 pol.<b>Desativar captura</b>depende de cada ferramenta de linha de comando para <code>ALL_PROXY</code> suporte (ondulação

 está disponível, algumas ferramentas podem ignorá-lo); se você usa principalmente meias5, é recomendado ativar a captura de tráfego - esse caminho é fornecido pelo MITM

 Ligue pessoalmente, a ferramenta é invisível e funciona de forma estável.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Label htmlFor="global-proxy" className="text-sm font-normal text-muted-foreground">
              endereço proxy
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="global-proxy"
                autoComplete="off"
                placeholder="meias5://usuário:pass@host:1080 ou http://host:porta (deixe em branco = conexão direta)"
                value={globalProxyInput}
                disabled={!loaded || savingGlobalProxy}
                onChange={(e) => setGlobalProxyInput(e.target.value)}
              />
              <Button type="button" onClick={saveGlobalProxy} disabled={!loaded || savingGlobalProxy}>
                Salvar
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {globalProxyInput.trim() ? "Configurado · Todo o tráfego alvo sai da rede através deste proxy" : "Não configurado·O tráfego de destino está diretamente conectado à rede"}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlertIcon className="size-4" />
              Injeção de restrição operacional
            </CardTitle>
            <CardDescription>
              Após a abertura, altere o<b>Restrições operacionais</b>(A entrada permitir/negar mantida na visão geral da tarefa &quot;Restrições de operação&quot;) soletrar no Agente correspondente
 O prompt do sistema
 é usado para enquadrar o limite de exploração (como &quot;testar apenas a porta atual&quot; e &quot;sem detonação&quot;).
              <br />
              A injeção em <b>Planejador</b>e <b>Executor (trabalhador)</b>
              ; Ambos estão habilitados por padrão. A mudança entra em vigor imediatamente (na próxima rodada de leitura) e não há necessidade de reconstruir o Agente. Após o fechamento, o Agente não vê mais as restrições.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="inject-planner" className="text-sm font-normal text-muted-foreground">
                Planejador de injeção{injectPlanner ? " ·Já ligado" : " · Fechado"}
              </Label>
              <Switch
                id="inject-planner"
                checked={injectPlanner}
                disabled={!loaded}
                onCheckedChange={toggleInjectPlanner}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="inject-worker" className="text-sm font-normal text-muted-foreground">
                Injetar executor (trabalhador){injectWorker ? " ·Já ligado" : " · Fechado"}
              </Label>
              <Switch
                id="inject-worker"
                checked={injectWorker}
                disabled={!loaded}
                onCheckedChange={toggleInjectWorker}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConicalIcon className="size-4" />
              Função experimental
            </CardTitle>
            <CardDescription>
              O mecanismo que ainda está em verificação é fechado por padrão. Isso pode alterar o comportamento do Agente ou afetar a estabilidade. Ative-o depois de compreender o impacto.
              <br />
              <b>compressão de contexto noa</b>: O longo histórico de conversas é compactado ativamente pelo modelo (norma v0.4.0). Os quatro tipos de Agentes (
              <b>Planejador/Executor/Agente Principal/Diálogo</b>) use noa para assumir o controle do contexto em vez da compactação integrada,

 O texto original compactado será arquivado no diretório de trabalho da tarefa para facilitar o retrocesso. A mudança entra em vigor imediatamente (efetiva para execuções subsequentes) e não há necessidade de reconstruir o Agente;

 Retoma a compactação integrada imediatamente após o fechamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="noa-compaction" className="text-sm font-normal text-muted-foreground">
              compressão de contexto noa{noaCompaction ? " ·Já ligado" : " · Fechado"}
            </Label>
            <Switch
              id="noa-compaction"
              checked={noaCompaction}
              disabled={!loaded}
              onCheckedChange={toggleNoaCompaction}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SearchIcon className="size-4" />
              Pesquisa na Internet
            </CardTitle>
            <CardDescription>
              Esta é uma pesquisa na web<b>Chave principal + configuração da fonte</b>. Depois de ligá-lo, você pode<b>Configuração de cada Agente</b>selecione individualmente se deseja ativar
              <b>web_search</b>(Apenas o título/link/resumo é retornado e o texto não é rastreado; o WebFetch é responsável pelo rastreamento). pesquisa na web<b>Não saindo</b>
              Agente de registro, independente da captura de tráfego.
              <br />
              Fonte opcional <b>DuckDuckGo（ddgs）</b>(sem necessidade de chave),<b>Bravo (versão gratuita)</b>(A chave da API Brave precisa ser preenchida),{" "}
              <b>Tavily</b>(A chave da API Tavily precisa ser preenchida) ou <b>DeepSeek</b>(reutilizar a configuração LLM atual). Quando o interruptor principal é desligado, cada

 A opção de pesquisa de rede do agente não está disponível.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="web-search" className="text-sm font-normal text-muted-foreground">
                {webSearch ? "A chave principal está ligada. Pode ser habilitado individualmente em cada configuração de Agente." : "Fechado·Cada agente não pode ativar a pesquisa de rede"}
              </Label>
              <Switch
                id="web-search"
                checked={webSearch}
                disabled={!loaded || saving}
                onCheckedChange={(v) => {
                  setWebSearch(v); // optimistic
                  saveWebSearch({ web_search_enabled: v });
                }}
              />
            </div>

            {webSearch && (
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm font-normal text-muted-foreground">Fonte de pesquisa</Label>
                <Select
                  value={backend}
                  disabled={!loaded || saving}
                  onValueChange={(v) => {
                    setBackend(v); // optimistic
                    saveWebSearch({ web_search_backend: v });
                  }}
                >
                  <SelectTrigger className="w-48 shrink-0">
                    <SelectValue placeholder="Selecionar fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ddgs">DuckDuckGo (ddgs · Grátis sem chave)</SelectItem>
                    <SelectItem value="brave-free">Brave (versão gratuita · Chave necessária)</SelectItem>
                    <SelectItem value="tavily">Tavily (chave necessária)</SelectItem>
                    <SelectItem value="deepseek">DeepSeek (oficial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {webSearch && backend === "deepseek" && (
              <div className="border-border/60 bg-muted/30 flex flex-col gap-2 rounded-md border p-3">
                <p className="text-sm font-medium">Pesquisa oficial do DeepSeek na Internet</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Esta fonte é reutilizada diretamente<b>Configuração LLM atualmente ativa</b>. portanto
                  <b>Suporta apenas modelos oficiais do DeepSeek</b>, e esta configuração<b>Protocolo antrópico deve ser usado</b>
                  - O endpoint do protocolo OpenAI do DeepSeek não suporta pesquisa no lado do servidor. Esta fonte pode tornar-se inválida após mudar a configuração do LLM.
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Ao contrário de outras fontes, pesquise por <b>Execução do servidor DeepSeek</b>: Cada pesquisa consumirá uma chamada de modelo adicional (gerando Token

 taxa), solicitação de pesquisa<b>Sem passar pelo agente de exportação acima</b>, também<b>Não incluir traços de fluxo</b>; Resultado de retorno<b>Somente título e link</b>
                  (sem resumo), rastreado pelo WebFetch quando o texto é necessário.
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Cabe a você confirmar se as condições acima foram atendidas e o sistema não irá interceptá-las; você pode usar o botão &quot;Testar pesquisa&quot; abaixo para executá-lo uma vez para verificar.
                </p>
              </div>
            )}

            {webSearch && backend === "brave-free" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="brave-key" className="text-sm font-normal text-muted-foreground">
                  Brave Search API Key
                  {braveKeySet && <span className="ml-2 text-xs text-emerald-500">Configurado</span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="brave-key"
                    type="password"
                    autoComplete="off"
                    placeholder={braveKeySet ? "Configurado (deixar em branco para permanecer inalterado)" : "Insira a chave da API do Brave"}
                    value={braveKeyInput}
                    disabled={!loaded || savingKey}
                    onChange={(e) => setBraveKeyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={saveBraveKey}
                    disabled={!loaded || savingKey || braveKeyInput.trim() === ""}
                  >
                    Salvar
                  </Button>
                </div>
                {braveNeedsKey && (
                  <p className="text-xs text-amber-500">
                    Brave está selecionado mas a Chave não foi configurada - a ferramenta de busca não será habilitada até que a Chave seja salva.
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  A versão gratuita tem limite de cerca de 2.000 vezes/mês. Vá para https://brave.com/search/api/ para obter a chave.
                </p>
              </div>
            )}

            {webSearch && backend === "tavily" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="tavily-key" className="text-sm font-normal text-muted-foreground">
                  Tavily Search API Key
                  {tavilyKeySet && <span className="ml-2 text-xs text-emerald-500">Configurado</span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tavily-key"
                    type="password"
                    autoComplete="off"
                    placeholder={tavilyKeySet ? "Configurado (deixar em branco para permanecer inalterado)" : "Insira a chave da API Tavily (tvly-…)"}
                    value={tavilyKeyInput}
                    disabled={!loaded || savingTavilyKey}
                    onChange={(e) => setTavilyKeyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={saveTavilyKey}
                    disabled={!loaded || savingTavilyKey || tavilyKeyInput.trim() === ""}
                  >
                    Salvar
                  </Button>
                </div>
                {webSearch && backend === "tavily" && !tavilyKeySet && (
                  <p className="text-xs text-amber-500">
                    Tavily foi selecionado mas a Chave não foi configurada - a ferramenta de busca não será habilitada até que a Chave seja salva.
                  </p>
                )}
                <p className="text-muted-foreground text-xs">Acesse https://tavily.com para se registrar e obter a chave API.</p>
              </div>
            )}

            {webSearch && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="ws-proxy" className="text-sm font-normal text-muted-foreground">
                  Agente de exportação (opcional)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="ws-proxy"
                    autoComplete="off"
                    placeholder="http://host:port ou meias5://host:port (deixe em branco = conexão direta)"
                    value={proxyInput}
                    disabled={!loaded || savingProxy}
                    onChange={(e) => setProxyInput(e.target.value)}
                  />
                  <Button type="button" onClick={saveProxy} disabled={!loaded || savingProxy}>
                    Salvar
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Proxy de saída independente, usado apenas para acessar endpoints de pesquisa (VPN/SOCKS, etc.). Não tem nada a ver com o proxy MITM que registra o tráfego; ele é acessado através deste proxy quando a rede está indisponível.
                </p>
              </div>
            )}

            {webSearch && (
              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <p className="text-muted-foreground text-xs">
                  Use a configuração atual (fonte + agente + chave) para realmente pesquisar por &quot;teste&quot; para verificar se ele está disponível.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={runTest}
                  disabled={!loaded || testing}
                  className="shrink-0"
                >
                  {testing ? "Testando..." : "Pesquisa de teste"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              Script personalizado · Intérprete Python
            </CardTitle>
            <CardDescription>
              Personalizado <b>script</b> Ferramentas de tipo usam-no para executar Python. Ele será detectado automaticamente durante a inicialização (python3 é o preferido); venv / pode ser preenchido manualmente aqui

 O caminho absoluto para uma versão específica. Se deixado em branco, será detectado automaticamente em tempo de execução.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                className="font-mono text-sm"
                placeholder="/usr/bin/python3 (deixe em branco=detecção automática)"
                value={pyInterp}
                disabled={!loaded || saving}
                onChange={(e) => setPyInterp(e.target.value)}
              />
              <Button variant="outline" onClick={detectPython} disabled={!loaded || saving}>
                Redetecção
              </Button>
              <Button onClick={savePython} disabled={!loaded || saving}>
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CpuIcon className="size-4" />
              Simultaneidade de trabalho · Número de Agentes de Trabalho
            </CardTitle>
            <CardDescription>
              O número de agentes de trabalho em execução simultaneamente para cada tarefa (padrão 3). Quanto maior o valor, mais sondas simultâneas e maior o consumo. Após modificação
              <b>Efeito em tarefas iniciadas posteriormente</b>, as tarefas em execução não são afetadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-32 font-mono text-sm"
                placeholder="3"
                value={workers}
                disabled={!loaded || savingWorkers}
                onChange={(e) => setWorkers(e.target.value)}
              />
              <Button onClick={saveWorkers} disabled={!loaded || savingWorkers}>
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyboardIcon className="size-4" />
              Caixa de entrada da sessão envia chaves
            </CardTitle>
            <CardDescription>
              A página de diálogo e a caixa de entrada principal da sessão do Agente de detalhes da tarefa compartilham esta configuração. Ele entra em vigor imediatamente após a seleção e não precisa ser salvo.
              <br />
              Esta preferência<b>Só existe neste navegador</b>, não sincroniza com a conta e precisa ser redefinido após a troca de navegador ou limpeza dos dados do site.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="chat-send-mode" className="text-sm font-normal text-muted-foreground">
              Método de envio
            </Label>
            <Select value={sendMode} onValueChange={(v) => setChatSendMode(v as ChatSendMode)}>
              <SelectTrigger id="chat-send-mode" className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_SEND_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
