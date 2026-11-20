export type ProviderFormat = "anthropic" | "openai" | "openai-responses";
export interface LLMPreset {
  id: string;
  name: string;
  format: ProviderFormat;
  baseURL: string;
  model: string;
  hint: string;
  documentation: string;
  localKey?: string;
}

// Model IDs are intentionally editable: provider availability and free quotas
// change independently of an ARTEX release. Never embed a real API key here.
export const LLM_PRESETS: readonly LLMPreset[] = [
  {
    id: "kafox",
    name: "Kafox — modelos gratuitos",
    format: "openai",
    baseURL: "https://api.kafox.dev/v1",
    model: "kafox-free",
    hint: "Use sua chave Kafox e o ID completo do modelo, incluindo (free) ou :free. A cota gratuita é compartilhada pela conta. Teste o suporte a ferramentas antes de iniciar tarefas.",
    documentation: "https://kafox.dev/docs",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    format: "openai",
    baseURL: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    hint: "O catálogo contém opções gratuitas e pagas. Verifique o modelo, o suporte a ferramentas e a cota da sua conta.",
    documentation: "https://openrouter.ai/docs/api/reference/overview",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    format: "openai",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "",
    hint: "Informe a chave do Google AI Studio e selecione um modelo disponível na sua conta. A disponibilidade da cota gratuita varia por modelo.",
    documentation: "https://ai.google.dev/gemini-api/docs/openai",
  },
  {
    id: "groq",
    name: "Groq",
    format: "openai",
    baseURL: "https://api.groq.com/openai/v1",
    model: "",
    hint: "Busque os modelos da sua conta. Limites de requisições e tokens dependem do modelo e do plano.",
    documentation: "https://console.groq.com/docs/openai",
  },
  {
    id: "ollama",
    name: "Ollama local",
    format: "openai",
    baseURL: "http://localhost:11434/v1",
    model: "",
    localKey: "ollama",
    hint: "Sem cobrança de API; utiliza seu hardware. Em Docker, substitua localhost por host.docker.internal. Escolha um modelo com suporte a ferramentas.",
    documentation: "https://docs.ollama.com/api/openai-compatibility",
  },
  {
    id: "lmstudio",
    name: "LM Studio local",
    format: "openai",
    baseURL: "http://localhost:1234/v1",
    model: "",
    localKey: "lm-studio",
    hint: "Ative o servidor local no LM Studio. Em Docker, use host.docker.internal. Se o servidor exigir autenticação, substitua a chave de exemplo.",
    documentation: "https://lmstudio.ai/docs/developer/openai-compat",
  },
  {
    id: "openai",
    name: "OpenAI",
    format: "openai",
    baseURL: "https://api.openai.com/v1",
    model: "",
    hint: "Requer uma chave de API com acesso ao modelo escolhido; uma assinatura de chat não configura a API.",
    documentation: "https://platform.openai.com/docs/api-reference",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    format: "anthropic",
    baseURL: "https://api.anthropic.com",
    model: "",
    hint: "Informe a chave de API e selecione um modelo disponível.",
    documentation: "https://docs.anthropic.com",
  },
  {
    id: "custom",
    name: "Outro serviço / gateway compatível",
    format: "openai",
    baseURL: "",
    model: "",
    hint: "Informe a URL base, a chave e o ID do modelo fornecidos pelo serviço. Compatibilidade com chat não garante chamadas de ferramentas.",
    documentation: "",
  },
];

export function sameProviderEndpoint(a: string, b: string): boolean {
  return a.trim().replace(/\/+$/, "") === b.trim().replace(/\/+$/, "");
}

export function isFreeModelID(model: string): boolean {
  return model === "kafox-free" || model === "openrouter/free" || /(?:\(free\)|:free)$/.test(model);
}
