import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Target } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/metas")({
  component: Metas,
});

type Tab = "em_andamento" | "concluida" | "abandonada";

const TABS: { id: Tab; label: string }[] = [
  { id: "em_andamento", label: "Em andamento" },
  { id: "concluida", label: "Concluídas" },
  { id: "abandonada", label: "Falhadas / Abandonadas" },
];

function Metas() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("em_andamento");

  const { data: metas, isLoading } = useQuery({
    queryKey: ["my-metas-list", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtradas = (metas ?? []).filter((m: any) => {
    if (tab === "em_andamento") return m.status === "em_andamento" || !m.status;
    if (tab === "concluida") return m.status === "concluida";
    return m.status === "abandonada" || m.status === "falhada";
  });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto max-w-md px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold inline-flex items-center gap-2"><Target size={22} className="text-primary-light"/> Minhas metas</h1>
        <p className="text-xs text-muted-foreground mt-1">{(metas ?? []).length} metas no total</p>
      </header>

      <div className="mx-auto flex max-w-md px-3">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex-1 py-3 text-xs font-semibold transition-colors ${active ? "text-primary-light" : "text-muted-foreground"}`}>
              {t.label}
              {active && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
      <div className="h-px bg-border" />

      <div className="mx-auto max-w-md space-y-3 px-5 pt-4">
        {isLoading && [1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />)}
        {!isLoading && filtradas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma meta {tab === "em_andamento" ? "em andamento" : tab === "concluida" ? "concluída" : "abandonada"}. {tab === "em_andamento" && <Link to="/nova-meta" className="text-primary-light font-semibold">Criar agora</Link>}
          </div>
        )}
        {filtradas.map((m: any) => {
          const dias = m.prazo ? Math.max(0, Math.ceil((new Date(m.prazo).getTime() - Date.now()) / 86400000)) : null;
          const statusColor = m.status === "concluida" ? "text-accent border-accent/40 bg-accent/10" : m.status === "abandonada" || m.status === "falhada" ? "text-rose-400 border-rose-400/40 bg-rose-400/10" : "text-primary-light border-primary/40 bg-primary/10";
          const statusLabel = m.status === "concluida" ? "Concluída" : m.status === "abandonada" || m.status === "falhada" ? "Abandonada" : "Em andamento";
          return (
            <Link key={m.id} to="/meta/$id" params={{ id: m.id }} className="block rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold truncate">{m.titulo}</h3>
                  <div className="mt-1 text-[11px] text-muted-foreground capitalize">{m.categoria}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-[#2E2E50] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary-light" style={{ width: `${Math.max(2, m.progresso ?? 0)}%` }} />
                  </div>
                </div>
                <span className="text-sm font-bold text-primary-light">{m.progresso ?? 0}%</span>
              </div>
              {dias !== null && (
                <div className="mt-2 text-[11px] text-muted-foreground">{dias} dias restantes</div>
              )}
            </Link>
          );
        })}
      </div>
      <BottomNav />
    </main>
  );
}
