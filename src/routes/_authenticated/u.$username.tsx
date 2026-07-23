import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { BottomNav } from "@/components/BottomNav";
import {
  ArrowLeft, MoreHorizontal, CheckCircle2, Zap, Calendar,
  Target, Flame, Trophy, Grid3x3, Video, MessageCircle, Layers, Heart,
} from "lucide-react";
import { NivelBadge, nivelDoUsuario } from "@/components/NivelBadge";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: PerfilPublico,
});

type Tab = "feed" | "metas" | "habitos" | "conquistas";

function PerfilPublico() {
  const navigate = useNavigate();
  const { username } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("feed");

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, username, avatar_url, bio, missao, nivel, created_at")
        .eq("username", username)
        .maybeSingle();
      return data;
    },
  });

  // Self-guard: enviar para /perfil se for o próprio usuário
  if (profile && profile.id === user.id) {
    navigate({ to: "/perfil", replace: true });
  }

  const targetId = profile?.id;

  const { data: counters } = useQuery({
    enabled: !!targetId,
    queryKey: ["public-counters", targetId],
    queryFn: async () => {
      const [{ count: posts }, { count: seguidores }, { count: seguindo }] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", targetId!),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId!).eq("status", "aceito"),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId!).eq("status", "aceito"),
      ]);
      return { posts: posts ?? 0, seguidores: seguidores ?? 0, seguindo: seguindo ?? 0 };
    },
  });

  const { data: metas } = useQuery({
    enabled: !!targetId,
    queryKey: ["public-metas", targetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("metas")
        .select("id, titulo, categoria, status, progresso, foto_capa_url, created_at")
        .eq("user_id", targetId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    enabled: !!targetId,
    queryKey: ["public-stats", targetId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_profile_stats", { _user_id: targetId! });
      return data?.[0] ?? null;
    },
  });

  const { data: conquistasPublicas } = useQuery({
    enabled: !!targetId && tab === "conquistas",
    queryKey: ["public-conquistas", targetId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conquistas_usuarios")
        .select("slug, desbloqueada_em")
        .eq("user_id", targetId!)
        .order("desbloqueada_em", { ascending: false });
      return (data ?? []) as { slug: string; desbloqueada_em: string }[];
    },
  });

  const { data: follow, refetch: refetchFollow } = useQuery({
    enabled: !!targetId,
    queryKey: ["public-follow", user.id, targetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("id, status")
        .eq("follower_id", user.id)
        .eq("following_id", targetId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: posts } = useQuery({
    enabled: !!targetId && tab === "feed",
    queryKey: ["public-posts", targetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, media_url, tipo, legenda, meta_id, created_at")
        .eq("user_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  async function toggleFollow() {
    if (!targetId) return;
    if (follow) {
      await supabase.from("follows").delete().eq("id", follow.id);
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id, following_id: targetId, status: "aceito",
      });
      if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    }
    refetchFollow();
    qc.invalidateQueries({ queryKey: ["public-counters", targetId] });
  }

  const concluidas = (metas ?? []).filter(m => m.status === "concluida");
  const falhadas = (metas ?? []).filter(m => m.status === "falhada");
  const disciplina = (concluidas.length + falhadas.length) > 0
    ? Math.round((concluidas.length / (concluidas.length + falhadas.length)) * 100)
    : 0;

  const habitoTop = (() => {
    const counts = new Map<string, number>();
    concluidas.forEach(m => { if (m.categoria) counts.set(m.categoria, (counts.get(m.categoria) ?? 0) + 1); });
    if (!counts.size) return null;
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  })();

  const initial = (profile?.nome ?? "?")[0]?.toUpperCase();
  const seguindoNow = follow?.status === "aceito";

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto grid max-w-md grid-cols-[auto_1fr_auto] items-center gap-3 px-5 pt-4 pb-3">
        <button onClick={() => history.back()} className="rounded-full p-2 text-primary-light">
          <ArrowLeft size={22} />
        </button>
        <div className="justify-self-center"><VyraLogo size={26} showWordmark /></div>
        <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/50 text-primary-light">
          <MoreHorizontal size={18} />
        </button>
      </header>

      {loadingProfile && <div className="mx-auto max-w-md px-5"><div className="h-64 animate-pulse rounded-2xl bg-card" /></div>}

      {!loadingProfile && !profile && (
        <div className="mx-auto max-w-md px-5">
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Usuário não encontrado.
          </div>
        </div>
      )}

      {profile && (
        <div className="mx-auto max-w-md px-5">
          {/* Avatar + identidade */}
          <section className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="h-24 w-24 rounded-full border-2 border-primary p-0.5 shadow-glow">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} className="h-full w-full rounded-full object-cover" alt="" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold">{initial}</div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground ring-2 ring-background">
                <VyraLogo size={14} showWordmark={false} />
              </div>
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-2xl font-bold">{profile.nome ?? "—"}</h1>
                <NivelBadge nivel={nivelDoUsuario(profile.username, (profile as any).nivel)} size="sm" />
              </div>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              {habitoTop && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1">
                  <CheckCircle2 size={12} className="text-accent" />
                  <span className="text-xs font-semibold text-accent">Hábito: {habitoTop}</span>
                </div>
              )}
            </div>
          </section>

          {/* Contadores */}
          <section className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Counter value={counters?.posts ?? 0} label="Publicações" />
            <Counter value={counters?.seguidores ?? 0} label="Seguidores" />
            <Counter value={counters?.seguindo ?? 0} label="Seguindo" />
          </section>

          {/* Ações */}
          <section className="mt-4 flex items-center gap-2">
            <button
              onClick={toggleFollow}
              className={`h-11 flex-1 rounded-2xl border text-sm font-bold transition-colors ${
                seguindoNow
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary bg-transparent text-primary-light"
              }`}
            >
              {seguindoNow ? "Seguindo" : "Seguir"}
            </button>
            <button
              onClick={async () => {
                if (!targetId) return;
                const [a, b] = [user.id, targetId].sort();
                const { data: existente } = await supabase
                  .from("conversas")
                  .select("id")
                  .or(`and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`)
                  .maybeSingle();
                if (existente?.id) {
                  navigate({ to: "/mensagens/$id", params: { id: existente.id } });
                  return;
                }
                const { data: nova, error } = await supabase
                  .from("conversas")
                  .insert({ user1_id: user.id, user2_id: targetId } as any)
                  .select("id")
                  .single();
                if (error || !nova) return toast.error(error?.message ?? "Erro ao iniciar conversa");
                navigate({ to: "/mensagens/$id", params: { id: nova.id } });
              }}
              className="h-11 flex-1 rounded-2xl border border-border bg-card text-sm font-bold"
            >
              Mensagem
            </button>
          </section>

          {/* Missão */}
          {profile.missao && (
            <section className="mt-5 flex items-start gap-2">
              <Zap size={16} className="mt-0.5 shrink-0 text-primary-light" />
              <p className="text-sm font-semibold">{profile.missao}</p>
            </section>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="mt-2 whitespace-pre-line text-sm leading-snug text-foreground/80">
              {profile.bio}
            </p>
          )}

          {/* Membro desde */}
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar size={13} className="text-primary-light" />
            Membro desde {formatMonthYear(profile.created_at)}
          </div>

          {/* Conquistas principais */}
          <section className="mt-5 rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">Conquistas principais</h2>
              <button className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-light">Ver todas ›</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Hex icon={<Flame size={22} />} label="Foco" sub={`${stats?.streak_dias ?? 0} dias`} color="#A855F7" />
              <Hex icon={<Target size={22} />} label="Meta concluída" sub={`${concluidas.length}x`} color="#A855F7" />
              <Hex icon={<Trophy size={22} />} label={stats?.ranking_geral ? `Top ${stats.ranking_geral}` : "Ranking"} sub="Geral" color="#A855F7" />
            </div>
          </section>

          {/* Grade de estatísticas — SEM VCoins/créditos (privado) */}
          <section className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="grid grid-cols-5 gap-2">
              <StatCell icon={<Target size={18} />} value={concluidas.length} label="Metas concluídas" />
              <StatCell icon={<Flame size={18} />} value={stats?.streak_dias ?? 0} label="Sequência atual" />
              <StatCell icon={<Zap size={18} />} value={stats?.reputacao_pts ?? 0} label="Reputação" />
              <StatCell icon={<Trophy size={18} />} value={stats?.ranking_geral ? `#${stats.ranking_geral}` : "—"} label="Ranking geral" />
              <StatCell icon={<Heart size={18} />} value={`${disciplina}%`} label="Taxa de sucesso" />
            </div>
          </section>

          {/* Abas */}
          <div className="mt-6 flex border-b border-border">
            {([
              ["feed", "Feed", <Grid3x3 size={14} key="a" />],
              ["metas", "Metas", <Target size={14} key="b" />],
              ["habitos", "Hábitos", <Flame size={14} key="c" />],
              ["conquistas", "Conquistas", <Trophy size={14} key="d" />],
            ] as const).map(([k, l, icon]) => {
              const active = tab === k;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k as Tab)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                    active ? "text-primary-light" : "text-muted-foreground"
                  }`}
                >
                  {icon}
                  {l}
                  {active && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>

          {/* Conteúdo das abas */}
          <div className="mt-4">
            {tab === "feed" && (
              <>
                {(!posts || posts.length === 0) ? (
                  <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    @{profile.username} ainda não publicou nada.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {posts.map((p: any) => (
                      <Link
                        key={p.id}
                        to="/meta/$id"
                        params={{ id: p.meta_id ?? "" }}
                        disabled={!p.meta_id}
                        className="relative aspect-square overflow-hidden rounded-md border border-border bg-card"
                      >
                        {p.media_url ? (
                          p.tipo === "video" ? (
                            <video src={p.media_url} muted playsInline className="h-full w-full object-cover" />
                          ) : (
                            <img src={p.media_url} className="h-full w-full object-cover" alt="" />
                          )
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] font-semibold text-muted-foreground">
                            {p.legenda?.slice(0, 40) ?? "Publicação"}
                          </div>
                        )}
                        {p.tipo === "video" && (
                          <span className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1 text-white">
                            <Video size={11} />
                          </span>
                        )}
                        {!p.media_url && p.legenda && (
                          <span className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1 text-white">
                            <MessageCircle size={11} />
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "metas" && (
              <>
                {(metas ?? []).length === 0 ? (
                  <EmptyTab msg="Sem metas públicas." />
                ) : (
                  <div className="space-y-2">
                    {metas!.map((m: any) => (
                      <Link key={m.id} to="/meta/$id" params={{ id: m.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-primary">
                          {m.foto_capa_url && <img src={m.foto_capa_url} className="h-full w-full object-cover" alt="" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">{m.titulo}</div>
                          <div className="text-xs text-muted-foreground">{m.categoria ?? "—"} · {m.status === "concluida" ? "Concluída" : m.status === "falhada" ? "Falhada" : "Em andamento"}</div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-gradient-primary" style={{ width: `${m.progresso ?? 0}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-primary-light">{m.progresso ?? 0}%</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "habitos" && (
              <div className="space-y-3 px-4 pt-4">
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-light text-xl">🔥</div>
                  <div>
                    <div className="text-xs text-muted-foreground">Sequência atual</div>
                    <div className="text-sm font-bold">{stats?.streak_dias ?? 0} dias consecutivos</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent text-xl">⭐</div>
                  <div>
                    <div className="text-xs text-muted-foreground">Reputação total</div>
                    <div className="text-sm font-bold">{stats?.reputacao_pts?.toLocaleString("pt-BR") ?? 0} pts</div>
                  </div>
                </div>
                {habitoTop && (
                  <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-500 text-xl">🏅</div>
                    <div>
                      <div className="text-xs text-muted-foreground">Categoria favorita</div>
                      <div className="text-sm font-bold capitalize">{habitoTop}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "conquistas" && (
              <div className="px-4 pt-4">
                {(conquistasPublicas ?? []).length === 0 ? (
                  <EmptyTab msg="Nenhuma conquista desbloqueada ainda." />
                ) : (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">{(conquistasPublicas ?? []).length} conquistas desbloqueadas</p>
                    <div className="grid grid-cols-4 gap-3">
                      {CONQUISTAS_CATALOGO.filter(c =>
                        (conquistasPublicas ?? []).some((x: any) => x.slug === c.slug)
                      ).map(c => {
                        const data = (conquistasPublicas ?? []).find((x: any) => x.slug === c.slug);
                        return (
                          <div key={c.slug} className="flex flex-col items-center gap-1.5">
                            <div
                              className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-glow"
                              style={{ background: `${c.color}22`, border: `1px solid ${c.color}55` }}
                            >
                              {c.emoji}
                            </div>
                            <div className="text-center w-14">
                              <div className="text-[9px] font-semibold leading-tight">{c.label}</div>
                              <div className="text-[8px] text-muted-foreground">
                                {data ? new Date(data.desbloqueada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold">{formatCount(value)}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Hex({ icon, label, sub, color }: { icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex h-16 w-16 items-center justify-center"
        style={{
          clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
          background: `linear-gradient(135deg, ${color}30, ${color}10)`,
          border: `1px solid ${color}80`,
          color,
        }}
      >
        {icon}
      </div>
      <div className="text-center">
        <div className="text-[11px] font-semibold">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function StatCell({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center text-primary-light">{icon}</div>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[9px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyTab({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
      <Layers size={22} className="mx-auto mb-2 text-primary-light" />
      {msg}
    </div>
  );
}

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatMonthYear(iso: string) {
  const d = new Date(iso);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[d.getMonth()]}/${d.getFullYear()}`;
}

// Catálogo de conquistas (espelhado do perfil.tsx — mesmos slugs)
const CONQUISTAS_CATALOGO = [
  { slug: "primeira_fagulha",   emoji: "🔥", label: "Faísca",        color: "#F59E0B" },
  { slug: "primeira_missao",    emoji: "🥇", label: "1ª Missão",     color: "#A855F7" },
  { slug: "espirito_de_equipe", emoji: "👥", label: "Equipe",        color: "#38BDF8" },
  { slug: "desafiante",         emoji: "⚔️", label: "Desafiante",    color: "#EF4444" },
  { slug: "chama_acesa",        emoji: "🔥", label: "Chama Acesa",   color: "#F97316" },
  { slug: "rotina_de_ferro",    emoji: "💪", label: "Rotina de Ferro", color: "#22D3A1" },
  { slug: "inabalavel",         emoji: "🏔️", label: "Inabalável",    color: "#A855F7" },
  { slug: "comprometido",       emoji: "✅", label: "Comprometido",  color: "#22D3A1" },
  { slug: "maquina",            emoji: "✅", label: "Máquina",       color: "#3B82F6" },
  { slug: "lendario_checkin",   emoji: "✅", label: "200 Provas",    color: "#A855F7" },
  { slug: "cacador_de_metas",   emoji: "🎯", label: "Caçador",       color: "#F59E0B" },
  { slug: "conquistador",       emoji: "🎯", label: "Conquistador",  color: "#A855F7" },
  { slug: "primeira_vitoria",   emoji: "⚔️", label: "1ª Vitória",    color: "#EF4444" },
  { slug: "dominante",          emoji: "👑", label: "Dominante",     color: "#F59E0B" },
  { slug: "imbativel",          emoji: "💀", label: "Imbatível",     color: "#7B2EFF" },
  { slug: "influenciador",      emoji: "📣", label: "Influenciador", color: "#F97316" },
  { slug: "referencia",         emoji: "🌟", label: "Referência",    color: "#FBBF24" },
  { slug: "icone",              emoji: "🏆", label: "Ícone",         color: "#A855F7" },
  { slug: "prata_pura",         emoji: "💎", label: "Prata Pura",    color: "#C0C0C0" },
  { slug: "ouro_solido",        emoji: "💎", label: "Ouro Sólido",   color: "#FFD700" },
  { slug: "diamante",           emoji: "💎", label: "Diamante",      color: "#B9F2FF" },
  { slug: "lenda",              emoji: "👑", label: "Lenda",         color: "#7B2EFF" },
] as const;
