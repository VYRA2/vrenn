import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { VyraLogo } from "@/components/VyraLogo";
import { toast } from "sonner";
import { ArrowLeft, AtSign, Eye, EyeOff, Lock, Mail, ShieldCheck, User, Loader2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  component: AuthPage,
});

type Mode = "login" | "signup";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const dest = next ?? "/feed";
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

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
    if (dest !== "/feed") window.location.href = dest; else navigate({ to: "/feed" });
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
        emailRedirectTo: `${window.location.origin}${dest}`,
        data: { nome, username },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Bem-vindo ao VRENN.");
    if (dest !== "/feed") window.location.href = dest; else navigate({ to: "/feed" });
  }

  async function handleGoogle() {
    const redirect_uri = `${window.location.origin}${dest}`;
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri });
    if (r.error) return toast.error("Erro no login com Google");
    if (!r.redirected) window.location.href = dest;
  }

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[45vh] bg-gradient-glow opacity-50" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 pt-10 pb-10">
        <button onClick={() => mode === "signup" ? setMode("login") : navigate({ to: "/" })} className="self-start rounded-full p-1.5 text-foreground/90">
          <ArrowLeft size={22} />
        </button>

        <div className="mt-4 flex flex-col items-center">
          <VyraLogo size={72} vertical />
        </div>

        {mode === "login" ? (
          <>
            <p className="mt-3 text-center text-sm">
              Não diga que vai fazer.<br />
              <span className="text-primary-light font-semibold">Mostre.</span>
            </p>

            <h2 className="mt-8 text-lg font-bold">Entrar na sua conta</h2>

            <form onSubmit={handleLogin} className="mt-4 space-y-3">
              <IconField icon={<Mail size={18} className="text-primary-light" />} type="email" value={email} onChange={setEmail} placeholder="E-mail ou usuário" />
              <IconField
                icon={<Lock size={18} className="text-primary-light" />}
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Senha"
                rightIcon={
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="text-muted-foreground">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <div className="text-right">
                <button type="button" className="text-xs font-semibold text-primary-light">Esqueci minha senha</button>
              </div>
              <PrimaryButton loading={loading}>Entrar</PrimaryButton>
            </form>

            <DividerLabel>OU CONTINUE COM</DividerLabel>

            <div className="grid grid-cols-3 gap-3">
              <SocialTile onClick={handleGoogle} label="G" color="#fff" />
              <SocialTile label="" icon={<AppleIcon />} />
              <SocialTile label="f" color="#1877F2" />
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                  <ShieldCheck size={18} className="text-primary-light" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">Segurança em primeiro lugar</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Seus dados estão protegidos e suas conquistas são só suas.</p>
                </div>
                <button className="inline-flex items-center text-xs font-semibold text-primary-light">
                  Saiba mais <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Não tem conta?{" "}
              <button onClick={() => setMode("signup")} className="font-semibold text-primary-light">Cadastre-se</button>
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-center text-2xl font-bold">
              Criar sua <span className="text-primary-light">conta</span>
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Junte-se à primeira rede social de evolução pessoal.
            </p>

            <Stepper step={1} />

            <form onSubmit={handleSignup} className="space-y-3">
              <FieldLabel label="Nome completo">
                <IconField icon={<User size={18} className="text-primary-light" />} value={nome} onChange={setNome} placeholder="Digite seu nome completo" highlight />
              </FieldLabel>
              <FieldLabel label="E-mail">
                <IconField icon={<Mail size={18} className="text-primary-light" />} type="email" value={email} onChange={setEmail} placeholder="Digite seu melhor e-mail" highlight />
              </FieldLabel>
              <FieldLabel label="Usuário">
                <IconField icon={<AtSign size={18} className="text-primary-light" />} value={username} onChange={setUsername} placeholder="Escolha um nome de usuário" />
              </FieldLabel>
              <FieldLabel label="Senha">
                <IconField
                  icon={<Lock size={18} className="text-primary-light" />}
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="Crie uma senha forte"
                  rightIcon={
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="text-muted-foreground">
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />
              </FieldLabel>
              <FieldLabel label="Confirmar senha">
                <IconField
                  icon={<Lock size={18} className="text-primary-light" />}
                  type={showPwd2 ? "text" : "password"}
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Confirme sua senha"
                  rightIcon={
                    <button type="button" onClick={() => setShowPwd2(v => !v)} className="text-muted-foreground">
                      {showPwd2 ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />
              </FieldLabel>
              <PrimaryButton loading={loading}>Continuar</PrimaryButton>
            </form>

            <DividerLabel>OU CADASTRE-SE COM</DividerLabel>

            <div className="grid grid-cols-3 gap-3">
              <SocialTile onClick={handleGoogle} label="Google" />
              <SocialTile label="Apple" icon={<AppleIcon />} />
              <SocialTile label="Facebook" color="#1877F2" />
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <button onClick={() => setMode("login")} className="font-semibold text-primary-light">Entrar</button>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Dados", "Perfil", "Objetivos"];
  return (
    <div className="my-6 flex items-center justify-between gap-1 px-2">
      {labels.map((l, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={l} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${active ? "bg-primary border-primary text-primary-foreground" : done ? "bg-primary/20 border-primary text-primary-light" : "border-border bg-card text-muted-foreground"}`}>{idx}</div>
              <span className={`text-[10px] ${active ? "text-primary-light font-semibold" : "text-muted-foreground"}`}>{l}</span>
            </div>
            {i < labels.length - 1 && <div className={`mx-1 h-px flex-1 ${idx < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function IconField({ icon, value, onChange, type = "text", placeholder, rightIcon, highlight }: { icon: React.ReactNode; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; rightIcon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border ${highlight ? "border-primary/60" : "border-border"} bg-card/60 px-4 py-3.5 focus-within:border-primary transition-colors`}>
      <span className="shrink-0">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        required
      />
      {rightIcon}
    </div>
  );
}

function PrimaryButton({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function DividerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] tracking-widest text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function SocialTile({ onClick, label, icon, color }: { onClick?: () => void; label: string; icon?: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-semibold hover:border-primary/50 transition-colors"
    >
      {icon ?? (
        label === "G" || label === "Google" ? (
          <GoogleIcon />
        ) : label === "f" || label === "Facebook" ? (
          <FacebookIcon />
        ) : (
          <span style={{ color }}>{label}</span>
        )
      )}
      {label.length > 1 && <span>{label}</span>}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 9.2-4.8 9.2-7.4 0-.5-.05-.9-.13-1.2H12z"/></svg>
  );
}
function AppleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12.5c0-2.4 2-3.5 2.1-3.6-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.3-.8-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.3.9 1.2 1.9 2.6 3.3 2.6 1.3-.1 1.8-.9 3.4-.9 1.6 0 2.1.9 3.5.8 1.4 0 2.4-1.3 3.3-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM14 5.4c.7-.9 1.2-2.1 1.1-3.4-1 0-2.3.7-3 1.6-.6.8-1.2 2-1.1 3.2 1.1.1 2.3-.6 3-1.4z"/></svg>;
}
function FacebookIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2"><path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7C18.3 21.1 22 17 22 12z"/></svg>;
}
