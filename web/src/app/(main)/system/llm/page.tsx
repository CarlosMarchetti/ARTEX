"use client";

import * as React from "react";

import {
  Loader2Icon,
  PlugZapIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
  StarIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { LLMPoolMember, LLMPoolStatus, LLMProfile, LLMRetryOverride } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LLM_PRESETS, isFreeModelID, sameProviderEndpoint } from "@/lib/llm-presets";

import { ProfileRetryFields, RetryPolicyPanel, ZERO_OVERRIDE } from "./_components/retry";

// 思考开关(thinking.type)与思考强度(reasoning_effort)是两个【互相独立】的字段，
// 各自单独设置——有些接口没有 thinking 字段、只靠强度参数就能激活思考，故需解耦。
// 存库空字符串 = 该字段【不发送】；Radix Select 不接受空 value，故 UI 用 "none"
// 哨兵表示不发送，存取时与 "" 互转（NONE / fromStore / toStore）。
const NONE = "none";
const fromStore = (v?: string) => (v ? v : NONE);
const toStore = (v: string) => (v === NONE ? "" : v);
const THINKING_TYPES: { value: string; label: string }[] = [
  { value: NONE, label: "Não enviar (padrão)" },
  { value: "disabled", label: "Fechar" },
  { value: "enabled", label: "Ligar" },
];
// 输出上限用哪个请求字段名（仅 openai 格式有意义）。NONE ↔ "" 走同一套哨兵转换。
const MAX_TOKENS_FIELDS: { value: string; label: string }[] = [
  { value: NONE, label: "max_tokens (padrão)" },
  { value: "max_completion_tokens", label: "max_completion_tokens" },
];
// 另外两种格式各自定死了字段名，选项对它们无意义，说明文案里直接讲清楚。
const MAX_TOKENS_FIELD_HINTS: Record<string, string> = {
  openai:
    "Para qual chave o limite superior deve ser enviado? max_tokens é o padrão e a maioria dos gateways compatíveis apenas o reconhecem; O modelo de inferência oficial da OpenAI (série O / GPT-5), por sua vez, reconhece apenas max_completion_tokens e reportará diretamente unsupported_parameter ao receber max_tokens.",
  anthropic: "Apenas o formato openai está disponível. O nome do campo Antrópico é fixado em max_tokens.",
  "openai-responses":
    "Apenas o formato openai está disponível. O nome do campo da API Responses é fixado em max_output_tokens.",
};
const EFFORT_LEVELS: { value: string; label: string }[] = [
  { value: NONE, label: "Não enviar (padrão)" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "xhigh", label: "xhigh" },
  { value: "max", label: "max" },
];

function cooldownText(secs: number) {
  if (secs <= 0) return "";
  if (secs < 60) return `${secs}s`;
  return `${Math.ceil(secs / 60)}min`;
}

