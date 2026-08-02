import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import {
  ArrowLeft, MoreHorizontal, Zap, Calendar,
  Target, Video, MessageCircle, Layers, Swords,
  Loader2, X, Dumbbell, BookOpen, DollarSign, Brain } from "lucide-react";
import { NivelBadge, nivelDoUsuario } from "@/components/NivelBadge";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useState } from "react";
import { subcategoriaSuportaStrava } from "@/lib/categorias";
import { ObjetivoKmPicker } from "@/components/ObjetivoKmPicker";
import { SubcategoriaPicker } from "@/components/SubcategoriaPicker";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: PerfilPublico,
});

type Tab = "ativo" | "conquistas" | "concluidas" | "feed";

function PerfilPublico() {
  const navigate = useNavigate();
  const { username } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("ativo");

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, username, avatar_url, bio, missao, nivel, created_at, perfil_publico")
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
      const [{ count: posts }, { count: seguidores }, { count: seguindo }, { count: metasAtivas }] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", targetId!),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId!).eq("status", "aceito"),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId!).eq("status", "aceito"),
        supabase.from("metas").select("*", { count: "exact", head: true }).eq("user_id", targetId!).eq("status", "em_andamento"),
      ]);
      return { posts: posts ?? 0, seguidores: seguidores ?? 0, seguindo: seguindo ?? 0, metasAtivas: metasAtivas ?? 0 };
    },
  });

  const { data: metas } = useQuery({
    enabled: !!targetId,
    queryKey: ["public-metas", targetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("metas")
        .select("id, titulo, categoria, status, progresso, prazo, foto_capa_url, created_at")
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
    enabled: !!targetId,
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

  // Últimos 7 dias de atividade (posts) para o sparkline
  const { data: serie7d } = useQuery({
    enabled: !!targetId,
    queryKey: ["public-posts-7d", targetId],
    queryFn: async () => {
      const desde = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("posts")
        .select("created_at")
        .eq("user_id", targetId!)
        .gte("created_at", desde);
      const buckets: { d: string; v: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        buckets.push({ d: day, v: 0 });
      }
      (data ?? []).forEach((p: any) => {
        const day = String(p.created_at).slice(0, 10);
        const b = buckets.find((x) => x.d === day);
        if (b) b.v += 1;
      });
      return buckets;
    },
  });

  const { data: duelosAtivos } = useQuery({
    enabled: !!targetId && tab === "ativo",
    queryKey: ["public-duelos-ativos", targetId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("duelos")
        .select("id, titulo, prazo, progresso_challenger, progresso_opponent, challenger_id, opponent_id, oponente:profiles!opponent_id(nome, username, avatar_url), desafiante:profiles!challenger_id(nome, username, avatar_url)")
        .or(`challenger_id.eq.${targetId},opponent_id.eq.${targetId}`)
        .eq("status", "ativo")
        .limit(4);
      return (data ?? []) as any[];
    },
  });

  async function toggleFollow() {
    if (!targetId) return;
    if (follow) {
      await supabase.from("follows").delete().eq("id", follow.id);
      toast.success(solicitacaoPendente ? "Solicitação cancelada" : "Deixou de seguir");
    } else {
      const followStatus = isPrivado ? "pendente" : "aceito";
      const { error } = await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: targetId,
        status: followStatus,
      });
      if (error && !error.message.includes("duplicate")) return toast.error(error.message);
      if (isPrivado) {
        await supabase.rpc("notify", {
          _user_id: targetId,
          _tipo: "follow_request",
          _mensagem: `@${profile?.username ?? "alguém"} quer te seguir. Aceite ou recuse nas notificações.`,
          _link_id: undefined,
        });
        toast.success("Solicitação enviada!");
      } else {
        toast.success("Seguindo!");
      }
    }
    refetchFollow();
    qc.invalidateQueries({ queryKey: ["public-counters", targetId] });
  }

  const concluidas = (metas ?? []).filter(m => m.status === "concluida");
  const falhadas = (metas ?? []).filter(m => m.status === "falhada");
  const ativas = (metas ?? []).filter(m => m.status === "em_andamento" || !m.status);
  const disciplina = (concluidas.length + falhadas.length) > 0
    ? Math.round((concluidas.length / (concluidas.length + falhadas.length)) * 100)
    : 0;

  const initial = (profile?.nome ?? "?")[0]?.toUpperCase();
  const seguindoNow = follow?.status === "aceito";
  const [showDesafiar, setShowDesafiar] = useState(false);
  const [dueloTitulo, setDueloTitulo] = useState("");
  const [dueloCategoria, setDueloCategoria] = useState("");
  const [dueloSubcat, setDueloSubcat] = useState<string | null>(null);
  const [dueloKm, setDueloKm] = useState<number | null>(null);
  const [dueloLivre, setDueloLivre] = useState(false);
  const [dueloCustodia, setDueloCustodia] = useState("10");
  const [dueloPrazo, setDueloPrazo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [criandoDuelo, setCriandoDuelo] = useState(false);
  const solicitacaoPendente = follow?.status === "pendente";
  const isPrivado = profile?.perfil_publico === false;
  const podeVerConteudo = !isPrivado || seguindoNow;

  const nivelNum = (profile as any)?.nivel ?? 1;
  const xpAtual = stats?.reputacao_pts ?? 0;
  const xpAlvo = nivelNum * 1000 + 2200;

  async function criarDuelo() {
    if (!dueloTitulo.trim()) return toast.error("Adicione um título ao duelo");
    if (!dueloCategoria) return toast.error("Selecione uma categoria");
    setCriandoDuelo(true);
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (!me) throw new Error("Não autenticado");
      const { data: oponente } = await (supabase as any)
        .from("profiles").select("id").eq("username", username).maybeSingle();
      if (!oponente) throw new Error("Usuário não encontrado");

      const { data: duelo, error } = await (supabase as any).from("duelos").insert({
        titulo: dueloTitulo.trim(),
        challenger_id: me.id,
        opponent_id: oponente.id,
        categoria: dueloCategoria,
        subcategoria: dueloSubcat,
        modalidade: dueloSubcat,
        objetivo_km: subcategoriaSuportaStrava(dueloSubcat) && !dueloLivre ? dueloKm : null,
        valor_custodia: Number(dueloCustodia) || 0,
        prazo: dueloPrazo,
        status: "pendente",
      }).select().single();

      if (error) throw error;

      await supabase.rpc("notify" as any, {
        _user_id: oponente.id,
        _tipo: "duelo_convite",
        _mensagem: `${me.email} te desafiou para um duelo: "${dueloTitulo}"`,
        _link_id: duelo.id,
      });

      toast.success("Desafio enviado! Aguardando aceitação.");
      setShowDesafiar(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar duelo");
    } finally {
      setCriandoDuelo(false);
    }
  }

  const conquistasRecentes = (conquistasPublicas ?? []).slice(0, 5);
  const restanteConquistas = Math.max(0, (conquistasPublicas ?? []).length - 5);

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto grid max-w-md grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
          <button onClick={() => history.back()} aria-label="Voltar" className="rounded-full p-1.5 text-foreground">
            <ArrowLeft size={22} />
          </button>
          <div className="justify-self-center text-lg font-bold tracking-wide text-white">VRENN</div>
          <button aria-label="Mais opções" className="rounded-full p-1.5 text-foreground">
            <MoreHorizontal size={22} />
          </button>
        </div>
      </header>

      {loadingProfile && <div className="mx-auto max-w-md px-5 pt-5"><div className="h-64 animate-pulse rounded-2xl bg-card" /></div>}

      {!loadingProfile && !profile && (
        <div className="mx-auto max-w-md px-5 pt-5">
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Usuário não encontrado.
          </div>
        </div>
      )}

      {profile && (
        <div className="mx-auto max-w-md px-5 pt-5">
          {/* Identidade */}
          <section className="flex items-start gap-4">
            <div className="shrink-0">
              <div
                className="h-[88px] w-[88px] rounded-full border-2 border-primary p-0.5"
                style={{ boxShadow: "0 0 24px 4px rgba(168,85,247,0.45)" }}
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} className="h-full w-full rounded-full object-cover" alt={`Foto de ${profile.nome ?? profile.username}`} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold">{initial}</div>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold text-white">{profile.nome ?? "—"}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <div className="mt-1.5">
                <NivelBadge nivel={nivelDoUsuario(profile.username, nivelNum, profile.id)} size="sm" />
              </div>
              {profile.missao && <p className="mt-1.5 text-sm text-foreground/80">{profile.missao}</p>}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://vrenn.app/@${profile.username}`);
                  toast.success("Link copiado!");
                }}
                className="mt-1 text-sm text-primary-light"
              >
                vrenn.app/@{profile.username}
              </button>
            </div>
          </section>

          {/* Ações */}
          <section className="mt-4 flex items-center gap-2">
            <button
              onClick={toggleFollow}
              className={`h-11 flex-1 rounded-2xl border text-sm font-bold transition-colors ${
                seguindoNow
                  ? "border-primary bg-primary text-primary-foreground"
                  : solicitacaoPendente
                  ? "border-border bg-card text-muted-foreground"
                  : "border-primary bg-transparent text-primary-light"
              }`}
            >
              {seguindoNow ? "Seguindo ✓" : solicitacaoPendente ? "⏳ Solicitado" : isPrivado ? "🔒 Solicitar" : "Seguir"}
            </button>
            <button
              onClick={() => setShowDesafiar(true)}
              className="flex h-11 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary-light"
              title="Desafiar para duelo"
            >
              <Swords size={18} />
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

          {/* Perfil privado bloqueado */}
          {isPrivado && !podeVerConteudo && (
            <div className="mt-8 flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-card text-4xl">🔒</div>
              <div>
                <div className="text-base font-bold">Perfil privado</div>
                <div className="mt-1 text-sm text-muted-foreground max-w-xs">
                  Siga {profile.nome?.split(" ")[0] ?? "@" + profile.username} para ver as publicações, metas e conquistas.
                </div>
              </div>
              {solicitacaoPendente && (
                <div className="rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                  Sua solicitação está pendente de aprovação.
                </div>
              )}
            </div>
          )}

          {podeVerConteudo && (
            <>
              {/* Stats */}
              <section className="mt-5 grid grid-cols-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-foreground">{formatCount(counters?.seguidores ?? 0)}</div>
                  <div className="text-xs text-muted-foreground">Seguidores</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{formatCount(counters?.seguindo ?? 0)}</div>
                  <div className="text-xs text-muted-foreground">Seguindo</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{counters?.metasAtivas ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Metas ativas</div>
                </div>
              </section>

              {/* Card duplo */}
              <section className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Taxa de execução</div>
                  <div className="text-3xl font-black text-primary-light">{disciplina}%</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">12% desde o mês passado</div>
                  <div className="mt-2 h-9 w-[110px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={serie7d ?? []}>
                        <Line type="monotone" dataKey="v" stroke="#A855F7" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="border-l border-border pl-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Nível</div>
                  <div
                    className="mt-2 flex h-12 w-12 items-center justify-center text-xl font-black text-primary-light"
                    style={{
                      clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                      background: "#A855F720",
                      border: "1px solid #A855F750",
                    }}
                  >
                    {nivelNum}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{xpAtual} / {xpAlvo} XP</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, Math.round((xpAtual / Math.max(1, xpAlvo)) * 100))}%` }} />
                  </div>
                </div>
              </section>

              {/* Conquistas recentes */}
              <section className="mt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-widest">Conquistas recentes</h2>
                  <button onClick={() => setTab("conquistas")} className="text-xs text-primary-light">Ver todas</button>
                </div>
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                  {conquistasRecentes.length === 0 && (
                    <div className="text-xs text-muted-foreground">Nenhuma conquista ainda.</div>
                  )}
                  {conquistasRecentes.map((cq) => {
                    const c = CONQUISTAS_CATALOGO.find((x) => x.slug === cq.slug);
                    if (!c) return null;
                    return (
                      <div key={cq.slug} className="w-14 shrink-0">
                        <div
                          className="mx-auto flex h-[52px] w-[52px] items-center justify-center text-2xl"
                          style={{
                            clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                            background: `${c.color}22`,
                            border: `1px solid ${c.color}55`,
                          }}
                        >
                          {c.emoji}
                        </div>
                        <div className="mt-1 text-center text-[9px] font-semibold leading-tight">{c.label}</div>
                        <div className="text-center text-[8px] text-muted-foreground">
                          {new Date(cq.desbloqueada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </div>
                      </div>
                    );
                  })}
                  {restanteConquistas > 0 && (
                    <div className="flex h-[52px] shrink-0 items-center justify-center rounded-full bg-secondary px-3 text-xs font-bold text-muted-foreground">
                      +{restanteConquistas}
                    </div>
                  )}
                </div>
              </section>

              {/* Abas */}
              <div className="mt-6 flex border-b border-border">
                {([
                  ["ativo", "Ativo"],
                  ["conquistas", "Conquistas"],
                  ["concluidas", "Metas concluídas"],
                  ["feed", "Feed"],
                ] as const).map(([k, l]) => {
                  const active = tab === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setTab(k as Tab)}
                      className={`relative flex-1 py-3 text-[11px] font-semibold transition-colors ${
                        active ? "text-primary-light" : "text-muted-foreground"
                      }`}
                    >
                      {l}
                      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>

              {/* Conteúdo das abas */}
              <div className="mt-4">
                {tab === "ativo" && (
                  <div className="space-y-6">
                    <section>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest">Metas ativas</h3>
                        <button onClick={() => setTab("concluidas")} className="text-xs text-primary-light">Ver todas</button>
                      </div>
                      {ativas.length === 0 ? (
                        <div className="mt-3"><EmptyTab msg="Sem metas ativas." /></div>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {ativas.map((m: any) => {
                            const dias = m.prazo ? Math.ceil((new Date(m.prazo).getTime() - Date.now()) / 86400000) : null;
                            const noPrazo = (dias ?? 0) > 7;
                            return (
                              <Link key={m.id} to="/meta/$id" params={{ id: m.id }} className="rounded-2xl border border-border bg-card p-3">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${noPrazo ? "bg-accent/15 text-accent" : "bg-yellow-500/15 text-yellow-500"}`}>
                                  {noPrazo ? "No prazo" : "Em andamento"}
                                </span>
                                <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary-light">
                                  <CategoriaIcon categoria={m.categoria} />
                                </div>
                                <div className="mt-2 text-sm font-bold leading-tight">{m.titulo}</div>
                                <div className="text-[11px] text-muted-foreground">Meta pessoal</div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                                  <div className="h-full bg-gradient-primary" style={{ width: `${m.progresso ?? 0}%` }} />
                                </div>
                                <div className="mt-1 flex justify-between text-[11px]">
                                  <span className="text-muted-foreground">— / —</span>
                                  <span className="font-bold text-primary-light">{m.progresso ?? 0}%</span>
                                </div>
                                {dias !== null && (
                                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Calendar size={11} /> Termina em {Math.max(0, dias)} dias
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <section>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest">Duelos participando</h3>
                        <Link to="/duelos" search={{ criar: false }} className="text-xs text-primary-light">Ver todas</Link>
                      </div>
                      {(duelosAtivos ?? []).length === 0 ? (
                        <div className="mt-3"><EmptyTab msg="Sem duelos ativos." /></div>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {(duelosAtivos ?? []).map((d: any) => {
                            const souChallenger = targetId === d.challenger_id;
                            const opp = souChallenger ? d.oponente : d.desafiante;
                            const prog = (souChallenger ? d.progresso_challenger : d.progresso_opponent) ?? 0;
                            const dias = d.prazo ? Math.max(0, Math.ceil((new Date(d.prazo).getTime() - Date.now()) / 86400000)) : null;
                            return (
                              <Link key={d.id} to="/duelo/$id" params={{ id: d.id }} className="rounded-2xl border border-border bg-card p-3">
                                <div className="flex items-start justify-between">
                                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase text-accent">Ativo</span>
                                  {opp?.avatar_url ? (
                                    <img src={opp.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
                                  ) : (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-[10px] font-bold">
                                      {(opp?.nome ?? "?")[0]?.toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary-light">
                                  <Swords size={16} />
                                </div>
                                <div className="mt-2 text-sm font-bold leading-tight">{d.titulo}</div>
                                <div className="text-[11px] text-muted-foreground">com @{opp?.username ?? "—"}</div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                                  <div className="h-full bg-gradient-primary" style={{ width: `${prog}%` }} />
                                </div>
                                <div className="mt-1 flex justify-between text-[11px]">
                                  <span className="text-muted-foreground">{dias !== null ? `${Math.max(0, 30 - dias)} / 30 dias` : "— / 30 dias"}</span>
                                  <span className="font-bold text-primary-light">{prog}%</span>
                                </div>
                                {dias !== null && (
                                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Calendar size={11} /> Termina em {dias} dias
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {tab === "conquistas" && (
                  <div className="grid grid-cols-4 gap-3">
                    {CONQUISTAS_CATALOGO.map((c) => {
                      const cq = (conquistasPublicas ?? []).find((x) => x.slug === c.slug);
                      const unlocked = !!cq;
                      return (
                        <div key={c.slug} className={`flex flex-col items-center ${unlocked ? "" : "opacity-30 grayscale"}`}>
                          <div
                            className="flex h-[52px] w-[52px] items-center justify-center text-2xl"
                            style={{
                              clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                              background: `${c.color}22`,
                              border: `1px solid ${c.color}55`,
                              boxShadow: unlocked ? `0 0 14px ${c.color}55` : undefined,
                            }}
                          >
                            {c.emoji}
                          </div>
                          <div className="mt-1 text-center text-[9px] font-semibold leading-tight">{c.label}</div>
                          {unlocked && (
                            <div className="text-center text-[8px] text-muted-foreground">
                              {new Date(cq!.desbloqueada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab === "concluidas" && (
                  <>
                    {concluidas.length === 0 ? (
                      <EmptyTab msg="Nenhuma meta concluída ainda." />
                    ) : (
                      <div className="space-y-2">
                        {concluidas.map((m: any) => (
                          <Link key={m.id} to="/meta/$id" params={{ id: m.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
                              <CategoriaIcon categoria={m.categoria} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold">{m.titulo}</div>
                              <div className="text-[11px] capitalize text-muted-foreground">{m.categoria ?? "—"}</div>
                            </div>
                            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase text-accent">✓ Concluída</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}

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
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal de desafio */}
      {showDesafiar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-8 max-h-[90vh] overflow-y-auto">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2"><Swords size={18} className="text-primary-light" /> Desafiar</h3>
                <p className="text-xs text-muted-foreground">@{username}</p>
              </div>
              <button onClick={() => setShowDesafiar(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {/* Título */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Título do duelo</label>
                <input
                  value={dueloTitulo}
                  onChange={(e) => setDueloTitulo(e.target.value)}
                  placeholder="Ex: Quem corre mais em 30 dias?"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Categoria</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "fitness", label: "Fitness" },
                    { id: "esportes", label: "Esportes" },
                    { id: "saude", label: "Saúde" },
                    { id: "estudos", label: "Estudos" },
                    { id: "financas", label: "Finanças" },
                    { id: "habitos", label: "Hábitos" },
                  ].map(({ id, label }) => (
                    <button key={id} type="button"
                      onClick={() => { setDueloCategoria(id); setDueloSubcat(null); setDueloKm(null); setDueloLivre(false); }}
                      className={"rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " + (dueloCategoria === id ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategoria */}
              {dueloCategoria && (
                <SubcategoriaPicker
                  categoria={dueloCategoria}
                  value={dueloSubcat}
                  onChange={(v) => { setDueloSubcat(v); setDueloKm(null); setDueloLivre(false); }}
                  label="Modalidade"
                />
              )}

              {/* Objetivo km */}
              {subcategoriaSuportaStrava(dueloSubcat) && (
                <ObjetivoKmPicker
                  subcategoria={dueloSubcat!}
                  objetivoKm={dueloKm}
                  modoLivre={dueloLivre}
                  onChange={(km, livre) => { setDueloKm(km); setDueloLivre(livre); }}
                />
              )}

              {/* Custódia e prazo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Custódia (R$)</label>
                  <input type="number" min="0" value={dueloCustodia} onChange={(e) => setDueloCustodia(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Prazo final</label>
                  <input type="date" value={dueloPrazo} onChange={(e) => setDueloPrazo(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </div>
              </div>

              <button onClick={criarDuelo} disabled={criandoDuelo || !dueloTitulo.trim() || !dueloCategoria}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
                {criandoDuelo ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
                Enviar desafio para @{username}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function CategoriaIcon({ categoria }: { categoria?: string | null }) {
  switch (categoria) {
    case "fitness": return <Dumbbell size={18} />;
    case "estudos": return <BookOpen size={18} />;
    case "financas": return <DollarSign size={18} />;
    case "habitos": return <Target size={18} />;
    case "saude": return <Brain size={18} />;
    default: return <Zap size={18} />;
  }
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
  { slug: "lenda",              emoji: "👑", label: "Lenda",          color: "#7B2EFF" },
  { slug: "master_concluido",   emoji: "🏆", label: "Master Season",  color: "#FFD700" },
] as const;
