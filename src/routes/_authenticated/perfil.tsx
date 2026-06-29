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
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["my-metas", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
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
          <button className="rounded-full p-2 text-foreground/90"><Share size={20} /></button>
          <Link to="/configuracoes" className="rounded-full p-2 text-foreground/90"><Settings size={20} /></Link>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* Avatar + name */}
        <section className="flex items-center gap-4">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-2 border-primary p-0.5">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="h-full w-full rounded-full object-cover" />
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
              <BadgeCheck size={18} className="text-primary-light fill-primary/20" />
            </div>
            <p className="text-sm text-muted-foreground">@{profile?.username ?? "—"}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1">
              <Gem size={12} className="text-primary-light" />
              <span className="text-xs font-semibold text-primary-light">Nível Diamante</span>
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
              <p className="mt-1 text-xs text-muted-foreground">{profile?.bio ?? "Foco · Disciplina · Consistência"}</p>
            </div>
          </div>
        </section>

        {/* Conquistas */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Conquistas</h2>
            <button className="text-xs font-semibold text-primary-light">Ver todas</button>
          </div>
          <div className="flex justify-between gap-2">
            <Conquista icon={<Target size={22} />} label="Foco" sub="Nível 4" color="#A855F7" />
            <Conquista icon={<Flame size={22} />} label="Sequência" sub="180 dias" color="#22D3A1" />
            <Conquista icon={<Dumbbell size={22} />} label="Força Mental" sub="Nível 3" color="#F59E0B" />
            <Conquista icon={<Users size={22} />} label="Líder" sub="Nível 2" color="#38BDF8" />
            <Conquista icon={<Diamond size={22} />} label="Diamante" sub="Top 1%" color="#A855F7" />
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
            <button className="text-xs font-semibold text-primary-light">Ver relatório</button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <ActivityTile icon={<CheckCircle2 size={20} />} value={metas?.length ?? 0} label="Publicações" color="#A855F7" />
            <ActivityTile icon={<MessageCircle size={20} />} value={0} label="Comentários" color="#22D3A1" />
            <ActivityTile icon={<Heart size={20} />} value={0} label="Curtidas recebidas" color="#F59E0B" />
            <ActivityTile icon={<Users size={20} />} value={0} label="Seguidores" color="#38BDF8" />
            <ActivityTile icon={<TrendingUp size={20} />} value={0} label="Seguindo" color="#A855F7" />
          </div>
        </section>

        {/* Medalhas recentes */}
        <section className="mt-6 mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Medalhas recentes</h2>
            <button className="text-xs font-semibold text-primary-light">Ver todas</button>
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
          <p className="mt-1 text-xs text-muted-foreground">Esse será seu identificador único no VYRA.</p>
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
