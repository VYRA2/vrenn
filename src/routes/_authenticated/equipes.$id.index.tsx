import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import {
  ArrowLeft, MoreHorizontal, Users, Calendar, BadgeCheck, Trophy, Coins, Target,
  Dumbbell, BookOpen, Zap, Brain, ChevronRight, Shield, UserPlus, Sparkles, Copy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipes/$id/")({
  component: EquipeProfile,
});

type Tab = "resumo" | "membros" | "desafios";

const TABS: { id: Tab; label: string }[] = [
  { id: "resumo", label: "Visão geral" },
  { id: "membros", label: "Membros" },
  { id: "desafios", label: "Desafios" },
];

const CATEGORIA_ICON: Record<string, any> = {
  saude: Dumbbell, fitness: Dumbbell, estudos: BookOpen, leitura: BookOpen,
  financas: Coins, trabalho: Brain, foco: Zap,
};

function fmtData(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function EquipeProfile() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  const [tab, setTab] = useState<Tab>("resumo");

  const { data: equipe, isLoading: loadingEquipe } = useQuery({
    queryKey: ["equipe", id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("equipes").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: membros, isLoading: loadingMembros } = useQuery({
    queryKey: ["equipe-membros", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("equipe_membros")
        .select("user_id, papel, created_at, profiles:user_id (nome, username, avatar_url)")
        .eq("equipe_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: desafios, isLoading: loadingDesafios } = useQuery({
    queryKey: ["equipe-desafios", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("desafios_equipe")
        .select("*")
        .eq("equipe_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (loadingEquipe) {
    return (
      <main className="min-h-screen bg-background px-5 pt-6">
        <div className="mx-auto max-w-md animate-pulse space-y-4">
          <div className="h-28 rounded-2xl bg-card" />
          <div className="h-40 rounded-2xl bg-card" />
        </div>
      </main>
    );
  }

  if (!equipe) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 text-center">
        <div>
          <h2 className="text-lg font-bold">Equipe não encontrada</h2>
          <button onClick={() => navigate({ to: "/equipes" })} className="mt-4 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Voltar</button>
        </div>
      </main>
    );
  }

  const totalEmJogo = (desafios ?? []).reduce((s: number, d: any) => s + Number(d.valor_entrada ?? 0), 0);
  const ativos = (desafios ?? []).filter((d: any) => d.status === "ativo").length;
  const concluidos = (desafios ?? []).filter((d: any) => d.status === "concluido").length;
  const souAdmin = (membros ?? []).some((m: any) => m.user_id === user.id && m.papel === "admin");

  async function convidar() {
    const link = `${window.location.origin}/equipes/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de convite copiado!");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2">
        <button onClick={() => navigate({ to: "/equipes" })} className="flex h-9 w-9 items-center justify-center rounded-full text-primary-light">
          <ArrowLeft size={20} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary-light"><MoreHorizontal size={16} /></button>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* Hero */}
        <section className="flex items-start gap-4">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-primary/60 bg-gradient-to-br from-primary/30 to-background shadow-glow">
            {equipe.avatar_url ? (
              <img src={equipe.avatar_url} className="h-full w-full object-cover" />
            ) : (
              <Shield size={64} className="text-primary-light drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]" fill="currentColor" fillOpacity={0.25} />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black truncate">{equipe.nome}</h1>
              {equipe.publica && <BadgeCheck size={20} className="text-primary-light shrink-0" />}
            </div>
            {equipe.descricao && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{equipe.descricao}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users size={13} className="text-primary-light" /> {(membros ?? []).length} membros</span>
              <span className="inline-flex items-center gap-1"><Calendar size={13} className="text-primary-light" /> Desde {fmtData(equipe.created_at)}</span>
              <span className="rounded-full border border-primary bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold capitalize text-primary-light">{equipe.categoria}</span>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="mt-6 flex gap-4 overflow-x-auto border-b border-border -mx-5 px-5 pb-0.5">
          {TABS.map((t) => {
            const a = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`relative shrink-0 pb-2 text-sm font-semibold ${a ? "text-primary-light" : "text-muted-foreground"}`}>
                {t.label}
                {a && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {tab === "resumo" && (
          <>
            {/* Card stats */}
            <section className="mt-4 rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">Desafios da equipe</h3>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <QuickStat icon={<Trophy size={20} />} value={String((desafios ?? []).length)} label="Desafios criados" />
                <QuickStat icon={<Coins size={20} />} value={fmtMoeda(totalEmJogo)} label="Total em jogo" small />
                <QuickStat icon={<Sparkles size={20} />} value={String(ativos)} label="Em andamento" />
                <QuickStat icon={<Target size={20} />} value={String(concluidos)} label="Concluídos" />
              </div>
            </section>

            {/* Últimos desafios */}
            <div className="mt-6 mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">Desafios</h3>
              {souAdmin && (
                <button onClick={() => navigate({ to: "/equipes/$id/desafio/novo", params: { id } })} className="text-xs font-semibold text-primary-light">+ Novo</button>
              )}
            </div>
            {loadingDesafios ? (
              <div className="h-16 animate-pulse rounded-2xl bg-card" />
            ) : (desafios ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Nenhum desafio criado ainda nesta equipe.
              </div>
            ) : (
              <div className="space-y-2">
                {(desafios ?? []).map((d: any) => {
                  const Icon = CATEGORIA_ICON[d.categoria] ?? Zap;
                  const ok = d.status === "concluido";
                  return (
                    <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary-light">
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{d.titulo}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {d.data_fim ? `Até ${fmtData(d.data_fim)}` : `${d.duracao_dias} dias`} · {d.duracao_dias} dias
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{fmtMoeda(Number(d.valor_entrada ?? 0))}</div>
                        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold capitalize ${ok ? "text-accent" : "text-primary-light"}`}>
                          {d.status}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Banner */}
            <Link to="/desafio-temporada" className="mt-6 block overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/5 to-background p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/25 text-primary-light">
                  <Trophy size={26} />
                </div>
                <div>
                  <h4 className="text-base font-bold">Juntos somos mais fortes</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Cada desafio é um passo rumo à nossa melhor versão. Continuem firmes.</p>
                </div>
              </div>
            </Link>

            {/* Sobre */}
            <section className="mt-6 rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">Sobre a equipe</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {equipe.descricao || equipe.regras || "Esta equipe ainda não adicionou uma descrição."}
              </p>
            </section>
          </>
        )}

        {tab === "membros" && (
          <div className="mt-4">
            {loadingMembros ? (
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {(membros ?? []).map((m: any) => (
                  <Link
                    key={m.user_id}
                    to="/u/$username"
                    params={{ username: m.profiles?.username ?? "" }}
                    disabled={!m.profiles?.username}
                    className="rounded-2xl border border-border bg-card p-2 text-center"
                  >
                    <div className="relative mx-auto h-14 w-14">
                      {m.profiles?.avatar_url ? (
                        <img src={m.profiles.avatar_url} className="h-full w-full rounded-full border-2 border-primary/60 object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-lg font-bold">
                          {(m.profiles?.nome ?? "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      {m.papel === "admin" && <BadgeCheck size={13} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary text-primary-foreground" />}
                    </div>
                    <div className="mt-2 text-[11px] font-bold truncate">{m.profiles?.nome ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">@{m.profiles?.username ?? "—"}</div>
                    {m.papel === "admin" && <div className="mt-1 rounded-full border border-accent/40 px-1.5 py-0.5 text-[9px] text-accent">Admin</div>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "desafios" && (
          <div className="mt-4 space-y-2">
            {(desafios ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Nenhum desafio criado ainda.
              </div>
            ) : (
              (desafios ?? []).map((d: any) => (
                <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold">{d.titulo}</h4>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold capitalize text-primary-light">{d.status}</span>
                  </div>
                  {d.descricao && <p className="mt-1 text-xs text-muted-foreground">{d.descricao}</p>}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{fmtMoeda(Number(d.valor_entrada ?? 0))}</span>
                    <span>{d.duracao_dias} dias</span>
                    <span>{fmtData(d.data_inicio)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Ações */}
        <div className="mt-5 flex gap-2">
          <button onClick={convidar} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary py-3 text-sm font-bold text-primary-light">
            <UserPlus size={16} /> Convidar membros
          </button>
          <button onClick={() => navigate({ to: "/equipes/$id/desafio/novo", params: { id } })} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow">
            <Sparkles size={16} /> Criar desafio
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function QuickStat({ icon, value, label, small }: { icon: React.ReactNode; value: string; label: string; small?: boolean }) {
  return (
    <div>
      <div className="mx-auto flex h-8 items-center justify-center text-primary-light">{icon}</div>
      <div className={`mt-1 font-bold ${small ? "text-[13px]" : "text-lg"}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}
