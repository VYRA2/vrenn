import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Info, Crown, Flame, Gem, ChevronRight, ChevronDown, Trophy, Users, Target, Swords } from "lucide-react";
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
  const [periodo, setPeriodo] = useState<Periodo>("tudo");
  const [periodoOpen, setPeriodoOpen] = useState(false);

  // IDs filtrados por scope (seguidores/amigos)
  const { data: followIds } = useQuery({
    queryKey: ["follow-ids", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("follows").select("following_id")
        .eq("follower_id", user.id).eq("status", "aceito");
      const ids = (data ?? []).map((x: any) => x.following_id);
      ids.push(user.id);
      return ids as string[];
    },
    enabled: scope === "seguidores" || scope === "amigos",
  });

  // Ranking de equipes (só ativo quando scope === "equipes")
  const { data: equipeRanking, isLoading: equipeLoading } = useQuery({
    queryKey: ["ranking-equipes", periodo],
    queryFn: async () => {
      const agora = new Date();
      let desde: string | null = null;
      if (periodo === "semanal") {
        const d = new Date(agora); d.setDate(d.getDate() - 7);
        desde = d.toISOString();
      } else if (periodo === "mensal") {
        desde = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
      }

      // Buscar todas as equipes com contagem de membros
      const { data: equipes } = await supabase
        .from("equipes")
        .select("id, nome, avatar_url, categoria, created_at");

      if (!equipes?.length) return [];

      const equipeIds = equipes.map((e: any) => e.id);

      // Membros por equipe
      const { data: membros } = await supabase
        .from("equipe_membros")
        .select("equipe_id")
        .in("equipe_id", equipeIds);

      // Check-ins de desafio por equipe (via desafios_equipe)
      let checkinQ = supabase
        .from("checkins_desafio_equipe")
        .select("desafio_id, desafios_equipe!inner(equipe_id)");
      if (desde) checkinQ = (checkinQ as any).gte("created_at", desde);
      const { data: checkins } = await checkinQ as any;

      // Desafios criados por equipe
      let desafioQ = supabase
        .from("desafios_equipe")
        .select("equipe_id")
        .in("equipe_id", equipeIds);
      if (desde) desafioQ = (desafioQ as any).gte("created_at", desde);
      const { data: desafios } = await desafioQ;

      // Agregar por equipe
      const membroCount: Record<string, number> = {};
      const checkinCount: Record<string, number> = {};
      const desafioCount: Record<string, number> = {};

      for (const m of membros ?? []) {
        membroCount[m.equipe_id] = (membroCount[m.equipe_id] ?? 0) + 1;
      }
      for (const c of checkins ?? []) {
        const eid = (c as any).desafios_equipe?.equipe_id;
        if (eid) checkinCount[eid] = (checkinCount[eid] ?? 0) + 1;
      }
      for (const d of desafios ?? []) {
        desafioCount[d.equipe_id] = (desafioCount[d.equipe_id] ?? 0) + 1;
      }

      // Normalizar métricas (0-100) e calcular score
      const maxMembros  = Math.max(1, ...Object.values(membroCount));
      const maxCheckins = Math.max(1, ...Object.values(checkinCount));
      const maxDesafios = Math.max(1, ...Object.values(desafioCount));

      return equipes
        .map((e: any) => {
          const m = membroCount[e.id]  ?? 0;
          const c = checkinCount[e.id] ?? 0;
          const d = desafioCount[e.id] ?? 0;
          const score = Math.round(
            (m / maxMembros)  * 40 +
            (c / maxCheckins) * 30 +
            (d / maxDesafios) * 20
            // 10% reservado para posts de equipe (futuro)
          );
          return { ...e, membros: m, checkins: c, desafios: d, score };
        })
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 50);
    },
    enabled: scope === "equipes",
  });

  const { data: all, isLoading } = useQuery({
    queryKey: ["ranking", scope, periodo, user.id],
    queryFn: async () => {
      const scopeIds = (scope === "seguidores" || scope === "amigos") ? followIds : null;

      // ALL-TIME: usa reputacao_pts diretamente do profiles
      if (periodo === "tudo") {
        let q = supabase
          .from("profiles")
          .select("id, nome, username, avatar_url, reputacao_pts, streak_dias")
          .order("reputacao_pts", { ascending: false })
          .limit(100);
        if (scopeIds) q = q.in("id", scopeIds);
        const { data } = await q;
        return (data ?? []).map((p: any) => ({ ...p, pts_periodo: p.reputacao_pts }));
      }

      // SEMANAL / MENSAL: soma do reputacao_log no período
      const agora = new Date();
      let desde: string;
      if (periodo === "semanal") {
        const d = new Date(agora);
        d.setDate(d.getDate() - 7);
        desde = d.toISOString();
      } else {
        const d = new Date(agora.getFullYear(), agora.getMonth(), 1);
        desde = d.toISOString();
      }

      // Buscar logs do período
      let logQ = (supabase as any)
        .from("reputacao_log")
        .select("user_id, pontos")
        .gte("created_at", desde);
      if (scopeIds) logQ = logQ.in("user_id", scopeIds);
      const { data: logs } = await logQ;

      // Agrupa por user_id
      const totais: Record<string, number> = {};
      for (const row of (logs ?? [])) {
        totais[row.user_id] = (totais[row.user_id] ?? 0) + row.pontos;
      }

      if (Object.keys(totais).length === 0) return [];

      // Buscar perfis dos usuários que pontuaram
      const ids = Object.keys(totais);
      let pQ = supabase
        .from("profiles")
        .select("id, nome, username, avatar_url, reputacao_pts, streak_dias")
        .in("id", ids);
      const { data: profiles } = await pQ;

      // Montar lista com pts do período
      return ((profiles ?? []) as any[])
        .map((p: any) => ({ ...p, pts_periodo: totais[p.id] ?? 0 }))
        .sort((a: any, b: any) => b.pts_periodo - a.pts_periodo)
        .slice(0, 100);
    },
    enabled: periodo === "tudo" || !!followIds || (scope !== "seguidores" && scope !== "amigos"),
  });

  const isEquipes = scope === "equipes";
  const list = isEquipes ? (equipeRanking ?? []) : (all ?? []);
  const top3 = list.slice(0, 3);
  const rest = list.slice(3, 10);
  const myIndex = isEquipes ? -1 : list.findIndex((p: any) => p.id === user.id);
  const me = myIndex >= 0 ? list[myIndex] : null;
  const loading = isEquipes ? equipeLoading : isLoading;

  const periodoLabel = periodo === "semanal" ? "Esta semana" : periodo === "mensal" ? "Este mês" : "Todos os tempos";

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
            <p className="mt-1.5 text-xs text-muted-foreground">
              {periodo === "tudo"
                ? "Ranking geral — pontos acumulados desde sempre."
                : periodo === "semanal"
                ? "Pontos ganhos nos últimos 7 dias."
                : "Pontos ganhos no mês atual."}
            </p>
          </div>
          <div className="relative">
            <button onClick={() => setPeriodoOpen(v => !v)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold">
              {periodoLabel} <ChevronDown size={14} />
            </button>
            {periodoOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                {(["tudo", "mensal", "semanal"] as Periodo[]).map(p => (
                  <button key={p} onClick={() => { setPeriodo(p); setPeriodoOpen(false); }}
                    className={`flex w-full items-center px-3 py-2.5 text-left text-xs font-semibold gap-2 ${periodo === p ? "text-primary-light bg-primary/10" : "text-foreground hover:bg-card"}`}>
                    {p === "semanal" ? "🔥 Esta semana" : p === "mensal" ? "📅 Este mês" : "🏆 Todos os tempos"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mx-auto max-w-md px-5 mt-10 text-center text-sm text-muted-foreground">Carregando ranking…</div>
      ) : list.length === 0 ? (
        <div className="mx-auto max-w-md px-5 mt-10 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {periodo === "tudo" ? "Ainda sem ranking nesta categoria." : `Ninguém pontuou ${periodo === "semanal" ? "essa semana" : "este mês"} ainda.`}
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <div className="mx-auto max-w-md px-5 mt-10">
              <div className="grid grid-cols-3 items-end gap-3">
                {top3[1] ? (isEquipes ? <EquipePodiumCard equipe={top3[1]} place={2} /> : <PodiumCard user={top3[1]} place={2} />) : <div />}
                {top3[0] ? (isEquipes ? <EquipePodiumCard equipe={top3[0]} place={1} /> : <PodiumCard user={top3[0]} place={1} />) : <div />}
                {top3[2] ? (isEquipes ? <EquipePodiumCard equipe={top3[2]} place={3} /> : <PodiumCard user={top3[2]} place={3} />) : <div />}
              </div>
            </div>
          )}

          {/* List 4-10 */}
          <div className="mx-auto max-w-md px-5 mt-8">
            {rest.length > 0 && (
              <div className="rounded-2xl border border-border bg-card divide-y divide-border">
                {rest.map((e: any, i: number) => (
                  isEquipes
                    ? <EquipeRankRow key={e.id} equipe={e} place={i + 4} />
                    : <RankRow key={e.id} user={e} place={i + 4} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
              <span className="text-lg font-bold">{formatPts(me.pts_periodo ?? 0)}</span>
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
          <span className="text-sm font-bold text-primary-light">{formatPts(user.pts_periodo ?? 0)}</span>
          <span className="text-[10px] text-primary-light">pts</span>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground inline-flex items-center gap-1 justify-center">
          <Flame size={11} className="text-orange-400 fill-orange-400/40" />{user.streak_dias ?? 0} dias
        </div>
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
        <span className="text-sm font-bold">{formatPts(user.pts_periodo ?? 0)}</span>
        <span className="text-[10px] text-muted-foreground">pts</span>
      </div>
      <ChevronRight size={16} className="text-muted-foreground" />
    </div>
  );
}

function EquipePodiumCard({ equipe, place }: { equipe: any; place: 1 | 2 | 3 }) {
  const cfg = {
    1: { ring: "#FBBF24", badge: "bg-amber-400 text-amber-950", border: "border-amber-400/60", cardBg: "bg-gradient-to-b from-amber-500/15 to-amber-500/5", elev: "mb-4" },
    2: { ring: "#CBD5E1", badge: "bg-slate-300 text-slate-900", border: "border-slate-400/40", cardBg: "bg-card", elev: "" },
    3: { ring: "#D97706", badge: "bg-amber-700 text-amber-50", border: "border-amber-700/50", cardBg: "bg-card", elev: "" },
  }[place];

  return (
    <div className={`relative flex flex-col items-center rounded-2xl border ${cfg.border} ${cfg.cardBg} px-3 pt-8 pb-4 ${cfg.elev}`}>
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
        {equipe.avatar_url ? (
          <img src={equipe.avatar_url} className="h-16 w-16 rounded-full object-cover border-2 border-background" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-background bg-primary/20 text-2xl">
            🏅
          </div>
        )}
      </div>

      <div className="mt-3 text-center w-full min-w-0">
        <div className="text-sm font-bold truncate">{equipe.nome}</div>
        <div className="text-[10px] text-muted-foreground truncate">{equipe.categoria}</div>
        <div className="mt-2 inline-flex items-baseline gap-1">
          <Trophy size={12} className="text-primary-light self-center" />
          <span className="text-sm font-bold text-primary-light">{equipe.score}</span>
          <span className="text-[10px] text-primary-light">pts</span>
        </div>
        <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><Users size={10}/> {equipe.membros}</span>
          <span className="flex items-center gap-0.5"><Swords size={10}/> {equipe.desafios}</span>
        </div>
      </div>
    </div>
  );
}

function EquipeRankRow({ equipe, place }: { equipe: any; place: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{place}</span>
      {equipe.avatar_url ? (
        <img src={equipe.avatar_url} className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-base">🏅</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{equipe.nome}</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span className="flex items-center gap-0.5"><Users size={10}/> {equipe.membros} membros</span>
          <span className="flex items-center gap-0.5"><Target size={10}/> {equipe.checkins} check-ins</span>
          <span className="flex items-center gap-0.5"><Swords size={10}/> {equipe.desafios} desafios</span>
        </div>
      </div>
      <div className="inline-flex items-baseline gap-1">
        <Trophy size={13} className="text-primary-light self-center" />
        <span className="text-sm font-bold">{equipe.score}</span>
      </div>
      <ChevronRight size={16} className="text-muted-foreground" />
    </div>
  );
}

function formatPts(n: number) {
  return n.toLocaleString("pt-BR");
}

