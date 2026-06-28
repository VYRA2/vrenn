import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { Search, Bell, Heart, MessageCircle, Share2, Clock } from "lucide-react";
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
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <VyraLogo size={32} />
          <div className="flex items-center gap-2">
            <button className="rounded-full p-2 text-muted-foreground hover:text-foreground">
              <Search size={20} />
            </button>
            <Link to="/notificacoes" className="rounded-full p-2 text-muted-foreground hover:text-foreground">
              <Bell size={20} />
            </Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-md gap-1 px-4 pb-2">
          {([["para-voce", "Para você"], ["seguindo", "Seguindo"], ["em-alta", "Em alta"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-3 px-4 py-4">
        {isLoading && [1, 2, 3].map(i => <Skeleton key={i} />)}
        {!isLoading && (!metas || metas.length === 0) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma meta ainda. Seja o primeiro a se comprometer.</p>
            <Link to="/nova-meta" className="mt-4 inline-block rounded-3xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Criar minha meta</Link>
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
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
          {initial}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{profile?.nome ?? "Usuário"}</div>
          <div className="text-xs text-muted-foreground">@{profile?.username ?? "anon"} · {formatTime(meta.created_at)}</div>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{meta.categoria}</span>
      </div>
      <h3 className="text-base font-bold">{meta.titulo}</h3>
      {meta.descricao && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{meta.descricao}</p>}
      <div className="mt-3">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-semibold text-primary-light">{meta.progresso}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-gradient-primary" style={{ width: `${meta.progresso}%` }} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock size={14} /> {diasRestantes !== null ? `${diasRestantes} dias restantes` : "Sem prazo"}</span>
        <div className="flex items-center gap-4">
          <button className="inline-flex items-center gap-1 hover:text-primary-light"><Heart size={16} /> 0</button>
          <button className="inline-flex items-center gap-1 hover:text-primary-light"><MessageCircle size={16} /> 0</button>
          <button className="inline-flex items-center gap-1 hover:text-primary-light"><Share2 size={16} /></button>
        </div>
      </div>
    </Link>
  );
}

function Skeleton() {
  return <div className="h-44 animate-pulse rounded-2xl bg-card" />;
}

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
