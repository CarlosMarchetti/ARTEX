"use client";

// LLM 重试配置的共用件：五层重试各自的「次数 + 间隔」。
//
// 五层从内到外：建连(SDK) → 空响应(SDK) → 同 provider 安全窗口 → 轮询熔断 → 意图重跑。
// 前三层跟着端点走，所以每个模型配置都能覆盖全局默认；后两层是进程级的，只有全局一份。
//
// 所有输入都遵循同一套「留空 = 不配置」语义，与后端 db.RetryRule 一致：
//   次数   空/0 = 用内置默认 | -1 = 关闭这层重试 | >0 = 用这个次数
//   间隔   空/0 = 用这层原本的指数退避 | >0 = 改用这个固定毫秒间隔

import * as React from "react";

import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { LLMRetryOverride, LLMRetryPolicy, LLMRetryRule } from "@/lib/types";

export const ZERO_RULE: LLMRetryRule = { attempts: 0, interval_ms: 0 };
export const ZERO_OVERRIDE: LLMRetryOverride = {
  connect: ZERO_RULE,
  empty: ZERO_RULE,
  stream: ZERO_RULE,
};
const ZERO_POLICY: LLMRetryPolicy = {
  ...ZERO_OVERRIDE,
  breaker: ZERO_RULE,
  intent: ZERO_RULE,
};

type LayerMeta = {
  title: string;
  /** 这层重试发生在哪、由谁执行 */
  where: string;
  /** 什么样的错误会走到这层——具体到状态码，别让人猜 */
  trigger: string;
  /** 长得像但【不】走这层的错误，省得填了没反应还以为是 bug */
  skips?: string;
  desc: string;
  attemptsLabel: string;
  /** 次数留空时的默认值，用于占位符 */
  defAttempts: number;
  /** 间隔留空时的默认策略，用于占位符 */
  defInterval: string;
  /** 次数填 -1 的含义 */
  offHint: string;
};

export const RETRY_LAYERS = {
  connect: {
    title: "Tente estabelecer conexão novamente",
    where: "SDK · Antes de obter 200",
    trigger:
      "Não é possível conectar ou não obter 200: redefinição de conexão/tempo limite de leitura/gravação/falha de DNS e outros erros de camada de rede, bem como HTTP 408, 429, 500, 502, 503, 504.",
    skips: "Os códigos de status restantes (400/401/403/404/413/422, etc.) são todos rejeições determinísticas, e o reenvio também falhará e será lançado diretamente.",
    desc: "Reenvie a mesma solicitação como está. Uma vez iniciado o fluxo (obtido 200), se for desconectado no meio, não pertencerá a esta camada de gerenciamento.",
    attemptsLabel: "Número de novas tentativas",
    defAttempts: 3,
    defInterval: "Índice de 0,5s→1s→2s (limitado a 8s)",
    offHint: "-1 = Não tente novamente uma vez, vomite imediatamente se falhar",
  },
  empty: {
    title: "Nova tentativa de resposta vazia",
    where: "SDK · somente formato openai",
    trigger:
      "HTTP 200, finish_reason é uma parada normal, mas a resposta inteira não tem um bloco de conteúdo - o quadro vazio do gateway, a perda do quadro do campo de pensamento e o soluço de amostragem ficarão todos assim.",
    skips: "Aqueles que não possuem conteúdo devido ao truncamento de max_tokens não são contados (isso precisa ser resolvido aumentando o limite superior de saída, e a retransmissão só causará outra colisão).",
    desc: "Reenviar todo o prompt, portanto fica mais caro em contextos longos, e o número de vezes não deve ser grande.",
    attemptsLabel: "Número de novas tentativas",
    defAttempts: 2,
    defInterval: "Índice de 0,5s→1s→2s (limitado a 8s)",
    offHint: "-1 = A resposta vazia é entregue diretamente como está",
  },
  stream: {
    title: "Tentar novamente com janela de segurança do provedor",
    where: "Este projeto · Antes da entrega e saída",
    trigger:
      "O problema ocorreu após o fluxo ter sido estabelecido (200 foi obtido): a conexão foi desconectada no meio do caminho, o provedor estava sobrecarregado, eventos de erro 429/5xx dentro do fluxo - e nenhum token foi entregue ao chamador.",
    skips:
      "Cota esgotada (402/insufficient_quota, entregue para sondagem para configuração), contexto muito longo (413/comprimento do contexto, entregue para compactação), rejeição determinística 400/401/403/404/422, sem nova tentativa.",
    desc: "Reproduza a mesma solicitação na mesma configuração. A reprodução não repete a saída do modelo ou a execução da ferramenta porque nenhuma saída foi entregue ainda.",
    attemptsLabel: "Número de novas tentativas",
    defAttempts: 2,
    defInterval: "Índice de 0,5s→1s (limitado a 4s)",
    offHint: "-1 = Corte o fluxo e entregue-o diretamente à camada externa para nova execução.",
  },
  breaker: {
    title: "Fusível de sondagem",
    where: "Este projeto·Nível de processo, cópia global",
    trigger:
      "Falhas instantâneas (429, 5xx, erros de rede) são eliminadas quando se acumulam continuamente até o limite; saldo insuficiente (402), invalidação de chave (401/403), modelo não existe (404) tais falhas determinísticas não olham para o limite e são explodidas na primeira vez.",
    skips: "Ele será apagado assim que for bem-sucedido, de modo que a configuração com correntes de ar ocasionais não será acumulada lentamente até que se funda.",
    desc: "Entrar no resfriamento após o fusível ser quebrado, e a pesquisa durante o período de resfriamento ignora diretamente esta configuração. O status é colocado na biblioteca e não será perdido após a reinicialização.",
    attemptsLabel: "Falha diversas vezes seguidas",
    defAttempts: 3,
    defInterval: "Gradiente de 1min→5min→30min",
    offHint: "-1 = Nunca explode em falha instantânea (ainda explode em falha determinística)",
  },
  intent: {
    title: "Intenção de executar novamente",
    where: "Este projeto·Nível de processo, cópia global",
    trigger:
      "As primeiras camadas não são capturadas: o trabalhador termina com model_error - todas as novas tentativas da camada interna são esgotadas ou o fluxo é interrompido após ter começado a entregar a saída (nesse momento, a reprodução não é segura e todo o fluxo só pode ser reiniciado).",
    skips: "O esgotamento da cota foi processado por polling para configuração, e não será executado novamente aqui; a tarefa cederá imediatamente quando for suspensa/encerrada/entra no final e não ocupará o tempo de espera.",
    desc: "Execute toda a intenção desde o início novamente. É a camada mais externa. Uma nova execução significa que os tempos das camadas internas serão multiplicados novamente.",
    attemptsLabel: "Número de repetições",
    defAttempts: 2,
    defInterval: "3s fixos",
    offHint: "-1 = Sem repetição, a intenção é diretamente julgada como bloqueada",
  },
} satisfies Record<string, LayerMeta>;

