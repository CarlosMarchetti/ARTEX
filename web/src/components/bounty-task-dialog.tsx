"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bug, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { LLMProfile } from "@/lib/types";

const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export function BountyTaskDialog({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [program, setProgram] = React.useState("");
  const [scope, setScope] = React.useState("");
  const [excluded, setExcluded] = React.useState("");
  const [restrictions, setRestrictions] = React.useState("");
  const [context, setContext] = React.useState("");
  const [minutes, setMinutes] = React.useState("15");
  const [profileID, setProfileID] = React.useState("");
  const [profiles, setProfiles] = React.useState<LLMProfile[]>([]);
  const [authorized, setAuthorized] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    api
      .llmProfiles()
      .then(setProfiles)
      .catch(() => setError("Não foi possível carregar os provedores. Verifique a conexão com o backend."));
  }, [open]);
  function next() {
    if (!program.trim() || !lines(scope).length) {
      setError("Informe o programa e ao menos um ativo permitido.");
      return;
    }
    setError("");
    setStep(1);
  }
  async function create() {
    if (!authorized || !profileID || busy) return;
    const duration = Number(minutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 120) {
      setError("Escolha uma duração entre 1 e 120 minutos.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const task = await api.createTask({
        name: program.trim(),
        description: context.trim(),
        goal: "Identificar e reproduzir falhas dentro do escopo autorizado, separar suspeitas de achados comprovados e produzir um relatório com evidências e passos de reprodução em português.",
        llmProfileIds: [Number(profileID)],
        timeoutSeconds: duration * 60,
        coverageEnabled: true,
        seedFirstIntent: false,
        bountyPolicy: {
          program: program.trim(),
          in_scope: lines(scope),
          out_of_scope: lines(excluded),
          restrictions: restrictions.trim(),
          authorized,
        },
      });
      toast.success("Tarefa criada com o escopo registrado.");
      setOpen(false);
      setStep(0);
      onCreated?.();
      router.push(`/function/tasks/detail?id=${encodeURIComponent(task.id)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível criar a tarefa.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Bug /> Novo teste guiado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step === 0 ? "Defina o programa e o escopo" : "Revise antes de iniciar"}</DialogTitle>
          <DialogDescription>Passo {step + 1} de 2 · Pentest e bug bounty</DialogDescription>
        </DialogHeader>
        {step === 0 ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bounty-program">Programa ou laboratório</Label>
              <Input
                id="bounty-program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                maxLength={200}
                placeholder="Nome do programa"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bounty-scope">Ativos permitidos · um por linha</Label>
              <Textarea
                id="bounty-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder={"app.example.com\nhttps://api.example.com/v1\n*.sandbox.example.com"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bounty-excluded">Fora de escopo · um por linha</Label>
              <Textarea
                id="bounty-excluded"
                value={excluded}
                onChange={(e) => setExcluded(e.target.value)}
                placeholder="payments.example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bounty-rules">Restrições e limites do programa</Label>
              <Textarea
                id="bounty-rules"
                value={restrictions}
                onChange={(e) => setRestrictions(e.target.value)}
                maxLength={10000}
                placeholder="Cole aqui as regras, os horários e os limites de requisições do programa."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bounty-context">Contexto adicional</Label>
              <Textarea
                id="bounty-context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Ambiente, contas de teste e funcionalidades a revisar."
              />
            </div>
            <Button onClick={next}>
              Revisar configuração <ChevronRight />
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <strong>{program}</strong>
              <p className="mt-2">Permitidos: {lines(scope).join(", ")}</p>
              <p className="mt-1">Excluídos: {lines(excluded).join(", ") || "Nenhum informado"}</p>
              {restrictions && <p className="mt-2 whitespace-pre-wrap">{restrictions}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bounty-profile">Provedor e modelo</Label>
              <select
                id="bounty-profile"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={profileID}
                onChange={(e) => setProfileID(e.target.value)}
              >
                <option value="">Selecione um perfil configurado</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} · {profile.model}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Use um perfil aprovado no teste de ferramentas. Configure cotas em Provedores de IA.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bounty-duration">Duração máxima em minutos</Label>
              <Input
                id="bounty-duration"
                type="number"
                min={1}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              O escopo e as restrições serão registrados nas instruções da tarefa. Eles não substituem isolamento de
              rede: ferramentas de terminal podem fazer conexões diretas. Revise as regras de aprovação antes de usar um
              ambiente real.
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
              />{" "}
              Confirmei o escopo e as regras do programa e tenho autorização para estes testes.
            </label>
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button disabled={busy || !authorized || !profileID} onClick={() => void create()}>
                {busy ? "Criando…" : "Criar e iniciar teste"}
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
