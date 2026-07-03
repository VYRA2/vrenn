import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Users, Plus, Search, Shield, Trophy } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/equipes/")({
  component: EquipesIndex,
});

type Tab = "minhas" | "descobrir" | "convites";

function EquipesIndex() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("minhas");
  const [search, setSearch] = useState("");


  const { data: minhas, isLoading: l1 } = useQuery({
    queryKey: ["equipes-minhas", user.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("equipe_membros")
        .select("equipe_id, papel, equipes:equipe_id (id, nome, descricao, avatar_url, categoria, publica, criador_id, created_at)")
        .eq("user_id", user.id);
      return (data ?? []).map((r: any) => ({ ...r.equipes, papel: r.papel })).filter((e: any) => e?.id);
    },
  });

  const { data: descobrir, isLoading: l2 } = useQuery({
    queryKey: ["equipes-descobrir", search],
    enabled: tab === "descobrir",
    queryFn: async () => {
      let q = (supabase as any).from("equipes").select("*").eq("publica", true).order("created_at", { ascending: false }).limit(30);
      if (search.trim().length >= 2) q = q.ilike("nome", `%${search.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const lista = tab === "minhas" ? (minhas ?? []) : tab === "descobrir" ? (descobrir ?? []) : [];
  const loading = (tab === "minhas" && l1) || (tab === "descobrir" && l2);


  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold inline-flex items-center gap-2"><Users size={22} className="text-primary-light"/> Equipes</h1>
        <button onClick={() => navigate({ to: "/equipes/nova" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow active:scale-95"><Plus size={20}/></button>
      </header>

      <div className="mx-auto flex max-w-md px-3">
        {([
          { id: "minhas", label: "Minhas equipes" },
          { id: "descobrir", label: "Descobrir" },
          { id: "convites", label: "Convites" },
        ] as { id: Tab; label: string }[]).map((t) => {
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
        {loading && [1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-card" />)}

        {!loading && tab === "convites" && (
          <EmptyState icon={<Shield size={28} />} title="Nenhum convite no momento" desc="Convites para equipes aparecerão aqui." />
        )}

        {!loading && tab !== "convites" && lista.length === 0 && (
          <EmptyState
            icon={tab === "descobrir" ? <Search size={28} /> : <Users size={28} />}
            title={tab === "descobrir" ? "Nenhuma equipe pública ainda" : "Você ainda não está em nenhuma equipe"}
            desc={tab === "descobrir" ? "Volte mais tarde para descobrir equipes." : "Crie a sua ou descubra equipes públicas."}
            action={tab === "minhas" ? { label: "Criar equipe", onClick: () => navigate({ to: "/equipes/nova" }) } : undefined}
          />
        )}

        {!loading && lista.map((e: any) => (
          <Link key={e.id} to="/equipes/$id" params={{ id: e.id }} className="block rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary-light overflow-hidden">
                {e.avatar_url ? <img src={e.avatar_url} className="h-full w-full object-cover"/> : <Users size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold truncate">{e.nome}</h3>
                  {e.publica && <Shield size={14} className="text-accent shrink-0" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{e.descricao || "Sem descrição"}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users size={12}/> Equipe</span>
                  <span className="inline-flex items-center gap-1 capitalize"><Trophy size={12}/> {e.categoria}</span>
                  {e.papel === "admin" && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary-light font-semibold">Admin</span>}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-light">{icon}</div>
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      {action && (
        <button onClick={action.onClick} className="mt-4 rounded-2xl bg-gradient-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-glow">{action.label}</button>
      )}
    </div>
  );
}