type LayerKey = keyof typeof RETRY_LAYERS;

/** 毫秒的人话，只用于在输入框旁边回显，免得数零。 */
function humanMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Number((ms / 1000).toFixed(2))}s`;
  return `${Number((ms / 60_000).toFixed(2))}min`;
}

/** 受控数字输入：空串 ↔ 0，中间态（"-"、"1e"）原样留在本地，不打扰父级。 */
function NumField({
  id,
  value,
  onChange,
  placeholder,
  min,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  placeholder: string;
  min: number;
}) {
  const [text, setText] = React.useState(value === 0 ? "" : String(value));
  // 父级换了一整套值（读取到策略、切换配置）时跟上；自己敲字时不会走到这里，
  // 因为那时 value 已经等于本地文本 parse 后的结果。
  React.useEffect(() => {
    const incoming = value === 0 ? "" : String(value);
    setText((cur) => (Number(cur || 0) === value ? cur : incoming));
  }, [value]);
  return (
    <Input
      id={id}
      type="number"
      min={min}
      className="w-28 shrink-0"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        onChange(e.target.value.trim() === "" || !Number.isFinite(n) ? 0 : Math.trunc(n));
      }}
    />
  );
}

/** 一层重试的两个旋钮。idPrefix 用来在同一页出现多次时保住 label 的 htmlFor。 */
export function RetryRuleFields({
  layer,
  idPrefix,
  value,
  onChange,
  compact,
}: {
  layer: LayerKey;
  idPrefix: string;
  value: LLMRetryRule;
  onChange: (r: LLMRetryRule) => void;
  /** true = 配置抽屉里的紧凑版：省掉展开说明，只留「什么错误会走到这层」这一句 */
  compact?: boolean;
}) {
  const meta = RETRY_LAYERS[layer];
  const human = humanMs(value.interval_ms);
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 rounded-lg border p-3"}>
      <div className="grid gap-0.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <Label className="text-sm">{meta.title}</Label>
          <span className="text-muted-foreground text-xs">{meta.where}</span>
        </div>
        {/* 哪些错误会走到这层，具体到状态码——填了旋钮却看不到效果，多半是错误压根不落在这层。 */}
        <p className="text-muted-foreground text-xs">
          <span className="font-medium text-foreground">Gatilho</span>：{meta.trigger}
        </p>
        {!compact && meta.skips && (
          <p className="text-muted-foreground text-xs">
            <span className="font-medium text-foreground">Não ocupe este andar</span>：{meta.skips}
          </p>
        )}
        {!compact && <p className="text-muted-foreground text-xs">{meta.desc}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-${layer}-n`} className="text-muted-foreground text-xs">
            {meta.attemptsLabel}
          </Label>
          <NumField
            id={`${idPrefix}-${layer}-n`}
            min={-1}
            value={value.attempts}
            placeholder={`Padrão ${meta.defAttempts}`}
            onChange={(n) => onChange({ ...value, attempts: n })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-${layer}-ms`} className="text-muted-foreground text-xs">
            intervalo ms
          </Label>
          <NumField
            id={`${idPrefix}-${layer}-ms`}
            min={0}
            value={value.interval_ms}
            placeholder="Espera padrão"
            onChange={(n) => onChange({ ...value, interval_ms: n })}
          />
          <span className="text-muted-foreground text-xs">{human ? `Fixo ${human}` : meta.defInterval}</span>
        </div>
      </div>
      {!compact && <p className="text-muted-foreground text-xs">Deixar em branco = usar padrão;{meta.offHint}。</p>}
    </div>
  );
}

/** 模型配置抽屉里的三层覆盖（跟着端点走的那三层）。 */
export function ProfileRetryFields({
  value,
  onChange,
}: {
  value: LLMRetryOverride;
  onChange: (o: LLMRetryOverride) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <Label className="text-sm">Tentar novamente a cobertura</Label>
        <p className="text-muted-foreground text-xs">
          Só tem efeito para esta configuração, substituindo o padrão global em &quot;Repetição e Retirada&quot;. Deixe cada caixa em branco = acompanhe a situação geral; preencha -1 para o número de vezes = desative esta camada e tente novamente;

 usa intervalos fixos em vez de espera exponencial quando o intervalo é preenchido. Os disjuntores e as repetições de intenção estão no nível do processo e só podem ser ajustados na página global.
        </p>
      </div>
      {(["connect", "empty", "stream"] as const).map((k) => (
        <div key={k} className="border-t pt-3 first:border-t-0 first:pt-0">
          <RetryRuleFields
            compact
            layer={k}
            idPrefix="pf"
            value={value[k]}
            onChange={(r) => onChange({ ...value, [k]: r })}
          />
        </div>
      ))}
    </div>
  );
}

/** 「重试与退避」tab：五层的全局默认值。 */
export function RetryPolicyPanel() {
  const [policy, setPolicy] = React.useState<LLMRetryPolicy>(ZERO_POLICY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.llmRetryPolicy();
      setPolicy({ ...ZERO_POLICY, ...p });
    } catch (e) {
      toast.error(`Falha na política de nova tentativa de leitura:${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      // 后端会把越界值夹回区间并回传，直接用回传值刷新，所见即所存。
      const saved = await api.saveLLMRetryPolicy(policy);
      setPolicy({ ...ZERO_POLICY, ...saved });
      toast.success("Salvo, com efeito imediato (a rodada atual de chamadas ainda usa os parâmetros antigos)");
    } catch (e) {
      toast.error(`Não foi possível salvar:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: LayerKey) => (r: LLMRetryRule) => setPolicy((p) => ({ ...p, [k]: r }));

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-10 text-muted-foreground text-sm">
        <Loader2Icon className="size-4 animate-spin" /> Leia a estratégia de repetição...
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-xs leading-relaxed">
        Uma falha de uma chamada de modelo passará por cinco camadas de novas tentativas em sequência, de dentro para fora:
        <span className="text-foreground"> Estabelecer conexão → Resposta vazia → Igual à janela de segurança do provedor → Disjuntor de polling → Intenção de executar novamente</span>
        . Quando a camada interna se esgota, é a vez da camada externa, então o número de vezes é
        <span className="text-foreground">Multiplicar</span>
        - preencha cada camada e um jitter pode queimar dezenas de solicitações.

 Deixe tudo em branco para ser o valor padrão atual, que é exatamente o mesmo que o comportamento sem esta página. As primeiras três camadas podem ser substituídas individualmente em cada configuração de modelo.
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(RETRY_LAYERS) as LayerKey[]).map((k) => (
          <RetryRuleFields key={k} layer={k} idPrefix="gl" value={policy[k]} onChange={set(k)} />
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Salvar
        </Button>
        <Button variant="outline" onClick={() => setPolicy(ZERO_POLICY)} disabled={saving}>
          Restaurar tudo para o padrão
        </Button>
      </div>
    </div>
  );
}
