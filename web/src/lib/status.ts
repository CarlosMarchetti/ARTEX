// Centralised status → color/label semantics, reused across the whole app.
// Spec §8.3: 意图 / 覆盖 / 任务 / 严重度 each have a consistent color set.

export type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "rose" | "violet" | "slate";

export const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  red: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  // rose 用作「严重」——实心高强调,视觉上明显高于「高危」的软红描边。
  rose: "bg-rose-600 text-white border-rose-600 dark:bg-rose-600 dark:text-white",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

export const toneDot: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  rose: "bg-white",
  violet: "bg-violet-500",
  slate: "bg-slate-500",
};

interface StatusMeta {
  label: string;
  tone: Tone;
}

const intent: Record<string, StatusMeta> = {
  open: { label: "Pendente", tone: "slate" },
  running: { label: "Executando", tone: "blue" },
  paused: { label: "Pausado", tone: "amber" },
  done: { label: "Concluído", tone: "green" },
  // blocked = 模型/API/网络故障重试用尽，这条意图基本没真正探成（非目标拦截）。
  blocked: { label: "Erro de execução", tone: "red" },
  // exhausted = 达到步数/时间预算被中途掐断、只写回部分结果（非方向已探尽）。
  exhausted: { label: "Orçamento esgotado", tone: "violet" },
  // stopped = 历史软删除状态（保留,历史数据）。
  stopped: { label: "Parado", tone: "slate" },
  // deleted = 用户假删除了该意图（保留节点与血缘，删除原因见 delete_reason 字段）。
  deleted: { label: "Excluído", tone: "slate" },
};

const task: Record<string, StatusMeta> = {
  created: { label: "Criada", tone: "slate" },
  queued: { label: "Na fila", tone: "amber" },
  running: { label: "Em execução", tone: "blue" },
  paused: { label: "Pausado", tone: "amber" },
  done: { label: "Concluído", tone: "green" },
  failed: { label: "Falha", tone: "red" },
  timeout: { label: "Tempo limite esgotado", tone: "amber" },
};

const severity: Record<string, StatusMeta> = {
  critical: { label: "Crítica", tone: "rose" },
  high: { label: "Alta", tone: "red" },
  medium: { label: "Média", tone: "amber" },
  low: { label: "Baixa", tone: "slate" },
};

const finding: Record<string, StatusMeta> = {
  pending: { label: "Pendente", tone: "amber" },
  in_progress: { label: "Em análise", tone: "blue" },
  confirmed: { label: "Confirmado", tone: "red" },
  resolved: { label: "Tratado", tone: "green" },
  fixed: { label: "Corrigido", tone: "green" },
  false_positive: { label: "Falso positivo", tone: "slate" },
  ignored: { label: "Ignorado", tone: "neutral" },
  duplicate: { label: "Duplicado", tone: "neutral" },
  risk_accepted: { label: "Risco aceito", tone: "violet" },
};

const engine: Record<string, StatusMeta> = {
  exploring: { label: "Em exploração", tone: "blue" },
  paused: { label: "Pausado", tone: "amber" },
  stalled: { label: "Sem progresso", tone: "red" },
  idle: { label: "Ocioso", tone: "neutral" },
};

const goal: Record<string, StatusMeta> = {
  open: { label: "Em andamento", tone: "blue" },
  met: { label: "Alcançado", tone: "green" },
  abandoned: { label: "Abandonado", tone: "slate" },
};

const audit: Record<string, StatusMeta> = {
  allow: { label: "Permitido", tone: "green" },
  block: { label: "Bloqueado", tone: "red" },
};

const node: Record<string, StatusMeta> = {
  observed: { label: "Observação", tone: "slate" },
  confirmed: { label: "Confirmar", tone: "green" },
  tombstoned: { label: "Abandonado", tone: "neutral" },
};

// 推送投递状态。sending 用 blue 而不是 amber：它不是「有问题」，
// 而是「已被领取、正在发」，与 pending 的等待语义要能区分开。
const delivery: Record<string, StatusMeta> = {
  pending: { label: "A ser enviado", tone: "amber" },
  sending: { label: "Envio", tone: "blue" },
  sent: { label: "Entregue", tone: "green" },
  failed: { label: "Falha", tone: "red" },
  skipped: { label: "ignorado", tone: "neutral" },
};

const maps = {
  intent,
  task,
  severity,
  finding,
  engine,
  goal,
  audit,
  node,
  delivery,
} as const;

export type StatusDomain = keyof typeof maps;

export function statusMeta(domain: StatusDomain, key: string): StatusMeta {
  return maps[domain][key] ?? { label: key, tone: "neutral" };
}
