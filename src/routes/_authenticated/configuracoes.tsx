import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { ArrowLeft, ChevronRight, User as UserIcon, Camera, AtSign, Mail, Lock, Shield, Bell, Globe, Ruler, HelpCircle, FileText, Info, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Configuracoes,
});

function Configuracoes() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: profile, refetch } = useQuery({
    queryKey: ["profile-cfg", user.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function setPublico(p: boolean) {
    await supabase.from("profiles").update({ perfil_publico: p }).eq("id", user.id);
    refetch();
  }

  function deleteAccount() {
    if (!confirm("Excluir conta? Esta ação é irreversível.")) return;
    toast.info("Solicitação registrada. Sua conta será excluída em breve.");
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
          <Row icon={<Lock size={18}/>} label="Senha" right={<span className="text-xs text-muted-foreground">••••••••</span>} />
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
          <Row icon={<Trash2 size={18}/>} label="Excluir conta" onClick={deleteAccount} danger />
        </Section>
      </div>
    </main>
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
