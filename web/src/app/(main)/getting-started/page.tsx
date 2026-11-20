"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Cpu, ShieldCheck, FileText, Activity } from "lucide-react";
import { BountyTaskDialog } from "@/components/bounty-task-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function GettingStartedPage() {
  const [connected, setConnected] = React.useState<boolean | null>(null);
  const [models, setModels] = React.useState(0);
  const [error, setError] = React.useState("");
  const refresh = React.useCallback(async () => {
    setError("");
    try {
      const [, profiles] = await Promise.all([api.health(), api.llmProfiles()]);
      setConnected(true);
      setModels(profiles.length);
    } catch {
      setConnected(false);
      setError(
        "Não foi possível consultar o backend. Verifique se o ARTEX está em execução e entre novamente se a sessão expirou.",
      );
    }
  }, []);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);
  const steps = [
    {
      title: "Configure sua IA",
      text: "Escolha Kafox, outro gateway compatível ou um modelo local. Busque os modelos e teste conexão e chamadas de ferramentas.",
      href: "/system/llm",
      label: "Configurar provedores",
      icon: Cpu,
    },
    {
      title: "Revise as aprovações",
      text: "Confira quais operações exigem aprovação humana e ajuste as regras para o programa escolhido.",
      href: "/system/intercept",
      label: "Revisar regras",
      icon: ShieldCheck,
    },
    {
      title: "Acompanhe o teste",
      text: "Veja tarefas, consumo de tokens e execução. Pause a tarefa se precisar revisar uma ação ou preservar a cota da API.",
      href: "/function/tasks",
      label: "Abrir tarefas",
      icon: Activity,
    },
    {
      title: "Revise os achados",
      text: "Valide os passos de reprodução e as evidências antes de submeter um relatório. Suspeitas e respostas da IA precisam de confirmação.",
      href: "/function/findings",
      label: "Revisar achados",
      icon: FileText,
    },
  ];
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-4">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-primary">ARTEX · Português do Brasil</p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Da configuração ao primeiro teste.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          Configure um provedor de IA, defina os ativos autorizados e acompanhe os testes em um só lugar. Comece com um
          laboratório e avance para os programas de bug bounty.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <BountyTaskDialog />
          <Button asChild variant="outline">
            <Link href="/system/llm">
              Configurar minha IA <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          {connected ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <Circle className="size-4 text-muted-foreground" />
          )}{" "}
          Backend {connected === null ? "em verificação" : connected ? "conectado" : "indisponível"}
        </span>
        <span className="text-muted-foreground">{models} perfil(is) de IA configurado(s)</span>
        <Button size="sm" variant="ghost" onClick={() => void refresh()}>
          Verificar novamente
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <Card key={step.href} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="size-4" />
                </span>
                <span>
                  {index + 1}. {step.title}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-start gap-5">
              <p className="flex-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
              <Button asChild variant="outline">
                <Link href={step.href}>
                  {step.label} <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs leading-6 text-muted-foreground">
        A aplicação usa APIs de IA. Sites que oferecem apenas chat no navegador não são provedores compatíveis
        automaticamente. Modelos e cotas gratuitas variam conforme o serviço.
      </p>
    </div>
  );
}
