import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import {
  Share, Settings, BadgeCheck, Gem, Edit3, Target, Flame, Dumbbell, Users, Diamond,
  CheckCircle2, MessageCircle, Heart, UserPlus, TrendingUp, ChevronRight, Info, Trophy, Zap, Sparkles, LogOut,
} from "lucide-react";
import { NivelBadge, nivelDoUsuario } from "@/components/NivelBadge";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

function Perfil() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [showUsernameModal, setShowUsernameModal] = useState(false);

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
  const ativa = (metas ?? []).find(m => m.status === "em_andamento");
  const initial = (profile?.nome ?? "?")[0]?.toUpperCase();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-3">
        <VyraLogo size={32} />
        <div className="flex items-center gap-1">
          <button onClick={() => {
            if (!profile?.username) return toast.error("Defina um username primeiro");
            navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`);
            toast.success("Link do perfil copiado!");
          }} className="rounded-full p-2 text-foreground/90"><Share size={20} /></button>

          <Link to="/configuracoes" className="rounded-full p-2 text-foreground/90"><Settings size={20} /></Link>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* Avatar + name */}
        <section className="flex items-center gap-4">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-2 border-primary p-0.5">
              {profile?.avatar_url ? (
                <img key={profile.avatar_url} src={profile.avatar_url} className="h-full w-full rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-primary text-2xl font-bold">{initial}</div>
              )}
            </div>
            <Link to="/perfil/editar" className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
              <Edit3 size={13} />
            </Link>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-2xl font-bold">{profile?.nome ?? "—"}</h1>
              {user.id === "52fd9ebb-5d88-4b33-acc3-97b70c62a426" && (
                <BadgeCheck size={18} className="text-primary-light fill-primary/20" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{profile?.username ?? "—"}</p>
            {profile?.bio && <p className="mt-1 text-xs text-foreground/80 whitespace-pre-line">{profile.bio}</p>}
            <div className="mt-2">
              <NivelBadge nivel={nivelDoUsuario(profile?.username, (profile as any)?.nivel)} size="md" />
            </div>
          </div>
        </section>

        {/* Stats row */}
        <section className="mt-6 grid grid-cols-4 gap-2 border-y border-border py-4">
          <BigStat value={concluidas} label="Metas concluídas" />
          <BigStat value={falhadas} label="Falhadas" />
          <BigStat value={`${disciplina}%`} label="Disciplina" />
          <BigStat value={profile?.reputacao_pts ?? 0} label="Reputação" accent info />
        </section>

        {/* Mission */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <Target size={18} className="text-primary-light" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-primary-light">{profile?.missao ? `Missão: ${profile.missao}` : "Missão: defina sua missão pessoal."}</h3>
                <Link to="/perfil/editar" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-light">
                  Editar <Edit3 size={12} />
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Foco · Disciplina · Consistência</p>
            </div>
          </div>
        </section>

        {/* Conquistas */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Conquistas</h2>
            <span className="text-xs text-muted-foreground">
              {(conquistasDesbloqueadas ?? []).length}/{TODAS_CONQUISTAS.length}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {TODAS_CONQUISTAS.map((c) => {
              const desbloqueada = (conquistasDesbloqueadas ?? []).find(x => x.slug === c.slug);
              return (
                <ConquistaCard
                  key={c.slug}
                  conquista={c}
                  desbloqueada={!!desbloqueada}
                  data={desbloqueada?.desbloqueada_em}
                />
              );
            })}
          </div>
        </section>

        {/* Meta em andamento */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold">Meta em andamento</h2>
          {ativa ? (
            <Link to="/meta/$id" params={{ id: ativa.id }} className="block rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex">
                {ativa.foto_capa_url ? (
                  <img src={ativa.foto_capa_url} className="h-36 w-28 object-cover" />
                ) : (
                  <div className="h-36 w-28 bg-gradient-primary" />
                )}
                <div className="flex-1 p-4">
                  <h3 className="text-lg font-bold">{ativa.titulo}</h3>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Em andamento
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-gradient-primary" style={{ width: `${ativa.progresso}%` }} />
                      </div>
                    </div>
                    <span className="ml-3 text-lg font-bold text-primary-light">{ativa.progresso}%</span>
                  </div>
                  <div className="mt-2 flex items-center justify-end text-xs text-muted-foreground">
                    <ChevronRight size={14} className="text-primary-light" />
                    <span className="text-primary-light font-semibold">Ver meta</span>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <Link to="/nova-meta" className="block rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhuma meta ativa. <span className="text-primary-light font-semibold">Criar uma agora</span>
            </Link>
          )}
        </section>

        {/* Resumo de atividade */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Resumo de atividade</h2>
            <button onClick={() => toast("Em breve")} className="text-xs font-semibold text-primary-light">Ver relatório</button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <Link to="/perfil/publicacoes" className="block"><ActivityTile icon={<CheckCircle2 size={20} />} value={profileStats?.publicacoes ?? 0} label="Publicações" color="#A855F7" /></Link>
            <ActivityTile icon={<MessageCircle size={20} />} value={profileStats?.comentarios ?? 0} label="Comentários" color="#22D3A1" />
            <ActivityTile icon={<Heart size={20} />} value={profileStats?.curtidasRecebidas ?? 0} label="Curtidas recebidas" color="#F59E0B" />
            <Link to="/perfil/seguidores" className="block"><ActivityTile icon={<Users size={20} />} value={profileStats?.seguidores ?? 0} label="Seguidores" color="#38BDF8" /></Link>
            <Link to="/perfil/seguindo" className="block"><ActivityTile icon={<TrendingUp size={20} />} value={profileStats?.seguindo ?? 0} label="Seguindo" color="#A855F7" /></Link>
          </div>
        </section>

        {/* Medalhas recentes */}
        <section className="mt-6 mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Medalhas recentes</h2>
            <button onClick={() => toast("Em breve")} className="text-xs font-semibold text-primary-light">Ver todas</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Medal icon={<Flame size={16} />} title={`Sequência ${profile?.streak_dias ?? 0} dias`} sub="hoje" color="#A855F7" />
            <Medal icon={<Trophy size={16} />} title="Meta Concluída" sub={`${concluidas} vezes`} color="#F59E0B" />
            <Medal icon={<Sparkles size={16} />} title="Foco Inabalável" sub={`Nível ${profile?.nivel ?? 1}`} color="#22D3A1" />
            <Medal icon={<Zap size={16} />} title="Disciplina Extrema" sub="Nível 3" color="#38BDF8" />
          </div>
        </section>
      </div>

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 space-y-4">
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
] as const;

function ConquistaCard({ conquista, desbloqueada, data }: {
  conquista: typeof TODAS_CONQUISTAS[number];
  desbloqueada: boolean;
  data?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="relative flex flex-col items-center" onClick={() => setShowTip(v => !v)}>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl transition-all ${
          desbloqueada ? "shadow-glow" : "opacity-30 grayscale"
        }`}
        style={desbloqueada ? {
          background: `${conquista.color}22`,
          border: `1px solid ${conquista.color}55`,
        } : {
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {conquista.emoji}
      </div>
      <div className="mt-1 text-center">
        <div className={`text-[9px] font-semibold leading-tight ${desbloqueada ? "text-foreground" : "text-muted-foreground"}`}>
          {conquista.label}
        </div>
      </div>
      {/* Tooltip */}
      {showTip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-36 rounded-xl border border-border bg-card p-2.5 shadow-xl text-center">
          <div className="text-xs font-bold">{conquista.label}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{conquista.sub}</div>
          {desbloqueada && data && (
            <div className="mt-1 text-[9px] text-accent font-semibold">
              ✓ {new Date(data).toLocaleDateString("pt-BR")}
            </div>
          )}
          {!desbloqueada && (
            <div className="mt-1 text-[9px] text-muted-foreground">🔒 Ainda não desbloqueada</div>
          )}
        </div>
      )}
    </div>
  );
}

function BigStat({ value, label, accent, info }: { value: number | string; label: string; accent?: boolean; info?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${accent ? "text-primary-light" : ""}`}>{value}</div>
      <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground leading-tight">
        {label} {info && <Info size={10} />}
      </div>
    </div>
  );
}

function Conquista({ icon, label, sub, color }: { icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <div
        className="flex h-14 w-14 items-center justify-center"
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

function ActivityTile({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center" style={{ color }}>{icon}</div>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[9px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function Medal({ icon, title, sub, color }: { icon: React.ReactNode; title: string; sub: string; color: string }) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-2xl border bg-card px-3 py-2.5"
      style={{ borderColor: `${color}50` }}
    >
      <span style={{ color }}>{icon}</span>
      <div>
        <div className="text-[11px] font-semibold" style={{ color }}>{title}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
