"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [available, setAvailable] = React.useState(false);
  React.useEffect(() => {
    if (auth.getToken()) {
      window.location.replace("/getting-started");
      return;
    }
    api
      .authStatus()
      .then(({ initialized }) => {
        if (!initialized) {
          router.replace("/setup");
          return;
        }
        setAvailable(true);
      })
      .catch(() => setError("Não foi possível conectar ao backend. Verifique se o ARTEX está em execução."))
      .finally(() => setChecking(false));
  }, [router]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !available) return;
    setBusy(true);
    setError("");
    try {
      const { token } = await api.login("ARTEX", password);
      auth.setToken(token);
      window.location.replace("/getting-started");
    } catch {
      setError("Não foi possível entrar. Confira a senha e a conexão com o backend.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r bg-gradient-to-br from-primary/15 via-background to-background p-12 lg:flex">
        <div className="text-sm font-semibold tracking-[.25em]">
          ARTEX <span className="text-muted-foreground">PT-BR</span>
        </div>
        <div className="max-w-lg">
          <ShieldCheck className="mb-8 size-12 text-primary" />
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Seu ambiente de testes.
            <br />
            Seu fluxo de trabalho.
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Provedores de IA, tarefas, escopo e evidências organizados em uma interface em português.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Backend em Go · Interface em Next.js · Licença AGPL-3.0</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="mb-8 text-sm font-semibold tracking-[.2em] lg:hidden">ARTEX PT-BR</p>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-primary">Acesso ao console</p>
          <h2 className="text-3xl font-semibold tracking-tight">Bem-vindo de volta.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Use a senha definida na configuração inicial.</p>
          <form className="mt-8 grid gap-5" onSubmit={login}>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Senha de acesso</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={visible ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={checking || busy}
                  className="pr-11"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={checking || busy || !available || !password}>
              {checking ? "Verificando conexão…" : busy ? "Entrando…" : "Entrar no console"}
              <ArrowRight className="size-4" />
            </Button>
          </form>
          {!checking && !available && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          )}
          <p className="mt-8 text-xs leading-6 text-muted-foreground">
            Use este ambiente apenas em laboratórios e ativos para os quais você tenha autorização. Respeite o escopo e
            as regras de cada programa.
          </p>
          <a
            className="mt-4 inline-block text-xs text-muted-foreground underline"
            href="https://github.com/CarlosMarchetti/ARTEX/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            Código aberto · Licença AGPL-3.0
          </a>
        </div>
      </section>
    </main>
  );
}
