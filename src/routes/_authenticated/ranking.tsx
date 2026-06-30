import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Crown, Flame, ChevronRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: Ranking,
});

type Scope = "global" | "seguindo" | "equipes";
type Periodo = "semanal" | "mensal" | "tudo";

function Ranking() {
  const { user } = Route.useRouteContext();
  const [scope, setScope] = useState<Scope>("global");
  const [periodo, setPeriodo] = useState<Periodo>("tudo");

  const { data: all } = useQuery({
    queryKey: ["ranking", scope, user.id],
    queryFn: async () => {
      if (scope === "seguindo") {
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", user.id).eq("status", "aceito");
        const ids = (f ?? []).map((x: any) => x.following_id);
        ids.push(user.id);
        if (!ids.length) return [];
        const { data } = await supabase.from("profiles").select("id, nome, username, avatar_url, reputacao_pts, streak_dias").in("id", ids).order("reputacao_pts", { ascending: false }).limit(100);
        return data ?? [];
      }
      const { data } = await supabase.from("profiles").select("id, nome, username, avatar_url, reputacao_pts, streak_dias").order("reputacao_pts", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const list = all ?? [];
  const top3 = list.slice(0, 3);
  const rest = list.slice(3, 10);
  const myIndex = list.findIndex((p: any) => p.id === user.id);
  const me = myIndex >= 0 ? list[myIndex] : null;

  return (
    <main className="min-h-screen bg-background text-foreground pb-32">
      <header className="mx-auto max-w-md px-5 pt-6 pb-2">
        <h1 className="text-2xl font-bold">Classificação</h1>
        <p className="text-xs text-muted-foreground">Os mais disciplinados da comunidade VYRA</p>
      </header>

      {/* Scope tabs */}
      <div className="mx-auto flex max-w-md px-3 mt-2">
        {(["global","seguindo","equipes"] as Scope[]).map(s => {
          const active = scope === s;
          const label = s === "global" ? "Global" : s === "seguindo" ? "Seguindo" : "Equipes";
          return (
            <button key={s} onClick={() => setScope(s)} className={`relative flex-1 py-3 text-xs font-semibold capitalize ${active ? "text-primary-light" : "text-muted-foreground"}`}>
              {label}
              {active && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
      <div className="h-px bg-border" />

      {/* Periodo */}
      <div className="mx-auto max-w-md px-5 pt-4">
        <div className="flex gap-2 rounded-full border border-border bg-card p-1">
          {(["semanal","mensal","tudo"] as Periodo[]).map(p => {
            const active = periodo === p;
            const label = p === "semanal" ? "Semanal" : p === "mensal" ? "Mensal" : "Todos os tempos";
            return (
              <button key={p} onClick={() => setPeriodo(p)} className={`flex-1 rounded-full py-1.5 text-[11px] font-semibold transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="mx-auto max-w-md px-5 mt-8">
          <div className="grid grid-cols-3 items-end gap-3">
            {top3[1] ? <PodiumCard user={top3[1]} place={2} /> : <div />}
            {top3[0] ? <PodiumCard user={top3[0]} place={1} /> : <div />}
            {top3[2] ? <PodiumCard user={top3[2]} place={3} /> : <div />}
          </div>
        </div>
      )}

      {/* List 4-10 */}
      <div className="mx-auto max-w-md px-5 mt-8 space-y-2">
        {rest.map((p: any, i: number) => (
          <RankRow key={p.id} user={p} place={i + 4} />
        ))}
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Ainda sem ranking nesta categoria.
          </div>
        )}
      </div>

      {/* My position */}
      {me && (
        <div className="fixed bottom-20 left-0 right-0 z-30 px-5 pb-2">
          <div className="mx-auto max-w-md rounded-2xl bg-gradient-to-r from-primary to-primary-light p-4 shadow-glow flex items-center gap-3">
            <span className="text-lg font-bold text-primary-foreground w-8 text-center">#{myIndex + 1}</span>
            {me.avatar_url ? (
              <img src={me.avatar_url} className="h-10 w-10 rounded-full border-2 border-white object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-background text-sm font-bold">{(me.nome || "?")[0].toUpperCase()}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-primary-foreground truncate">{me.nome} (Você)</div>
              <div className="text-[11px] text-primary-foreground/90 truncate">@{me.username}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-primary-foreground">{me.reputacao_pts ?? 0} pts</div>
              <div className="text-[10px] text-primary-foreground/90 inline-flex items-center gap-1"><Flame size={10} />{me.streak_dias ?? 0}d</div>
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
    1: { ring: "#FBBF24", height: "h-32", crown: true, badge: "bg-amber-400 text-amber-950" },
    2: { ring: "#CBD5E1", height: "h-24", crown: false, badge: "bg-slate-300 text-slate-900" },
    3: { ring: "#D97706", height: "h-20", crown: false, badge: "bg-amber-700 text-amber-50" },
  }[place];

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {cfg.crown && (
          <Crown size={24} className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-400 fill-amber-400" />
        )}
        <div className="rounded-full p-1" style={{ background: cfg.ring }}>
          {user.avatar_url ? (
            <img src={user.avatar_url} className="h-16 w-16 rounded-full object-cover border-2 border-background" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-background bg-gradient-primary text-lg font-bold">{(user.nome || "?")[0].toUpperCase()}</div>
          )}
        </div>
        <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${cfg.badge}`}>{place}</span>
      </div>
      <div className="mt-4 text-center">
        <div className="text-xs font-bold truncate max-w-[100px]">{user.nome}</div>
        <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">@{user.username}</div>
        <div className="mt-1 text-sm font-bold text-primary-light">{user.reputacao_pts ?? 0}</div>
        <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Flame size={10} className="text-orange-400" />{user.streak_dias ?? 0}d</div>
      </div>
      <div className={`mt-2 w-full rounded-t-xl bg-gradient-to-b from-primary/30 to-primary/5 border border-primary/20 ${cfg.height}`} />
    </div>
  );
}

function RankRow({ user, place }: { user: any; place: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <span className="w-7 text-center text-sm font-bold text-muted-foreground">#{place}</span>
      {user.avatar_url ? (
        <img src={user.avatar_url} className="h-10 w-10 rounded-full border-2 border-primary/30 object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/30 bg-gradient-primary text-sm font-bold">{(user.nome || "?")[0].toUpperCase()}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{user.nome}</div>
        <div className="text-[11px] text-muted-foreground truncate">@{user.username}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-primary-light">{user.reputacao_pts ?? 0}</div>
        <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1 justify-end"><Flame size={10} className="text-orange-400" />{user.streak_dias ?? 0}d</div>
      </div>
      <ChevronRight size={16} className="text-muted-foreground" />
    </div>
  );
}
