import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { Search, Bell, Heart, MessageCircle, Share2, MoreHorizontal, BadgeCheck } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/feed")({
  component: Feed,
});

type Tab = "para-voce" | "seguindo" | "em-alta";

function Feed() {
  const [tab, setTab] = useState<Tab>("para-voce");

  const { data: metas, isLoading } = useQuery({
    queryKey: ["feed-metas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("*, profiles:user_id (nome, username, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2">
          <VyraLogo size={32} />
          <div className="flex items-center gap-1">
            <button className="rounded-full p-2 text-foreground/90"><Search size={22} /></button>
            <Link to="/notificacoes" className="relative rounded-full p-2 text-foreground/90">
              <Bell size={22} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            </Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-md px-5">
          {([["para-voce", "Para você"], ["seguindo", "Seguindo"], ["em-alta", "Em alta"]] as const).map(([k, l]) => {
            const active = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${active ? "text-primary-light" : "text-muted-foreground"}`}>
                {l}
                {active && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-border" />
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {isLoading && [1, 2, 3].map(i => <Skeleton key={i} />)}
        {!isLoading && (!metas || metas.length === 0) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma meta ainda. Seja o primeiro a se comprometer.</p>
            <Link to="/nova-meta" className="mt-4 inline-block rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">Criar minha meta</Link>
          </div>
        )}
        {metas?.map((m: any) => <MetaCard key={m.id} meta={m} />)}
      </div>

      <BottomNav />
    </main>
  );
}

function MetaCard({ meta }: { meta: any }) {
  const profile = meta.profiles;
  const initial = (profile?.nome || profile?.username || "?")[0].toUpperCase();
  const diasRestantes = meta.prazo ? Math.max(0, Math.ceil((new Date(meta.prazo).getTime() - Date.now()) / 86400000)) : null;
  return (
    <Link to="/meta/$id" params={{ id: meta.id }} className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
      <div className="flex items-center gap-3">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.nome} className="h-11 w-11 rounded-full border-2 border-primary/60 object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold text-primary-foreground">
            {initial}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold">{profile?.nome ?? "Usuário"}</span>
            <BadgeCheck size={16} className="text-primary-light fill-primary/20" />
          </div>
          <div className="text-xs text-muted-foreground">{formatWhen(meta.created_at)}</div>
        </div>
        <button className="text-muted-foreground"><MoreHorizontal size={20} /></button>
      </div>

      <h3 className="mt-3 text-base font-bold">{meta.titulo}</h3>
      {meta.descricao && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{meta.descricao}</p>}

      {meta.foto_capa_url && (
        <div className="mt-3 overflow-hidden rounded-xl">
          <img src={meta.foto_capa_url} alt="" className="w-full h-48 object-cover" />
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1.5 flex items-end justify-between">
          <div>
            <span className="text-xs text-muted-foreground">Progresso</span>
            <div className="text-xl font-bold text-primary-light leading-none mt-1">{meta.progresso}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-primary-light">{diasRestantes !== null ? `${diasRestantes} dias restantes` : "Sem prazo"}</div>
            {meta.prazo && <div className="text-[10px] text-muted-foreground mt-0.5">Até {new Date(meta.prazo).toLocaleDateString("pt-BR")}</div>}
          </div>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-gradient-primary" style={{ width: `${meta.progresso}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-5">
          <button className="inline-flex items-center gap-1.5 hover:text-primary-light"><Heart size={18} /> <span className="text-xs font-semibold">0</span></button>
          <button className="inline-flex items-center gap-1.5 hover:text-primary-light"><MessageCircle size={18} /> <span className="text-xs font-semibold">0</span></button>
          <button className="inline-flex items-center gap-1.5 hover:text-primary-light"><Share2 size={18} /></button>
        </div>
        <span className="text-xs font-semibold text-primary-light">Ver detalhes</span>
      </div>
    </Link>
  );
}

function Skeleton() {
  return <div className="h-56 animate-pulse rounded-2xl bg-card" />;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const hh = d.toTimeString().slice(0, 5);
  if (sameDay) return `Hoje às ${hh}`;
  if (isYesterday) return `Ontem às ${hh}`;
  return d.toLocaleDateString("pt-BR");
}
