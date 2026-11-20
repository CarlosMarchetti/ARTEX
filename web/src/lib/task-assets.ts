import type { NewAssetType } from "@/lib/types";

const ASSET_TYPE_LABELS: Record<NewAssetType, string> = {
  app: "Aplicação",
  endpoint: "Interface",
  ip: "IP",
  root_domain: "Nome de domínio raiz",
  service: "Serviço",
  subdomain: "Nome do subdomínio",
};

const TASK_ASSET_SOURCE_LABELS: Record<string, string> = {
  agent: "Descoberta de agente",
  anchor: "Ponto de ancoragem do quadro negro",
  api: "API de ativos",
  company: "Associação empresarial",
  legacy: "Associação histórica",
  manual: "Adição manual",
  system: "Associação de sistema",
  task: "Inicialização de tarefa",
};

export function taskAssetTypeLabel(type: NewAssetType): string {
  return ASSET_TYPE_LABELS[type];
}

export function taskAssetSourceLabel(source: string): string {
  return TASK_ASSET_SOURCE_LABELS[source] ?? source;
}