// 一个配置在卡片上显示的「是否正常」。没填 Key 的配置根本发不出请求，比熔断更该先说；
// 其余状态来自轮询的熔断记录（轮询关着时不会产生新记录，此时「正常」= 没有已知故障）。
type Health = { label: string; cls: string; hint?: string };
function healthOf(p: LLMProfile, m?: LLMPoolMember): Health {
  if (!p.api_key_hint) {
    return {
      label: "Chave não configurada",
      cls: "border-muted-foreground/40 text-muted-foreground",
      hint: "A chave API não está preenchida e não pode ser chamada",
    };
  }
  if (m?.state === "tripped") {
    return {
      label: m.cooldown_secs > 0 ? `Fundido· ${cooldownText(m.cooldown_secs)}` : "Fundido",
      cls: "border-destructive/50 text-destructive",
      hint: m.last_error,
    };
  }
  if (m?.state === "degraded") {
    return {
      label: `Exceção · Falha ${m.fails} vezes`,
      cls: "border-amber-500/50 text-amber-600 dark:text-amber-400",
      hint: m.last_error,
    };
  }
  return { label: "Normal", cls: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 轮询配置抽屉
// ─────────────────────────────────────────────────────────────────────────────

function PoolSheet({
  open,
  onOpenChange,
  pool,
  onReload,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pool: LLMPoolStatus | null;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);

  // 冷却倒计时是后端算出的剩余秒数——抽屉开着且有配置不正常时才定时拉，让它走起来。
  React.useEffect(() => {
    if (!open || !pool?.enabled || !pool.chain.some((m) => m.state !== "ok")) return;
    const t = setInterval(() => void onReload(), 10_000);
    return () => clearInterval(t);
  }, [open, pool, onReload]);

  async function toggle(patch: { llm_pool_enabled?: boolean; llm_pool_bind_fallback?: boolean }) {
    if (busy) return;
    setBusy(true);
    try {
      await api.setSettings(patch);
      await onReload();
      if (patch.llm_pool_enabled !== undefined) {
        toast.success(patch.llm_pool_enabled ? "Sondagem LLM ativada" : "Sondagem LLM encerrada");
      } else {
        toast.success("A configuração do bolso foi atualizada");
      }
    } catch (e) {
      toast.error(`Falha na configuração:${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function recover(id?: string) {
    try {
      await api.resetLLMPool(id);
      await onReload();
      toast.success(id ? "A configuração foi restaurada" : "Todas as configurações foram restauradas");
    } catch (e) {
      toast.error(`Falha na recuperação:${(e as Error).message}`);
    }
  }

  const enabled = pool?.enabled ?? false;
  const chain = pool?.chain ?? [];
  // 参与轮询的成员（排除被标记「不参与轮询」的），顺序即后端实际的尝试顺序。
  const inChain = chain.filter((m) => m.active || !m.excluded);
  const tripped = chain.filter((m) => m.state === "tripped");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader className="px-4">
          <SheetTitle className="flex items-center gap-2">
            <ZapIcon className="size-4" /> Pesquisa LLM · failover
          </SheetTitle>
          <SheetDescription>
            Após a abertura,<b>Nenhum modelo especificado O Agente de</b>está indisponível na configuração atual (saldo
            insuficiente/Chave inválida/limitação de corrente/ muda automaticamente para a próxima configuração quando o
            serviço está anormal).
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="grid gap-0.5">
              <Label className="text-sm">Habilitar sondagem</Label>
              <p className="text-muted-foreground text-xs">
                Desligado por padrão. Sempre use apenas a configuração ativa ao desligar, falha é falha.
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={busy}
              onCheckedChange={(v) => void toggle({ llm_pool_enabled: v })}
              aria-label="Chave de pesquisa LLM"
            />
          </div>

          {enabled && (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="grid gap-0.5">
                  <Label className="text-sm">Quando o modelo especificado falha, também fica claro</Label>
                  <p className="text-muted-foreground text-xs">
                    Desligado por padrão: Se o Agente ou tarefa especificar uma determinada configuração, ele apenas a
                    utilizará. Se falhar, falhará (não será trocado silenciosamente para outro modelo). Depois que for
                    ativado, quando a configuração especificada falhar, ela também retornará à cadeia de pesquisa
                    seguinte.
                  </p>
                </div>
                <Switch
                  checked={pool?.bind_fallback ?? false}
                  disabled={busy}
                  onCheckedChange={(v) => void toggle({ llm_pool_bind_fallback: v })}
                  aria-label="Chave de cobertura de falha de configuração de ligação"
                />
              </div>

              <Separator />

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Sequência de sondagem</Label>
                  {tripped.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => void recover()}>
                      <RotateCcwIcon /> Restaurar tudo
                    </Button>
                  )}
                </div>
                {inChain.length < 2 && (
                  <p className="text-muted-foreground text-xs">
                    Atualmente existem apenas {inChain.length} configurações disponíveis, a votação não terá efeito -
                    são necessárias pelo menos 2 configurações com chaves de API preenchidas e participação na votação.
                  </p>
                )}
                {chain.map((m) => {
                  const excluded = m.excluded && !m.active;
                  const order = excluded ? null : inChain.findIndex((x) => x.profile_id === m.profile_id) + 1;
                  return (
                    <div
                      key={m.profile_id}
                      className={cn(
                        "grid gap-1 rounded-lg border p-2.5 text-sm",
                        excluded && "opacity-55",
                        m.state === "tripped" && "border-destructive/40",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="w-5 shrink-0 text-center font-mono text-muted-foreground text-xs">
                          {order ?? "—"}
                        </span>
                        <span className="font-medium">{m.name}</span>
                        {m.active && (
                          <Badge variant="outline" className="border-amber-400/50 text-amber-500">
                            Ativar
                          </Badge>
                        )}
                        {excluded && <Badge variant="outline">Não participe de votações</Badge>}
                        <div className="ml-auto flex items-center gap-2">
                          {m.state === "tripped" && m.cooldown_secs > 0 && (
                            <span className="text-muted-foreground text-xs">
                              Resfriamento {cooldownText(m.cooldown_secs)}
                            </span>
                          )}
                          {m.state === "degraded" && (
                            <span className="text-muted-foreground text-xs">Falha contínua {m.fails} vezes</span>
                          )}
                          {m.state !== "ok" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              aria-label="Restaurar imediatamente"
                              title="Recuperação imediata: limpe o disjuntor e tente novamente a configuração na próxima vez que a chamada for feita"
                              onClick={() => void recover(m.profile_id)}
                            >
                              <RotateCcwIcon className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 pl-7 text-muted-foreground text-xs">
                        <code className="truncate font-mono">{m.model}</code>
                        {!m.active && <span>Prioridade {m.priority}</span>}
                      </div>
                      {m.last_error && (
                        <p className="truncate pl-7 font-mono text-muted-foreground text-xs" title={m.last_error}>
                          {m.last_error}
                        </p>
                      )}
                    </div>
                  );
                })}
                {chain.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
                    Nenhuma configuração ainda
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-dashed p-3 text-muted-foreground text-xs leading-relaxed">
                A configuração ativada é sempre classificada em primeiro lugar, e as demais são organizadas em ordem de
                prioridade de alta para baixa (definida em cada configuração). Entrar no resfriamento depois que uma
                determinada configuração falhar (60s → 5min → 30min), ele será ignorado durante o período de
                resfriamento e retornará automaticamente após a recuperação. A configuração solicitada atualmente será
                ignorada se a janela de contexto não couber nela. Agente com modelo especificado e as tarefas não
                participam da votação por padrão.
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 模型配置抽屉（新建 / 编辑共用同一套表单）
// ─────────────────────────────────────────────────────────────────────────────

function ProfileSheet({
  profile,
  open,
  onOpenChange,
  onSaved,
}: {
  profile: LLMProfile | null; // null = 新建
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const isNew = !profile;
  const [name, setName] = React.useState("");
  const [format, setFormat] = React.useState<"anthropic" | "openai" | "openai-responses">("anthropic");
  const [model, setModel] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [proxy, setProxy] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [keyHint, setKeyHint] = React.useState("");
  const [rps, setRps] = React.useState("0");
  const [rpm, setRpm] = React.useState("0");
  const [cw, setCw] = React.useState("0"); // 上下文窗口(K tokens);0=默认200K
  const [thinkingType, setThinkingType] = React.useState(NONE);
  const [effort, setEffort] = React.useState(NONE);
  const [priority, setPriority] = React.useState("0"); // 轮询顺位;越大越先
  const [poolExclude, setPoolExclude] = React.useState(false);
  const [streaming, setStreaming] = React.useState(true); // true=流式(默认);false=非流式
  const [maxTokens, setMaxTokens] = React.useState("0"); // 单次回复输出上限;0=不发送
  const [maxTokensField, setMaxTokensField] = React.useState(NONE); // 上限用哪个字段名;NONE=max_tokens
  const [sessionHeaderKey, setSessionHeaderKey] = React.useState(""); // 自定义会话头名;空=不发送
  const [retry, setRetry] = React.useState<LLMRetryOverride>(ZERO_OVERRIDE); // 本配置的重试覆盖;全 0=跟随全局
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [models, setModels] = React.useState<string[]>([]);
  const [presetID, setPresetID] = React.useState("custom");
  const [freeOnly, setFreeOnly] = React.useState(false);
  const selectedPreset = LLM_PRESETS.find((preset) => preset.id === presetID);
  const [loadingModels, setLoadingModels] = React.useState(false);
  const [modelsOpen, setModelsOpen] = React.useState(false);

  // 每次打开时从传入的 profile 灌一遍表单（新建则重置为默认值）。抽屉关掉再打开
  // 就是一次干净的开始，不会留下上一个配置的残影。
  React.useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setFormat(profile?.format === "openai" || profile?.format === "openai-responses" ? profile.format : "anthropic");
    setModel(profile?.model ?? "");
    setBaseUrl(profile?.base_url ?? "");
    setProxy(profile?.proxy ?? "");
    setRps(String(profile?.rate_per_second ?? 0));
    setRpm(String(profile?.rate_per_minute ?? 0));
    setCw(String(profile?.context_window_k ?? 0));
    setThinkingType(fromStore(profile?.thinking_type));
    setEffort(fromStore(profile?.reasoning_effort));
    setPriority(String(profile?.priority ?? 0));
    setPoolExclude(profile?.pool_exclude ?? false);
    setStreaming(profile?.streaming ?? true);
    setMaxTokens(String(profile?.max_tokens ?? 0));
    setMaxTokensField(fromStore(profile?.max_tokens_field));
    setSessionHeaderKey(profile?.session_header_key ?? "");
    setRetry(profile?.retry ?? ZERO_OVERRIDE);
    setApiKey("");
    setKeyHint(profile?.api_key_hint ?? "");
    setModels([]);
    setModelsOpen(false);
    setPresetID(
      LLM_PRESETS.find((preset) => preset.baseURL && sameProviderEndpoint(preset.baseURL, profile?.base_url ?? ""))
        ?.id ?? "custom",
    );
    setFreeOnly(false);
  }, [open, profile]);

  // A saved secret may only be reused with its original endpoint and format.
  const endpointChanged =
    !!profile && (!sameProviderEndpoint(profile.base_url ?? "", baseUrl) || profile.format !== format);
  const profileId = profile && !endpointChanged ? Number(profile.id) : undefined;

  function choosePreset(id: string) {
    const preset = LLM_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPresetID(id);
    setName(preset.id === "custom" ? "" : preset.name);
    setFormat(preset.format);
    setBaseUrl(preset.baseURL);
    setModel(preset.model);
    setApiKey(preset.localKey ?? "");
    setKeyHint("");
    setModels([]);
    setThinkingType(NONE);
    setEffort(NONE);
    setSessionHeaderKey("");
    setMaxTokensField(NONE);
    setMaxTokens("4096");
    setCw("32");
    setRpm("10");
    setRps("1");
    setFreeOnly(preset.id === "kafox" || preset.id === "openrouter");
  }

  function validateEndpointCredentials() {
    if ((endpointChanged || !profile) && !apiKey.trim()) {
      toast.error(
        "Informe a chave deste provedor. Para um servidor local sem autenticação, use um valor de identificação local.",
      );
      return false;
    }
    return true;
  }

  async function loadModels() {
    if (loadingModels || !validateEndpointCredentials()) return;
    setLoadingModels(true);
    setModels([]);
    try {
      const r = await api.fetchLLMModels(format, baseUrl, apiKey, proxy, profileId);
      if (r.ok && r.models && r.models.length > 0) {
        setModels(r.models);
        setModelsOpen(true);
        toast.success(`Carregado ${r.models.length} modelos`);
      } else {
        toast.error(`Falha ao carregar modelo:${r.error ?? "Modelo não obtido"}`);
      }
    } catch (e) {
      toast.error(`Erro ao carregar modelo:${(e as Error).message}`);
    } finally {
      setLoadingModels(false);
    }
  }

  async function testConnection(checkTools = false) {
    if (testing || !validateEndpointCredentials()) return;
    setTesting(true);
    try {
      // 用配置实际会跑的思考参数来测，这样不支持该字段的模型在这里就失败，
      // 而不是等到跑任务时才炸。传 profile id：Key 输入框留空时用已存的 Key。
      const r = await api.testLLM(
        format,
        model,
        baseUrl,
        apiKey,
        proxy,
        toStore(thinkingType),
        toStore(effort),
        profileId,
        streaming,
        sessionHeaderKey.trim(),
        checkTools,
        maxTokensField === NONE ? "" : maxTokensField,
      );
      // 回复内容一并展示：看得见模型确实说了话，才算和会话里跑通是一回事。
      if (r.ok)
        toast.success(`Conexão bem sucedida· ${r.latency_ms ?? "?"}ms · ${r.model ?? model}`, {
          description: r.reply ? `Resposta:${r.reply}` : undefined,
        });
      else toast.error(`Falha na conexão:${r.error ?? "Desconhecido"}`);
    } catch (e) {
      toast.error(`Erro de teste:${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!validateEndpointCredentials()) return;
    if (!name.trim() || !model.trim()) {
      toast.error("Por favor preencha o nome e modelo");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const { id } = await api.saveLLMProfile({
        ...(profile ? { id: Number(profile.id) } : {}),
        name: name.trim(),
        format,
        model: model.trim(),
        base_url: baseUrl.trim(),
        proxy: proxy.trim(),
        api_key: apiKey,
        rate_per_second: Number(rps) || 0,
        rate_per_minute: Number(rpm) || 0,
        context_window_k: Number(cw) || 0,
        thinking_type: toStore(thinkingType),
        reasoning_effort: toStore(effort),
        priority: Number(priority) || 0,
        pool_exclude: poolExclude,
        streaming,
        max_tokens: Math.max(0, Number(maxTokens) || 0),
        // 字段名开关只对 openai(Chat Completions) 有意义，其它格式一律回落到默认；
        // 后端也会再做一次同样的归一化，这里只是别让 UI 送出自相矛盾的值。
        max_tokens_field: format === "openai" ? toStore(maxTokensField) : "",
        session_header_key: sessionHeaderKey.trim(),
        retry,
      });
      if (isNew) toast.success(`Recém-criado:${name.trim()}(Definir como ativo no cartão para habilitar)`);
      else
        toast.success(
          profile?.is_default
            ? "Salva, a configuração de ativação entra em vigor imediatamente sem reiniciar"
            : "Salvo",
        );
      onSaved(String(id));
      onOpenChange(false);
    } catch (e) {
      toast.error(`Não foi possível salvar:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:min-w-[420px] data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="px-4">
          <SheetTitle className="flex items-center gap-2">
            {isNew ? "Novo perfil de IA" : `Editar:${profile?.name}`}
            {profile?.is_default && (
              <Badge variant="outline" className="border-amber-400/50 text-amber-500">
                Ativo
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {isNew
              ? "Depois de salvar, clique em Ativar no cartão do perfil que deseja usar."
              : "Salve as alterações. Um perfil ativo passa a usar a nova configuração nas próximas chamadas."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-4">
            <Label htmlFor="provider-preset">Comece pelo seu provedor</Label>
            <Select value={presetID} onValueChange={choosePreset}>
              <SelectTrigger id="provider-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{selectedPreset?.hint}</p>
            {selectedPreset?.documentation && (
              <a className="text-xs underline" href={selectedPreset.documentation} target="_blank" rel="noreferrer">
                Documentação do provedor
              </a>
            )}
            <Button type="button" variant="outline" disabled={testing} onClick={() => void testConnection(true)}>
              {testing ? "Testando…" : "Testar compatibilidade com ferramentas"}
            </Button>
            <p className="text-xs text-muted-foreground">
              O teste consome uma pequena chamada à API. Modelos gratuitos seguem as cotas do serviço; nenhuma troca
              automática cria novas cotas.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-name">Nome</Label>
              <Input
                id="p-name"
                placeholder="Por exemplo: produção OpenAI"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Formato</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as "anthropic" | "openai" | "openai-responses")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI (Chat Completions)</SelectItem>
                  <SelectItem value="openai-responses">OpenAI (Responses API)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />{" "}
              Mostrar apenas IDs gratuitos na lista
            </label>
            <Label htmlFor="p-model">Modelo</Label>
            <div className="flex gap-2">
              <Input
                id="p-model"
                className="font-mono"
                placeholder="claude-opus-4-8"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              {/* modal: 这个 Popover 的内容被 portal 到 <body>，在 Sheet 的滚动锁之外，
                  不加 modal 时列表能渲染却滚不动。modal 让它自己持有最上层滚动锁。 */}
              <Popover open={modelsOpen} onOpenChange={setModelsOpen} modal>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={loadingModels}
                    onClick={loadModels}
                    title="Carregando modelos disponíveis da API"
                  >
                    {loadingModels ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
                  </Button>
                </PopoverTrigger>
                {models.length > 0 && (
                  <PopoverContent className="max-h-72 w-72 gap-0 overflow-y-auto overscroll-contain p-1" align="end">
                    {models
                      .filter((m) => !freeOnly || isFreeModelID(m))
                      .map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="w-full shrink-0 rounded-md px-2 py-1.5 text-left font-mono text-xs hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setModel(m);
                            setModelsOpen(false);
                          }}
                        >
                          {m}
                        </button>
                      ))}
                  </PopoverContent>
                )}
              </Popover>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-base-url">URL base (opcional)</Label>
            <Input
              id="p-base-url"
              className="font-mono"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-proxy">Proxy (opcional)</Label>
            <Input
              id="p-proxy"
              className="font-mono"
              placeholder="socks5://user:pass@127.0.0.1:1080 · http://127.0.0.1:8080"
              value={proxy}
              onChange={(e) => setProxy(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Somente solicitações de saída LLM passam por esse proxy. Ele suporta http/https/socks5 e pode trazer a
              senha da conta (como meias5://usuário:pass@host:porta, a senha contém caracteres especiais e requer
              codificação de URL); deixar em branco significa não usar proxy (conexão direta).
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-session-header">Cabeçalho de sessão personalizado (opcional)</Label>
            <Input
              id="p-session-header"
              className="font-mono"
              placeholder="Como x-session-id (deixe em branco = não envie)"
              value={sessionHeaderKey}
              onChange={(e) => setSessionHeaderKey(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Após preencher o nome do cabeçalho, cada solicitação trará esse cabeçalho HTTP, e o valor do cabeçalho é
              preenchido automaticamente como <b>O ID da sessão atual</b>(conversa de bate-papo como conv-12,
              trabalhador como exp3-worker-i87). Usado para cache de prompt com base no cabeçalho de ID de sessão/ O
              gateway do roteamento fixo; a mesma sessão é estável para várias rodadas e sessões diferentes são
              diferentes umas das outras. Deixe em branco para não enviar.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="p-api-key">API Key</Label>
            <Input
              id="p-api-key"
              type="password"
              placeholder={keyHint ? `está definido (${keyHint}), deixe em branco e permaneça inalterado` : "sk-…"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="p-rps">Limite de velocidade por segundo</Label>
              <Input id="p-rps" type="number" min={0} value={rps} onChange={(e) => setRps(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-rpm">Limite de velocidade por minuto</Label>
              <Input id="p-rpm" type="number" min={0} value={rpm} onChange={(e) => setRpm(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-cw">Janela de contexto (K)</Label>
              <Input
                id="p-cw"
                type="number"
                min={0}
                max={1000}
                value={cw}
                onChange={(e) => setCw(e.target.value)}
                placeholder="200"
              />
            </div>
          </div>
          <p className="-mt-2 text-muted-foreground text-xs">
            Limite de velocidade 0 = Sem limite, compartilhado por todos os Agentes. Unidade de janela de contexto K
            (mil tokens), 0 = padrão 200K, limite superior 1000 (ou seja, 1 milhão); defini-lo muito alto fará com que a
            compressão não seja acionada.
          </p>

          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="grid gap-0.5">
                <Label htmlFor="p-priority" className="text-sm">
                  Prioridade de sondagem
                </Label>
                <p className="text-muted-foreground text-xs">
                  Quanto maior o número, o primeiro a ser selecionado; a configuração ativada é sempre a primeira,
                  independente deste valor. As configurações com a mesma prioridade serão iniciadas alternadamente e a
                  cota será compartilhada naturalmente.
                </p>
              </div>
              <Input
                id="p-priority"
                type="number"
                className="w-24 shrink-0"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-3">
              <div className="grid gap-0.5">
                <Label className="text-sm">Não participe de votações</Label>
                <p className="text-muted-foreground text-xs">
                  Quando ativado, não será usado como destino de failover (ainda pode ser especificado explicitamente
                  pelo Agente/Tarefa). Adequado para &quot;apenas para um determinado Agente&quot; Configuração cara que
                  é apenas para uso pessoal e não quer ser queimada quando outras falharem.
                </p>
              </div>
              <Switch checked={poolExclude} onCheckedChange={setPoolExclude} aria-label="Não participe de votações" />
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-3">
              <div className="grid gap-0.5">
                <Label className="text-sm">Saída de streaming · streaming</Label>
                <p className="text-muted-foreground text-xs">
                  Ative o SSE de streaming (padrão), com progresso em tempo real e contagem de tokens em tempo real
                  durante a operação. Se fechado, vá para verdadeiro/não streaming (stream:false, retorna uma resposta
                  completa de uma só vez) - pode contornar a má implementação de SSE de alguns gateways (quadros
                  vazios/perda de quadro de campo de pensamento), tem o custo de perder o progresso em tempo real
                  durante a execução.
                </p>
              </div>
              <Switch checked={streaming} onCheckedChange={setStreaming} aria-label="Saída de streaming" />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="grid gap-0.5">
                <Label htmlFor="p-max-tokens" className="text-sm">
                  Limite superior de saída · máximo de tokens
                </Label>
                <p className="text-muted-foreground text-xs">
                  O número máximo de tokens gerados para uma única resposta é enviado com cada solicitação. 0 (padrão) =
                  Não enviar este campo, determinado pelo valor padrão do servidor. Isso é diferente da &quot;janela de
                  contexto&quot; acima: é a capacidade total do modelo, que é usada apenas localmente para calcular o
                  limite de compactação. Se for definido como muito pequeno, o modelo de inferência será truncado
                  durante a fase de reflexão e nenhuma resposta será dada.
                </p>
              </div>
              <Input
                id="p-max-tokens"
                type="number"
                min={0}
                className="w-28 shrink-0"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-3">
              <div className="grid gap-0.5">
                <Label className="text-sm">Nome do campo limite superior</Label>
                <p className="text-muted-foreground text-xs">{MAX_TOKENS_FIELD_HINTS[format]}</p>
              </div>
              <Select
                value={format === "openai" ? maxTokensField : NONE}
                onValueChange={setMaxTokensField}
                disabled={format !== "openai"}
              >
                <SelectTrigger className="w-56 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAX_TOKENS_FIELDS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="grid gap-0.5">
                <Label className="text-sm">Raciocínio · thinking.type</Label>
                <p className="text-muted-foreground text-xs">
                  Controla se o campo de pensamento é enviado. Não enviar = não incluir este campo (compatível com
                  modelos como MiniMax que não suportam ); fechar = enviar desativado; habilitado. Independente da
                  intensidade abaixo.
                </p>
              </div>
              <Select value={thinkingType} onValueChange={setThinkingType}>
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THINKING_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-3">
              <div className="grid gap-0.5">
                <Label className="text-sm">Intensidade de raciocínio · reasoning_effort</Label>
                <p className="text-muted-foreground text-xs">
                  Engrenagem de intensidade independente (OpenAI reasoning_effort / Anthropic output_config.effort).
                  Algumas interfaces não pensam O campo pode ativar o pensamento apenas pela força, portanto pode ser
                  definido separadamente sem enviar o interruptor de pensamento.
                </p>
              </div>
              <Select value={effort} onValueChange={setEffort}>
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFORT_LEVELS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ProfileRetryFields value={retry} onChange={setRetry} />
        </div>

        <div className="flex gap-2 border-t px-4 py-3">
          <Button variant="outline" onClick={() => void testConnection()} disabled={testing}>
            {testing ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />}
            {testing ? "Testando..." : "Testar conexão"}
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving && <Loader2Icon className="animate-spin" />}
            {!saving && (isNew ? <PlusIcon /> : <SaveIcon />)}
            {isNew ? "Novo" : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LLMPage() {
  const [profiles, setProfiles] = React.useState<LLMProfile[]>([]);
  const [pool, setPool] = React.useState<LLMPoolStatus | null>(null);
  const [poolOpen, setPoolOpen] = React.useState(false);
  // 抽屉的开关和内容分开存：关闭时 editing 保持不变，否则关闭动画期间标题会从
  // 「编辑 X」闪成「新建」。editing = null 表示新建。
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LLMProfile | null>(null);
  const openEditor = React.useCallback((p: LLMProfile | null) => {
    setEditing(p);
    setEditOpen(true);
  }, []);

  const loadPool = React.useCallback(async () => {
    try {
      setPool(await api.llmPool());
    } catch {
      /* ignore */
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      setProfiles(await api.llmProfiles());
    } catch {
      /* ignore */
    }
    await loadPool();
  }, [loadPool]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // 卡片上的健康徽章按 profile id 取轮询状态。
  const health = React.useMemo(() => {
    const m = new Map<string, LLMPoolMember>();
    for (const c of pool?.chain ?? []) m.set(c.profile_id, c);
    return m;
  }, [pool]);

  async function activate(id: string, name: string) {
    try {
      await api.activateLLMProfile(id);
      toast.success(`Ativado:${name}`);
      await load();
    } catch (e) {
      toast.error(`Falha na ativação:${(e as Error).message}`);
    }
  }

  async function remove(p: LLMProfile) {
    if (p.is_default) {
      toast.error("Não é possível excluir a configuração atualmente ativa");
      return;
    }
    try {
      await api.deleteLLMProfile(p.id);
      toast.success(`Excluído:${p.name}`);
      await load();
    } catch (e) {
      toast.error(`Falha na exclusão:${(e as Error).message}`);
    }
  }

  const poolOn = pool?.enabled ?? false;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-xl tracking-tight">LLM</h1>
          <p className="text-muted-foreground text-sm">
            Configuração de formato/modelo/limite de taxa compartilhada por todos os Agentes. Clique em Editar cartão, a
            estrela indica a configuração atualmente ativada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPoolOpen(true)}>
            <ZapIcon /> Configuração de sondagem
            {poolOn && (
              <Badge variant="outline" className="ml-1 border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
                ativado
              </Badge>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openEditor(null)}>
            <PlusIcon /> Novo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profiles" className="flex-1">
        <TabsList>
          <TabsTrigger value="profiles">Configuração do modelo</TabsTrigger>
          <TabsTrigger value="retry">Nova tentativa e retirada</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((p) => {
              const h = healthOf(p, health.get(p.id));
              return (
                // biome-ignore lint/a11y/useSemanticElements: 卡片内含自己的操作按钮，用原生 <button> 会造成按钮嵌套（非法 HTML）
                <Card
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditor(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEditor(p);
                    }
                  }}
                  className={cn(
                    "cursor-pointer gap-0 py-4 outline-none transition-colors hover:border-foreground/30",
                    p.is_default && "border-amber-400/50 bg-amber-400/5",
                  )}
                >
                  <CardContent className="grid gap-2 px-4">
                    <div className="flex items-start gap-2">
                      <StarIcon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          p.is_default ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-sm">{p.name}</span>
                          <Badge variant="outline" className="uppercase">
                            {p.format}
                          </Badge>
                          <Badge variant="outline" className={cn("ml-auto", h.cls)} title={h.hint}>
                            {h.label}
                          </Badge>
                        </div>
                        <code className="mt-1 block truncate font-mono text-muted-foreground text-xs">{p.model}</code>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-6 text-muted-foreground text-xs">
                      {p.api_key_hint && <span>{p.api_key_hint}</span>}
                      <span>
                        {p.rate_per_second}/s · {p.rate_per_minute}/min
                      </span>
                      {p.proxy && <span className="truncate">Agente {p.proxy}</span>}
                      {p.reasoning_effort && (
                        <span>Pensando {p.reasoning_effort === "off" ? "desligado" : p.reasoning_effort}</span>
                      )}
                      {/* 轮询相关的两个字段只在轮询开着时才有意义，关着时不占版面 */}
                      {poolOn &&
                        !p.is_default &&
                        (p.pool_exclude ? (
                          <span>Não participe de votações</span>
                        ) : (
                          <span>Prioridade {p.priority ?? 0}</span>
                        ))}
                    </div>

                    <div className="mt-1 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={p.is_default}
                        onClick={(e) => {
                          e.stopPropagation();
                          void activate(p.id, p.name);
                        }}
                      >
                        {p.is_default ? "Ativado" : "Definir como ativo"}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="Excluir configuração"
                        onClick={(e) => {
                          e.stopPropagation();
                          void remove(p);
                        }}
                      >
                        <Trash2Icon className="text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {profiles.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
                Ainda não há configuração de modelo, clique em “Novo” no canto superior direito para criar o primeiro.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="retry" className="mt-4">
          <RetryPolicyPanel />
        </TabsContent>
      </Tabs>

      <ProfileSheet profile={editing} open={editOpen} onOpenChange={setEditOpen} onSaved={() => void load()} />
      <PoolSheet open={poolOpen} onOpenChange={setPoolOpen} pool={pool} onReload={loadPool} />
    </div>
  );
}
