import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { VyraLogo } from "@/components/VyraLogo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "login" | "signup";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/feed" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("As senhas não coincidem");
    if (password.length < 6) return toast.error("Senha precisa de no mínimo 6 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/feed`,
        data: { nome, username },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Bem-vindo ao VYRA.");
    navigate({ to: "/feed" });
  }

  async function handleGoogle() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error("Erro no login com Google");
    if (!r.redirected) navigate({ to: "/feed" });
  }

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-gradient-glow opacity-60" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 pt-12 pb-8">
        <div className="flex justify-center mb-8">
          <VyraLogo size={56} />
        </div>

        <div className="mb-6 flex gap-2 rounded-2xl bg-card p-1 border border-border">
          <button onClick={() => setMode("login")} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Entrar</button>
          <button onClick={() => { setMode("signup"); setStep(1); }} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Criar conta</button>
        </div>

        {mode === "signup" && <Stepper step={step} />}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="voce@email.com" />
            <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            <Link to="/auth" className="block text-right text-xs text-primary-light">Esqueci minha senha</Link>
            <PrimaryButton loading={loading}>Entrar</PrimaryButton>
            <Divider />
            <SocialButton onClick={handleGoogle}>Continuar com Google</SocialButton>
            <SocialButton disabled>Continuar com Apple</SocialButton>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <Field label="Nome completo" value={nome} onChange={setNome} placeholder="Seu nome" />
            <Field label="Usuário" value={username} onChange={setUsername} placeholder="@username" />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="voce@email.com" />
            <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />
            <Field label="Confirmar senha" type="password" value={confirm} onChange={setConfirm} placeholder="Repita a senha" />
            <PrimaryButton loading={loading}>Criar conta</PrimaryButton>
            <Divider />
            <SocialButton onClick={handleGoogle}>Continuar com Google</SocialButton>
          </form>
        )}
      </div>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Dados", "Perfil", "Objetivos"];
  return (
    <div className="mb-6 flex items-center justify-between gap-2">
      {labels.map((l, i) => {
        const idx = i + 1;
        const active = idx <= step;
        return (
          <div key={l} className="flex flex-1 flex-col items-center gap-1">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-gradient-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}>{idx}</div>
            <span className={`text-[10px] ${active ? "text-foreground" : "text-muted-foreground"}`}>{l}</span>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        required
      />
    </label>
  );
}

function PrimaryButton({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">ou</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function SocialButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-3xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
    >
      {children}
    </button>
  );
}
