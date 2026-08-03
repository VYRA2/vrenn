import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import {
  BadgeCheck, Edit3, Target, Dumbbell, Users, BookOpen, DollarSign, Heart, Calendar,
  CheckCircle2, MessageCircle, Heart as HeartIcon, TrendingUp, X, Bell, Wallet, MessageSquare,
  Shield, Activity, Swords, Share2, Sparkles, ArrowUpRight,
} from "lucide-react";

import { NivelBadge, nivelDoUsuario } from "@/components/NivelBadge";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

type TabId = "ativo" | "conquistas" | "concluidas" | "sobre";

function Perfil() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showConquistasSheet, setShowConquistasSheet] = useState(false);
  const [tab, setTab] = useState<TabId>("ativo");

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const [{ data }, { data: statsRows }] = await Promise.all([
        supabase.from("profiles").select("id, nome, username, avatar_url, bio, missao, perfil_publico, idioma, unidades, nivel, created_at").eq("id", user.id).maybeSingle(),
        supabase.rpc("get_my_profile_stats"),
      ]);
      const stats = statsRows?.[0] ?? {};
      // stats spread BEFORE data so profile fields (nome, avatar_url, etc) always win
      return (data ? { ...stats, ...data } : null) as (typeof data & { nivel?: number; streak_dias?: number; reputacao_pts?: number; creditos?: number }) | null;
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["my-metas", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profileStats } = useQuery({
    queryKey: ["profile-stats", user.id],
    queryFn: async () => {
      const [postsRes, commentsRes, seguidoresRes, seguindoRes, myPostsRes] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("post_comments").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id).eq("status", "aceito"),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id).eq("status", "aceito"),
        supabase.from("posts").select("id").eq("user_id", user.id),
      ]);
      const postIds = (myPostsRes.data ?? []).map((p: any) => p.id);
      let curtidasRecebidas = 0;
      if (postIds.length) {
        const { count } = await supabase.from("post_likes").select("*", { count: "exact", head: true }).in("post_id", postIds);
        curtidasRecebidas = count ?? 0;
      }
      return {
        publicacoes: postsRes.count ?? 0,
        comentarios: commentsRes.count ?? 0,
        curtidasRecebidas,
        seguidores: seguidoresRes.count ?? 0,
        seguindo: seguindoRes.count ?? 0,
      };
    },
  });

  // Sparkline — posts dos últimos 7 dias
  const { data: sparkData } = useQuery({
    queryKey: ["perfil-spark", user.id],
    queryFn: async () => {
      const desde = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase.from("posts").select("created_at").eq("user_id", user.id).gte("created_at", desde);
      const dias: { d: string; v: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const dt = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        dias.push({ d: dt, v: 0 });
      }
      (data ?? []).forEach((p: any) => {
        const key = String(p.created_at).slice(0, 10);
        const row = dias.find(x => x.d === key);
        if (row) row.v += 1;
      });
      return dias;
    },
  });

  // Duelos em que o usuário participa
  const { data: duelos } = useQuery({
    queryKey: ["perfil-duelos", user.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("duelos")
        .select("id, titulo, prazo, progresso_challenger, progresso_opponent, challenger_id, opponent_id, oponente:profiles!opponent_id(nome, username, avatar_url), desafiante:profiles!challenger_id(nome, username, avatar_url)")
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .eq("status", "ativo");
      return (data ?? []) as any[];
    },
  });

  // Strava connection
  const { data: stravaConn } = useQuery({
    queryKey: ["strava-conn-perfil", user.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("strava_connections")
        .select("athlete_name, athlete_photo, ultima_atividade_tipo, ultima_atividade_km")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  // Dados de árbitro
  const [showTermoArbitro, setShowTermoArbitro] = useState(false);
  const [showDesativarArbitro, setShowDesativarArbitro] = useState(false);
  const { data: arbitroData, refetch: refetchArbitro } = useQuery({
    queryKey: ["perfil-arbitro", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("reputacao_arbitro, arbitragens_concluidas, arbitragens_ativas, aceita_ser_arbitro")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  async function ativarArbitro() {
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ aceita_ser_arbitro: true })
      .eq("id", user.id);
    if (error) {
      console.error("Erro ativar árbitro:", error);
      return toast.error(error.message ?? "Erro ao ativar");
    }
    toast.success("Você agora pode ser sorteado como árbitro!");
    refetchProfile();
    refetchArbitro();
    setShowTermoArbitro(false);
  }

  async function desativarArbitro() {
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ aceita_ser_arbitro: false })
      .eq("id", user.id);
    if (error) {
      console.error("Erro desativar árbitro:", error);
      return toast.error(error.message ?? "Erro ao desativar");
    }
    toast.success("Você não será mais sorteado como árbitro.");
    refetchProfile();
    refetchArbitro();
    setShowDesativarArbitro(false);
  }

  function handleToggleArbitro() {
    const ativo = arbitroData?.aceita_ser_arbitro ?? false;
    if (!ativo) {
      setShowTermoArbitro(true); // Mostrar termos antes de ativar
    } else {
      setShowDesativarArbitro(true); // Confirmar antes de desativar
    }
  }

  const { data: conquistasDesbloqueadas } = useQuery({
    queryKey: ["conquistas", user.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conquistas_usuarios")
        .select("slug, desbloqueada_em")
        .eq("user_id", user.id);
      return (data ?? []) as { slug: string; desbloqueada_em: string }[];
    },
  });

  // Detect auto-generated username (handle_new_user appends first 4 chars of UUID)
  const autoSuffix = user.id.replace(/-/g, "").slice(0, 4);
  const needsUsername = !!profile && (!profile.username || profile.username.endsWith(autoSuffix));
  useEffect(() => { if (needsUsername) setShowUsernameModal(true); }, [needsUsername]);

  const concluidas = (metas ?? []).filter(m => m.status === "concluida").length;
  const falhadas = (metas ?? []).filter(m => m.status === "falhada").length;
  const disciplina = (concluidas + falhadas) > 0 ? Math.round((concluidas / (concluidas + falhadas)) * 100) : 0;
  const metasAtivas = (metas ?? []).filter(m => m.status === "em_andamento");
  const metasConcluidas = (metas ?? []).filter(m => m.status === "concluida");
  const initial = (profile?.nome ?? "?")[0]?.toUpperCase();

  const nivel = (profile as any)?.nivel ?? 1;
  const xp = profile?.reputacao_pts ?? 0;
  const xpMax = nivel * 1000 + 2200;

  const desbloqueadasOrdenadas = TODAS_CONQUISTAS
    .map(c => ({ c, u: (conquistasDesbloqueadas ?? []).find(x => x.slug === c.slug) }))
    .filter(x => !!x.u)
    .sort((a, b) => new Date(b.u!.desbloqueada_em).getTime() - new Date(a.u!.desbloqueada_em).getTime());
  const recentes = desbloqueadasOrdenadas.slice(0, 5);
  const restantes = Math.max(0, desbloqueadasOrdenadas.length - recentes.length);

  function copiarLink() {
    if (!profile?.username) return toast.error("Defina um username primeiro");
    navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`);
    toast.success("Link do perfil copiado!");
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link to="/mensagens" aria-label="Mensagens" className="rounded-full p-1.5 text-foreground/90">
            <MessageSquare size={22} />
          </Link>
          <span className="text-lg font-bold tracking-wide">VRENN</span>
          <div className="flex items-center gap-1">
            <Link to="/notificacoes" aria-label="Notificações" className="rounded-full p-1.5 text-foreground/90"><Bell size={22} /></Link>
            <Link to="/wallet" aria-label="Carteira" className="rounded-full p-1.5 text-foreground/90"><Wallet size={22} /></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* IDENTIDADE */}
        <section className="relative mt-5 flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="h-[88px] w-[88px] rounded-full border-2 border-primary p-0.5 shadow-glow">
              {profile?.avatar_url ? (
                <img key={profile.avatar_url} src={profile.avatar_url} alt={profile.nome ?? "Avatar"} className="h-full w-full rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold">{initial}</div>
              )}
            </div>
            <Link to="/perfil/editar" aria-label="Editar foto" className="absolute -bottom-0.5 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
              <Edit3 size={12} />
            </Link>
          </div>

          <div className="min-w-0 flex-1 pr-24">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-xl font-bold">{profile?.nome ?? "—"}</h1>
              {user.id === "52fd9ebb-5d88-4b33-acc3-97b70c62a426" && (
                <BadgeCheck size={18} className="shrink-0 text-primary-light fill-primary/20" />
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="truncate text-sm text-muted-foreground">@{profile?.username ?? "—"}</p>
              <NivelBadge nivel={nivelDoUsuario(profile?.username, nivel)} size="sm" />
            </div>
            {profile?.bio && (
              <p className="mt-2 text-sm text-foreground whitespace-pre-line">{profile.bio}</p>
            )}
            <button onClick={copiarLink} className="mt-1.5 block max-w-full truncate text-sm font-medium text-primary-light">
              vrenn.app/{profile?.username ?? "—"}
            </button>
          </div>

          <Link to="/perfil/editar" className="absolute right-0 top-0 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground">
            Editar perfil
          </Link>
        </section>

        {/* STATS */}
        <section className="mt-5 grid grid-cols-3 border-y border-border py-4">
          <Link to="/perfil/seguidores" className="text-center">
            <div className="text-2xl font-bold">{profileStats?.seguidores ?? 0}</div>
            <div className="text-xs text-muted-foreground">Seguidores</div>
          </Link>
          <Link to="/perfil/seguindo" className="border-x border-border text-center">
            <div className="text-2xl font-bold">{profileStats?.seguindo ?? 0}</div>
            <div className="text-xs text-muted-foreground">Seguindo</div>
          </Link>
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 text-2xl font-bold">
              {metasAtivas.length}
              <Target size={14} className="text-primary-light" />
            </div>
            <div className="text-xs text-muted-foreground">Metas ativas</div>
          </div>
        </section>

        {/* CARD DUPLO */}
        <section className="mt-4 grid grid-cols-2 rounded-2xl border border-border bg-card p-4">
          <div className="pr-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Taxa de execução</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1">
                <span className="text-3xl font-black text-primary-light">{disciplina}%</span>
                <ArrowUpRight size={14} className="text-primary-light" />
              </div>
              <div className="h-9 w-[100px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData ?? []}>
                    <Line type="monotone" dataKey="v" stroke="#A855F7" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">12% desde o mês passado</div>
          </div>

          <div className="border-l border-border pl-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nível</div>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="flex h-12 w-11 shrink-0 items-center justify-center text-xl font-black text-primary-light"
                style={{
                  clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                  background: "linear-gradient(135deg, rgba(168,85,247,0.30), rgba(168,85,247,0.10))",
                }}
              >
                {nivel}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs">
                  <span className="font-bold">{xp.toLocaleString("pt-BR")}</span>
                  <span className="text-muted-foreground"> / {xpMax.toLocaleString("pt-BR")} XP</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, Math.round((xp / xpMax) * 100))}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONQUISTAS RECENTES */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conquistas recentes</h2>
            <button onClick={() => setShowConquistasSheet(true)} className="text-xs font-semibold text-primary-light">Ver todas</button>
          </div>
          {recentes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-5 text-center">
              <div className="mb-1 text-2xl">🔒</div>
              <div className="text-xs font-semibold text-muted-foreground">Nenhuma conquista ainda</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Faça seu primeiro check-in para desbloquear</div>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {recentes.map(({ c }) => (
                <div key={c.slug} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <Hexagon color={c.color}>{c.emoji}</Hexagon>
                  <div className="w-full text-center">
                    <div className="truncate text-[9px] font-bold uppercase leading-tight">{c.label}</div>
                    <div className="truncate text-[9px] text-muted-foreground">{c.sub}</div>
                  </div>
                </div>
              ))}
              {restantes > 0 && (
                <button onClick={() => setShowConquistasSheet(true)} className="flex w-16 shrink-0 flex-col items-center">
                  <Hexagon color="#64748B">+{restantes}</Hexagon>
                </button>
              )}
            </div>
          )}
        </section>

        {/* ABAS */}
        <section className="mt-6 border-b border-border">
          <div className="flex">
            {([
              { id: "ativo", label: "Ativo" },
              { id: "conquistas", label: "Conquistas" },
              { id: "concluidas", label: "Metas concluídas" },
              { id: "sobre", label: "Sobre" },
            ] as { id: TabId; label: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 border-b-2 pb-2.5 text-xs font-semibold transition-colors ${tab === t.id ? "border-primary text-primary-light" : "border-transparent text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* ABA ATIVO */}


        {tab === "ativo" && (
          <div className="mt-5 space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metas ativas</h2>
                <Link to="/metas" className="text-xs font-semibold text-primary-light">Ver todas</Link>
              </div>
              {metasAtivas.length === 0 ? (
                <Link to="/nova-meta" className="block rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Nenhuma meta ativa. <span className="font-semibold text-primary-light">Criar uma agora</span>
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {metasAtivas.map(m => <MetaCard key={m.id} meta={m} />)}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duelos participando</h2>
                <Link to="/duelos" search={{ criar: false }} className="text-xs font-semibold text-primary-light">Ver todas</Link>
              </div>
              {(duelos ?? []).length === 0 ? (
                <Link to="/duelos" search={{ criar: false }} className="block rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">

                  Nenhum duelo ativo. <span className="font-semibold text-primary-light">Desafiar alguém</span>
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {(duelos ?? []).map(d => <DueloCard key={d.id} duelo={d} meId={user.id} />)}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selo VRENN</h2>
              <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
                <div
                  className="flex h-12 w-11 shrink-0 items-center justify-center"
                  style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)", background: "linear-gradient(135deg, rgba(168,85,247,0.35), rgba(168,85,247,0.10))" }}
                >
                  <VyraLogo size={22} showWordmark={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">Você é um Executor.</div>
                  <div className="text-xs text-muted-foreground">Mostra resultado. Inspira outras pessoas.</div>
                </div>
                <button onClick={copiarLink} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/50 px-3 py-2 text-xs font-semibold text-primary-light">
                  <Share2 size={13} /> Compartilhar selo
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ABA CONQUISTAS */}
        {tab === "conquistas" && (
          <div className="mt-5">
            <p className="mb-4 text-xs text-muted-foreground">
              {(conquistasDesbloqueadas ?? []).length} de {TODAS_CONQUISTAS.length} desbloqueadas
            </p>
            <div className="grid grid-cols-4 gap-3">
              {TODAS_CONQUISTAS.map(c => {
                const desbloqueada = (conquistasDesbloqueadas ?? []).find(x => x.slug === c.slug);
                return (
                  <div key={c.slug} className={`flex flex-col items-center gap-1.5 ${desbloqueada ? "" : "opacity-30 grayscale"}`}>
                    <Hexagon color={c.color} glow={!!desbloqueada}>{c.emoji}</Hexagon>
                    <div className="w-full text-center">
                      <div className="truncate text-[9px] font-bold uppercase leading-tight">{c.label}</div>
                      <div className="truncate text-[9px] text-muted-foreground">
                        {desbloqueada
                          ? new Date(desbloqueada.desbloqueada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                          : c.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA METAS CONCLUÍDAS */}
        {tab === "concluidas" && (
          <div className="mt-5">
            {metasConcluidas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Nenhuma meta concluída ainda.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {metasConcluidas.map(m => <MetaCard key={m.id} meta={m} concluida />)}
              </div>
            )}
          </div>
        )}

        {/* ABA SOBRE */}
        {tab === "sobre" && (
          <div className="mt-5 space-y-6">
            {/* Árbitro */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold"><Shield size={14} className="text-primary-light" /> Árbitro</h2>
                {(arbitroData?.arbitragens_concluidas ?? 0) > 0 && (
                  <Link to="/arbitro" className="text-xs font-semibold text-primary-light">Ver painel →</Link>
                )}
              </div>
              <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">Aceito ser árbitro</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Você pode ser sorteado para validar metas e duelos de outros usuários</div>
                  </div>
                  <button
                    onClick={handleToggleArbitro}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${arbitroData?.aceita_ser_arbitro ? "bg-primary" : "bg-secondary"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${arbitroData?.aceita_ser_arbitro ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Vantagens de ser árbitro</div>
                  {[
                    { icon: "⚖️", text: "+3 pts de reputação por check-in validado" },
                    { icon: "🏆", text: "+20 pts por resultado de duelo declarado" },
                    { icon: "🛡️", text: "Badge exclusivo de árbitro no perfil" },
                    { icon: "📊", text: "Reputação de árbitro separada da reputação geral" },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-base">{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Rep. árbitro", value: arbitroData?.reputacao_arbitro ?? 0 },
                    { label: "Concluídas", value: arbitroData?.arbitragens_concluidas ?? 0 },
                    { label: "Ativas agora", value: arbitroData?.arbitragens_ativas ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-border bg-background p-2 text-center">
                      <div className="text-lg font-bold text-primary-light">{value}</div>
                      <div className="text-[10px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>

                {(arbitroData?.arbitragens_ativas ?? 0) > 0 && (
                  <Link to="/arbitro" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2.5 text-xs font-bold text-primary-light">
                    <Shield size={14} /> Acessar painel do árbitro →
                  </Link>
                )}
              </div>
            </section>

            {/* Resumo de atividade */}
            <section className="pb-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">Resumo de atividade</h2>
                <Link to="/ranking" className="text-xs font-semibold text-primary-light">Ver ranking</Link>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <Link to="/perfil/publicacoes" className="block"><ActivityTile icon={<CheckCircle2 size={20} />} value={profileStats?.publicacoes ?? 0} label="Publicações" color="#A855F7" /></Link>
                <ActivityTile icon={<MessageCircle size={20} />} value={profileStats?.comentarios ?? 0} label="Comentários" color="#22D3A1" />
                <ActivityTile icon={<HeartIcon size={20} />} value={profileStats?.curtidasRecebidas ?? 0} label="Curtidas recebidas" color="#F59E0B" />
                <Link to="/perfil/seguidores" className="block"><ActivityTile icon={<Users size={20} />} value={profileStats?.seguidores ?? 0} label="Seguidores" color="#38BDF8" /></Link>
                <Link to="/perfil/seguindo" className="block"><ActivityTile icon={<TrendingUp size={20} />} value={profileStats?.seguindo ?? 0} label="Seguindo" color="#A855F7" /></Link>
              </div>
            </section>
          </div>
        )}

        {/* Sheet — todas as conquistas */}
        {showConquistasSheet && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowConquistasSheet(false)}>
            <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-background p-6" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold">Todas as conquistas</h3>
                <button onClick={() => setShowConquistasSheet(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-card">
                  <X size={18} />
                </button>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                {(conquistasDesbloqueadas ?? []).length} de {TODAS_CONQUISTAS.length} desbloqueadas
              </p>
              <div className="grid grid-cols-4 gap-3">
                {TODAS_CONQUISTAS.map(c => {
                  const desbloqueada = (conquistasDesbloqueadas ?? []).find(x => x.slug === c.slug);
                  return (
                    <div key={c.slug} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl transition-all ${desbloqueada ? "shadow-glow" : "opacity-30 grayscale"}`}
                        style={desbloqueada
                          ? { background: `${c.color}22`, border: `1px solid ${c.color}55` }
                          : { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }
                        }
                      >
                        {c.emoji}
                      </div>
                      <div className="w-14 text-center">
                        <div className={`text-[9px] font-semibold leading-tight ${desbloqueada ? "text-foreground" : "text-muted-foreground"}`}>
                          {c.label}
                        </div>
                        <div className="mt-0.5 text-[8px] leading-tight text-muted-foreground">
                          {desbloqueada
                            ? new Date(desbloqueada.desbloqueada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })
                            : c.sub
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Resumo de atividade */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Resumo de atividade</h2>
            <Link to="/ranking" className="text-xs font-semibold text-primary-light">Ver ranking</Link>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <Link to="/perfil/publicacoes" className="block"><ActivityTile icon={<CheckCircle2 size={20} />} value={profileStats?.publicacoes ?? 0} label="Publicações" color="#A855F7" /></Link>
            <ActivityTile icon={<MessageCircle size={20} />} value={profileStats?.comentarios ?? 0} label="Comentários" color="#22D3A1" />
            <ActivityTile icon={<HeartIcon size={20} />} value={profileStats?.curtidasRecebidas ?? 0} label="Curtidas recebidas" color="#F59E0B" />
            <Link to="/perfil/seguidores" className="block"><ActivityTile icon={<Users size={20} />} value={profileStats?.seguidores ?? 0} label="Seguidores" color="#38BDF8" /></Link>
            <Link to="/perfil/seguindo" className="block"><ActivityTile icon={<TrendingUp size={20} />} value={profileStats?.seguindo ?? 0} label="Seguindo" color="#A855F7" /></Link>
          </div>
        </section>

        {/* Strava */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Activity size={14} className="text-[#FC4C02]" /> Strava
            </h2>
            <Link to="/strava-connect" className="text-xs font-semibold text-primary-light">
              {stravaConn ? "Gerenciar →" : "Conectar →"}
            </Link>
          </div>
          <Link to="/strava-connect" className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
            {stravaConn ? (
              <div className="flex items-center gap-3">
                {stravaConn.athlete_photo ? (
                  <img src={stravaConn.athlete_photo} alt="Strava" className="h-10 w-10 rounded-full border border-green-500/40 object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FC4C02]/20 text-xl">🏃</div>
                )}
                <div>
                  <div className="text-sm font-bold text-foreground">{stravaConn.athlete_name}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Conectado
                  </div>
                  {stravaConn.ultima_atividade_tipo && (
                    <div className="mt-1 text-xs capitalize text-muted-foreground">
                      Última: {stravaConn.ultima_atividade_tipo} {stravaConn.ultima_atividade_km ? `— ${Number(stravaConn.ultima_atividade_km).toFixed(1)} km` : ""}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FC4C02] text-lg font-black text-white">S</div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Conectar Strava</div>
                  <div className="text-xs text-muted-foreground">Valide corridas e atividades automaticamente</div>
                </div>
              </div>
            )}
          </Link>
        </section>
      </div>



        {/* Sheet — todas as conquistas */}
        {showConquistasSheet && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowConquistasSheet(false)}>
            <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-background p-6" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold">Todas as conquistas</h3>
                <button onClick={() => setShowConquistasSheet(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-card">
                  <X size={18} />
                </button>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                {(conquistasDesbloqueadas ?? []).length} de {TODAS_CONQUISTAS.length} desbloqueadas
              </p>
              <div className="grid grid-cols-4 gap-3">
                {TODAS_CONQUISTAS.map(c => {
                  const desbloqueada = (conquistasDesbloqueadas ?? []).find(x => x.slug === c.slug);
                  return (
                    <div key={c.slug} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl transition-all ${desbloqueada ? "shadow-glow" : "opacity-30 grayscale"}`}
                        style={desbloqueada
                          ? { background: `${c.color}22`, border: `1px solid ${c.color}55` }
                          : { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }
                        }
                      >
                        {c.emoji}
                      </div>
                      <div className="w-14 text-center">
                        <div className={`text-[9px] font-semibold leading-tight ${desbloqueada ? "text-foreground" : "text-muted-foreground"}`}>
                          {c.label}
                        </div>
                        <div className="mt-0.5 text-[8px] leading-tight text-muted-foreground">
                          {desbloqueada
                            ? new Date(desbloqueada.desbloqueada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })
                            : c.sub
                          }
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {/* Modal: termos do árbitro */}
      {showTermoArbitro && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 pb-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <div className="mb-4 flex items-center gap-2">
              <Shield size={20} className="text-primary-light" />
              <h3 className="text-lg font-bold">Termos do Árbitro VRENN</h3>
            </div>
            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>Ao se tornar árbitro no VRENN, você concorda com as seguintes responsabilidades:</p>
              <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                {[
                  "Você pode ser sorteado aleatoriamente para validar check-ins de metas e declarar resultados de duelos.",
                  "Ao receber um convite de arbitragem, você tem 24 horas para aceitar ou recusar.",
                  "Se aceitar, tem prazo para validar cada check-in. A omissão gera penalidade de -2 pts de reputação de árbitro.",
                  "Árbitros devem agir com imparcialidade. Validações injustificadas podem resultar em suspensão.",
                  "Como recompensa: +3 pts por check-in validado e +20 pts por resultado de duelo declarado.",
                  "Você pode desativar o opt-in a qualquer momento. Arbitragens já aceitas continuam até o encerramento.",
                ].map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 font-bold text-primary-light">{i + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                Ao clicar em "Aceitar e ativar", você declara ter lido e concordado com estas condições.
              </p>
            </div>




        <div className="mt-5 flex gap-2">
              <button onClick={() => setShowTermoArbitro(false)}
                className="flex-1 rounded-2xl border border-border py-3 text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={ativarArbitro}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow">
                <Shield size={14} /> Aceitar e ativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar desativação */}
      {showDesativarArbitro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5">
            <h3 className="mb-2 text-base font-bold">Desativar opt-in de árbitro?</h3>
            {(arbitroData?.arbitragens_ativas ?? 0) > 0 ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Você tem <span className="font-bold text-amber-400">{arbitroData?.arbitragens_ativas} arbitragem(ns) ativa(s)</span>.
                Você não será mais sorteado, mas precisará concluir as arbitragens já aceitas.
              </p>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                Você não será mais sorteado como árbitro. Pode reativar quando quiser.
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowDesativarArbitro(false)}
                className="flex-1 rounded-2xl border border-border py-2.5 text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={desativarArbitro}
                className="flex-1 rounded-2xl border border-destructive/40 bg-destructive/10 py-2.5 text-sm font-bold text-destructive">
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />

      {showUsernameModal && (
        <UsernameModal
          userId={user.id}
          currentName={profile?.nome ?? ""}
          onClose={() => setShowUsernameModal(false)}
          onSaved={() => { refetchProfile(); setShowUsernameModal(false); }}
        />
      )}
    </main>
  );
}

function UsernameModal({ userId, currentName, onClose, onSaved }: { userId: string; currentName: string; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState("");
  const [nome, setNome] = useState(currentName);
  const [loading, setLoading] = useState(false);

  async function save() {
    const clean = username.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) return toast.error("Use 3-20 caracteres: letras, números ou _");
    setLoading(true);
    const { data: exists } = await supabase.from("profiles").select("id").eq("username", clean).neq("id", userId).maybeSingle();
    if (exists) { setLoading(false); return toast.error("Username já em uso"); }
    const { error } = await supabase.from("profiles").update({ username: clean, nome: nome || currentName }).eq("id", userId);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Username salvo!");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6">
        <div>
          <h3 className="text-lg font-bold">Escolha seu @username</h3>
          <p className="mt-1 text-xs text-muted-foreground">Esse será seu identificador único no VRENN.</p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold">Nome de exibição</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold">Username</span>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
            <span className="text-sm text-muted-foreground">@</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seuusername"
              className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
          </div>
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground">Depois</button>
          <button onClick={save} disabled={loading} className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {loading ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Catálogo de Conquistas ──────────────────────────────────────────────────
const TODAS_CONQUISTAS = [
  // Primeiros passos
  { slug: "primeira_fagulha", emoji: "🔥", label: "Faísca", sub: "1º check-in", color: "#F59E0B" },
  { slug: "primeira_missao",  emoji: "🥇", label: "1ª Missão", sub: "1ª meta concluída", color: "#A855F7" },
  { slug: "espirito_de_equipe", emoji: "👥", label: "Equipe", sub: "Entrou numa equipe", color: "#38BDF8" },
  { slug: "desafiante",       emoji: "⚔️", label: "Desafiante", sub: "1º duelo aceito", color: "#EF4444" },
  // Streak
  { slug: "chama_acesa",      emoji: "🔥", label: "Chama Acesa", sub: "7 dias seguidos", color: "#F97316" },
  { slug: "rotina_de_ferro",  emoji: "💪", label: "Rotina de Ferro", sub: "30 dias seguidos", color: "#22D3A1" },
  { slug: "inabalavel",       emoji: "🏔️", label: "Inabalável", sub: "100 dias seguidos", color: "#A855F7" },
  // Volume
  { slug: "comprometido",     emoji: "✅", label: "Comprometido", sub: "10 check-ins", color: "#22D3A1" },
  { slug: "maquina",          emoji: "✅", label: "Máquina", sub: "50 check-ins", color: "#3B82F6" },
  { slug: "lendario_checkin", emoji: "✅", label: "200 Provas", sub: "200 check-ins", color: "#A855F7" },
  { slug: "cacador_de_metas", emoji: "🎯", label: "Caçador", sub: "5 metas concluídas", color: "#F59E0B" },
  { slug: "conquistador",     emoji: "🎯", label: "Conquistador", sub: "20 metas concluídas", color: "#A855F7" },
  // Duelo
  { slug: "primeira_vitoria", emoji: "⚔️", label: "1ª Vitória", sub: "1º duelo vencido", color: "#EF4444" },
  { slug: "dominante",        emoji: "👑", label: "Dominante", sub: "5 duelos vencidos", color: "#F59E0B" },
  { slug: "imbativel",        emoji: "💀", label: "Imbatível", sub: "10 duelos vencidos", color: "#7B2EFF" },
  // Social
  { slug: "influenciador",    emoji: "📣", label: "Influenciador", sub: "1k seguidores + 5k curtidas", color: "#F97316" },
  { slug: "referencia",       emoji: "🌟", label: "Referência", sub: "10k seguidores + 20k curtidas", color: "#FBBF24" },
  { slug: "icone",            emoji: "🏆", label: "Ícone", sub: "50k seguidores + 70k curtidas", color: "#A855F7" },
  // Reputação
  { slug: "prata_pura",       emoji: "💎", label: "Prata Pura", sub: "Nível Prata", color: "#C0C0C0" },
  { slug: "ouro_solido",      emoji: "💎", label: "Ouro Sólido", sub: "Nível Ouro", color: "#FFD700" },
  { slug: "diamante",         emoji: "💎", label: "Diamante", sub: "Nível Diamante", color: "#B9F2FF" },
  { slug: "lenda",            emoji: "👑", label: "Lenda", sub: "Nível Lenda", color: "#7B2EFF" },
  { slug: "master_concluido", emoji: "🏆", label: "Master Season", sub: "Concluiu o VRENN Master Season", color: "#FFD700" },
] as const;

function Hexagon({ color, children, glow = true }: { color: string; children: React.ReactNode; glow?: boolean }) {
  return (
    <div
      className="flex h-14 w-[52px] items-center justify-center text-xl font-bold"
      style={{
        clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
        background: `linear-gradient(135deg, ${color}45, ${color}12)`,
        color,
        filter: glow ? `drop-shadow(0 0 8px ${color}55)` : undefined,
      }}
    >
      {children}
    </div>
  );
}

const CATEGORIA_ICONS: Record<string, React.ElementType> = {
  fitness: Dumbbell,
  saude: Heart,
  estudos: BookOpen,
  financas: DollarSign,
  habitos: Calendar,
  outro: Sparkles,
};

function diasRestantes(prazo?: string | null) {
  if (!prazo) return null;
  return Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000);
}

function MetaCard({ meta, concluida }: { meta: any; concluida?: boolean }) {
  const Icon = CATEGORIA_ICONS[meta.categoria] ?? Target;
  const dias = diasRestantes(meta.prazo);
  const noPrazo = dias !== null && dias > 7;
  return (
    <Link to="/meta/$id" params={{ id: meta.id }} className="block rounded-2xl border border-border bg-card p-3">
      {concluida ? (
        <span className="inline-block rounded-md bg-green-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-green-400">Concluída</span>
      ) : noPrazo ? (
        <span className="inline-block rounded-md bg-green-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-green-400">No prazo</span>
      ) : (
        <span className="inline-block rounded-md bg-amber-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-400">Em andamento</span>
      )}

      <div className="mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary-light">
        <Icon size={16} />
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-snug">{meta.titulo}</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Meta pessoal</p>

      {concluida ? (
        <div className="mt-3 text-xs font-bold text-green-400">✓ 100%</div>
      ) : (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-gradient-primary" style={{ width: `${meta.progresso ?? 0}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold">{meta.progresso ?? 0} / 100</span>
            <span className="text-muted-foreground">{meta.progresso ?? 0}%</span>
          </div>
        </>
      )}

      {dias !== null && dias > 0 && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <Calendar size={12} /> Termina em {dias} dias
        </div>
      )}
    </Link>
  );
}

function DueloCard({ duelo, meId }: { duelo: any; meId: string }) {
  const souChallenger = duelo.challenger_id === meId;
  const oponente = souChallenger ? duelo.oponente : duelo.desafiante;
  const progresso = souChallenger ? (duelo.progresso_challenger ?? 0) : (duelo.progresso_opponent ?? 0);
  const dias = diasRestantes(duelo.prazo);
  return (
    <Link to="/duelo/$id" params={{ id: duelo.id }} className="block rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-block rounded-md bg-green-500/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-green-400">Ativo</span>
        {oponente?.avatar_url ? (
          <img src={oponente.avatar_url} alt={oponente.username ?? "Oponente"} className="h-8 w-8 rounded-full border border-border object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11px] font-bold">
            {(oponente?.nome ?? "?")[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className="mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary-light">
        <Swords size={16} />
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-snug">{duelo.titulo}</h3>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">com @{oponente?.username ?? "—"}</p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, progresso)}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="font-semibold">{progresso} / 100</span>
        <span className="text-muted-foreground">{progresso}%</span>
      </div>

      {dias !== null && dias > 0 && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <Calendar size={12} /> Termina em {dias} dias
        </div>
      )}
    </Link>
  );
}

function ActivityTile({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center" style={{ color }}>{icon}</div>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[9px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

