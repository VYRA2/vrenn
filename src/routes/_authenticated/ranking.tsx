import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Info, Crown, Flame, Gem, ChevronRight, ChevronDown, Trophy } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: Ranking,
});

type Scope = "global" | "seguidores" | "amigos" | "equipes";
type Periodo = "semanal" | "mensal" | "tudo";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "global", label: "Global" },
  { id: "seguidores", label: "Seguidores" },
  { id: "amigos", label: "Amigos" },
  { id: "equipes", label: "Equipes" },
];

function Ranking() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>("global");
  const [periodo, setPeriodo] = useState<Periodo>("semanal");
  const [periodoOpen, setPeriodoOpen] = useState(false);

  const { data: all } = useQuery({
    queryKey: ["ranking", scope, user.id],
    queryFn: async () => {
      if (scope === "seguidores" || scope === "amigos") {
        const { data: f } = await supabase
          .from("follows").select("following_id")
          .eq("follower_id", user.id).eq("status", "aceito");
        const ids = (f ?? []).map((x: any) => x.following_id);
        ids.push(user.id);
        const { data } = await supabase
          .from("profiles").select("id, nome, username, avatar_url, reputacao_pts, streak_dias")
          .in("id", ids).order("reputacao_pts", { ascending: false }).limit(100);
        return data ?? [];
      }
      const { data } = await supabase
        .from("profiles").select("id, nome, username, avatar_url, reputacao_pts, streak_dias")
        .order("reputacao_pts", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const list = all ?? [];
  const top3 = list.slice(0, 3);
  const rest = list.slice(3, 10);
  const myIndex = list.findIndex((p: any) => p.id === user.id);
  const me = myIndex >= 0 ? list[myIndex] : null;

  const periodoLabel = periodo === "semanal" ? "Semanal" : periodo === "mensal" ? "Mensal" : "Todos os tempos";

  return (
    <main className="min-h-screen bg-background text-foreground pb-44">
      {/* Header */}
      <header className="relative mx-auto flex max-w-md items-center justify-center px-5 pt-5 pb-3">
        <button onClick={() => navigate({ to: "/feed" })} className="absolute left-5 flex h-9 w-9 items-center justify-center rounded-full text-foreground/90"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-bold">Ranking</h1>
        <button className="absolute right-5 flex h-9 w-9 items-center justify-center rounded-full text-foreground/90"><Info size={20} /></button>
      </header>

      {/* Scope tabs */}
      <div className="mx-auto flex max-w-md px-3">
        {SCOPES.map(s => {
          const active = scope === s.id;
          return (
            <button key={s.id} onClick={() => setScope(s.id)} className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${active ? "text-primary-light" : "text-muted-foreground"}`}>
              {s.label}
              {active && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
      <div className="h-px bg-border" />

      {/* Hero card */}
      <div className="mx-auto max-w-md px-5 pt-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center"
            style={{
              clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
              background: "linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(var(--primary)/0.05))",
              border: "1px solid hsl(var(--primary)/0.5)",
            }}
          >
            <Trophy size={26} className="text-primary-light" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-tight">Seja Top 1.<br />Inspire milhares.</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">Ranking baseado em pontos das últimas 4 semanas.</p>
          </div>
          <div className="relative">
            <button onClick={() => setPeriodoOpen(v => !v)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold">
              {periodoLabel} <ChevronDown size={14} />
            </button>
            {periodoOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-border bg-card shadow-xl">
                {(["semanal","mensal","tudo"] as Periodo[]).map(p => (
                  <button key={p} onClick={() => { setPeriodo(p); setPeriodoOpen(false); }}
                    className={`block w-full px-3 py-2 text-left text-xs font-semibold ${periodo === p ? "text-primary-light" : "text-foreground"}`}>
                    {p === "semanal" ? "Semanal" : p === "mensal" ? "Mensal" : "Todos os tempos"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="mx-auto max-w-md px-5 mt-10">
          <div className="grid grid-cols-3 items-end gap-3">
            {top3[1] ? <PodiumCard user={top3[1]} place={2} /> : <div />}
            {top3[0] ? <PodiumCard user={top3[0]} place={1} /> : <div />}
            {top3[2] ? <PodiumCard user={top3[2]} place={3} /> : <div />}
          </div>
        </div>
      )}

      {/* List 4-10 */}
      <div className="mx-auto max-w-md px-5 mt-8">
        {rest.length > 0 && (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {rest.map((p: any, i: number) => (
              <RankRow key={p.id} user={p} place={i + 4} />
            ))}
          </div>
        )}
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Ainda sem ranking nesta categoria.
          </div>
        )}
      </div>

      {/* My position fixed */}
      {me && (
        <div className="fixed bottom-20 left-0 right-0 z-30 px-5">
          <div className="mx-auto max-w-md rounded-2xl border border-primary/40 bg-primary/15 backdrop-blur-md p-4 flex items-center gap-4">
            <div className="text-center shrink-0">
              <div className="text-[10px] font-semibold text-primary-light">Você</div>
              <div className="text-2xl font-bold text-primary-light leading-none mt-0.5">{myIndex + 1}</div>
            </div>
            {me.avatar_url ? (
              <img src={me.avatar_url} className="h-12 w-12 rounded-full border-2 border-amber-400 object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-400 bg-gradient-primary text-sm font-bold">{(me.nome || "?")[0].toUpperCase()}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{me.nome}</div>
              <div className="text-[11px] text-muted-foreground truncate">@{me.username}</div>
            </div>
            <div className="inline-flex items-baseline gap-1.5">
              <Gem size={16} className="text-primary-light self-center" />
              <span className="text-lg font-bold">{formatPts(me.reputacao_pts ?? 0)}</span>
              <span className="text-xs text-muted-foreground">pts</span>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function PodiumCard({ user, place }: { user: any; place: 1 | 2 | 3 }) {
  const cfg = {
    1: { ring: "#FBBF24", badge: "bg-amber-400 text-amber-950", border: "border-amber-400/60", cardBg: "bg-gradient-to-b from-amber-500/15 to-amber-500/5", elev: "mb-4" },
    2: { ring: "#CBD5E1", badge: "bg-slate-300 text-slate-900", border: "border-slate-400/40", cardBg: "bg-card", elev: "" },
    3: { ring: "#D97706", badge: "bg-amber-700 text-amber-50", border: "border-amber-700/50", cardBg: "bg-card", elev: "" },
  }[place];

  return (
    <div className={`relative flex flex-col items-center rounded-2xl border ${cfg.border} ${cfg.cardBg} px-3 pt-8 pb-4 ${cfg.elev}`}>
      {/* Badge with shield shape */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
        {place === 1 ? (
          <div className="relative">
            <Crown size={20} className="absolute -top-3 left-1/2 -translate-x-1/2 text-amber-400 fill-amber-400" />
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${cfg.badge}`}>{place}</span>
          </div>
        ) : (
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${cfg.badge}`}>{place}</span>
        )}
      </div>

      <div className="rounded-full p-[3px]" style={{ background: cfg.ring }}>
        {user.avatar_url ? (
          <img src={user.avatar_url} className="h-16 w-16 rounded-full object-cover border-2 border-background" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-background bg-gradient-primary text-lg font-bold">{(user.nome || "?")[0].toUpperCase()}</div>
        )}
      </div>

      <div className="mt-3 text-center w-full min-w-0">
        <div className="text-sm font-bold truncate">{user.nome}</div>
        <div className="text-[10px] text-muted-foreground truncate">@{user.username}</div>
        <div className="mt-2 inline-flex items-baseline gap-1">
          <Gem size={12} className="text-primary-light self-center" />
          <span className="text-sm font-bold text-primary-light">{formatPts(user.reputacao_pts ?? 0)}</span>
          <span className="text-[10px] text-primary-light">pts</span>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground inline-flex items-center gap-1 justify-center"><Flame size={11} className="text-orange-400 fill-orange-400/40" />{user.streak_dias ?? 0} dias</div>
      </div>
    </div>
  );
}

function RankRow({ user, place }: { user: any; place: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{place}</span>
      {user.avatar_url ? (
        <img src={user.avatar_url} className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold">{(user.nome || "?")[0].toUpperCase()}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{user.nome}</div>
        <div className="text-[11px] text-muted-foreground truncate">@{user.username}</div>
      </div>
      <div className="inline-flex items-baseline gap-1">
        <Gem size={13} className="text-primary-light self-center" />
        <span className="text-sm font-bold">{formatPts(user.reputacao_pts ?? 0)}</span>
        <span className="text-[10px] text-muted-foreground">pts</span>
      </div>
      <ChevronRight size={16} className="text-muted-foreground" />
    </div>
  );
}

function formatPts(n: number) {
  return n.toLocaleString("pt-BR");
}
