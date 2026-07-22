import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { ArrowLeft, ChevronRight, User as UserIcon, Camera, AtSign, Mail, Lock, Shield, Bell, Globe, Ruler, HelpCircle, FileText, Info, LogOut, Trash2, X, Loader2, FlaskConical, Sparkles, Eraser } from "lucide-react";
import { toast } from "sonner";
import { deleteMyAccount } from "@/lib/account.functions";
import { seedUsersBatch, seedContent, seedCleanup, seedStatus } from "@/lib/admin-seed.functions";

const ADMIN_ID = "52fd9ebb-5d88-4b33-acc3-97b70c62a426";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Configuracoes,
});

function Configuracoes() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const deleteFn = useServerFn(deleteMyAccount);
  const [showPwd, setShowPwd] = useState(false);
  const [showDel, setShowDel] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile-cfg", user.id],
    queryFn: async () => (await supabase.from("profiles").select("id, nome, username, avatar_url, bio, missao, perfil_publico, idioma, unidades, created_at").eq("id", user.id).maybeSingle()).data,
  });

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function setPublico(p: boolean) {
    await supabase.from("profiles").update({ perfil_publico: p }).eq("id", user.id);
    refetch();
  }

  const email = user.email ?? "";
  const masked = email.replace(/^(.).*(@.*)$/, "$1***$2");

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="relative mx-auto flex max-w-md items-center justify-center px-5 pt-5 pb-2">
        <button onClick={() => navigate({ to: "/perfil" })} className="absolute left-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"><ArrowLeft size={18}/></button>
        <VyraLogo size={32} />
      </header>

      <div className="mx-auto max-w-md px-5">
        <h1 className="text-3xl font-bold">Configurações</h1>

        <Section title="CONTA">
          <Row icon={<UserIcon size={18}/>} label="Editar perfil" onClick={() => navigate({ to: "/perfil/editar" })} />
          <Row icon={<Camera size={18}/>} label="Foto de perfil" onClick={() => navigate({ to: "/perfil/editar" })} right={
            profile?.avatar_url
              ? <img src={profile.avatar_url} className="h-8 w-8 rounded-full border-2 border-primary/40 object-cover"/>
              : <div className="h-8 w-8 rounded-full bg-gradient-primary"/>
          }/>
          <Row icon={<AtSign size={18}/>} label="Username" right={<span className="text-xs text-muted-foreground">@{profile?.username ?? "—"}</span>} />
          <Row icon={<Mail size={18}/>} label="Email" right={<span className="text-xs text-muted-foreground">{masked}</span>} />
          <Row icon={<Lock size={18}/>} label="Senha" onClick={() => setShowPwd(true)} right={<span className="text-xs text-muted-foreground">••••••••</span>} />
          <Row icon={<Shield size={18}/>} label="Privacidade da conta" right={
            <div className="inline-flex rounded-full bg-background p-0.5 border border-border">
              <button onClick={() => setPublico(true)} className={`rounded-full px-3 py-1 text-[11px] font-bold ${profile?.perfil_publico ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Público</button>
              <button onClick={() => setPublico(false)} className={`rounded-full px-3 py-1 text-[11px] font-bold ${!profile?.perfil_publico ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Privado</button>
            </div>
          } noArrow/>
        </Section>

        <Section title="PREFERÊNCIAS">
          <Row icon={<Bell size={18}/>} label="Notificações" onClick={() => navigate({ to: "/notificacoes" })}/>
          <Row icon={<Globe size={18}/>} label="Idioma" right={<span className="text-xs text-muted-foreground">Português</span>}/>
          <Row icon={<Ruler size={18}/>} label="Unidades" right={<span className="text-xs text-muted-foreground">{profile?.unidades ?? "kg"}</span>}/>
        </Section>

        <Section title="GERAL">
          <Row icon={<HelpCircle size={18}/>} label="Central de ajuda"/>
          <Row icon={<FileText size={18}/>} label="Termos de uso"/>
          <Row icon={<Shield size={18}/>} label="Política de privacidade"/>
          <Row icon={<Info size={18}/>} label="Sobre o VRENN" right={<span className="text-xs text-muted-foreground">v1.0</span>}/>
        </Section>

        <Section title="AÇÃO">
          <Row icon={<LogOut size={18}/>} label="Sair da conta" onClick={logout} danger />
          <Row icon={<Trash2 size={18}/>} label="Excluir conta" onClick={() => setShowDel(true)} danger />
        </Section>
      </div>

      {showPwd && <TrocarSenhaModal onClose={() => setShowPwd(false)} />}
      {showDel && (
        <ExcluirContaModal
          onClose={() => setShowDel(false)}
          onConfirm={async () => {
            try {
              await deleteFn();
              await supabase.auth.signOut();
              toast.success("Conta excluída.");
              navigate({ to: "/auth", replace: true });
            } catch (e: any) {
              toast.error(e?.message ?? "Erro ao excluir conta");
            }
          }}
        />
      )}
    </main>
  );
}

function TrocarSenhaModal({ onClose }: { onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pwd.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">Alterar senha</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18}/></button>
        </div>
        <div className="space-y-3">
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Nova senha (mín. 8 caracteres)" className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
          <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} placeholder="Confirmar nova senha" className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
          <button onClick={submit} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} Salvar nova senha
          </button>
        </div>
      </div>
    </div>
  );
}

function ExcluirContaModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => Promise<void> }) {
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = txt.trim().toUpperCase() === "EXCLUIR";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-destructive">Excluir conta</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18}/></button>
        </div>
        <p className="text-sm text-muted-foreground">Esta ação é <strong>irreversível</strong>. Sua conta, posts, metas e histórico serão apagados. Digite <strong>EXCLUIR</strong> para confirmar.</p>
        <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Digite EXCLUIR" className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-destructive" />
        <button
          onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
          disabled={!ok || busy}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground disabled:opacity-40"
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Excluir minha conta permanentemente
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <section className="mt-6">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden">{children}</div>
    </section>
  );
}
function Row({ icon, label, right, onClick, danger, noArrow }: any) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${danger ? "text-destructive" : ""}`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${danger ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary-light"}`}>{icon}</span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      {right}
      {!noArrow && !right && <ChevronRight size={16} className="text-muted-foreground"/>}
      {!noArrow && right && <ChevronRight size={14} className="text-muted-foreground ml-1"/>}
    </button>
  );
}
