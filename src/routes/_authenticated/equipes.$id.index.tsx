
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { QrCodeExportCard } from "@/components/QrCodeExportCard";
import { ValidacaoStep, type TipoValidacao } from "@/components/ValidacaoStep";
import {
  ArrowLeft, MoreHorizontal, Users, Calendar, BadgeCheck, Trophy, Coins, Target, Camera,
  Dumbbell, BookOpen, Zap, Brain, ChevronRight, Shield, UserPlus, Sparkles, Copy, LogIn, CheckCircle2, Loader2,
  Pencil, Trash2, LogOut, X, QrCode, Lock, Heart, DollarSign,
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
  const [entrando, setEntrando] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [desafioEditando, setDesafioEditando] = useState<any>(null);
  const [desafioCheckin, setDesafioCheckin] = useState<any>(null);
  const qc = useQueryClient();

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

  const { data: participacoes } = useQuery({
    queryKey: ["equipe-desafios-participacoes", id, user.id],
    queryFn: async () => {
      if (!desafios?.length) return [];
      const ids = desafios.map((d: any) => d.id);
      const { data } = await (supabase as any)
        .from("desafio_equipe_participantes")
        .select("desafio_id, status")
        .in("desafio_id", ids)
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!desafios?.length,
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

  function jaParticipa(desafioId: string) {
    return (participacoes ?? []).some((p: any) => p.desafio_id === desafioId);
  }

  async function entrarNoDesafio(desafio: any) {
    if (jaParticipa(desafio.id)) return;
    if (desafio.status !== "ativo") return toast.error("Este desafio não está mais aberto para entradas.");
    setEntrando(desafio.id);
    try {
      const entrada = Number(desafio.valor_entrada ?? 0);

      // 1. Verifica e trava saldo se houver valor de entrada
      if (entrada > 0) {
        const { data: wallet } = await (supabase as any)
          .from("wallets").select("balance, locked_balance").eq("user_id", user.id).maybeSingle();
        const saldo = Number(wallet?.balance ?? 0);
        if (saldo < entrada) {
          toast.error(`Saldo insuficiente. Você tem ${fmtMoeda(saldo)} e a entrada é ${fmtMoeda(entrada)}.`);
          setEntrando(null);
          return;
        }
        const { error: lockErr } = await (supabase as any).from("wallets").update({
          balance: saldo - entrada,
          locked_balance: Number(wallet?.locked_balance ?? 0) + entrada,
        }).eq("user_id", user.id);
        if (lockErr) throw new Error(lockErr.message);
      }

      // 2. Insere participação
      const { error: insErr } = await (supabase as any).from("desafio_equipe_participantes").insert({
        desafio_id: desafio.id,
        user_id: user.id,
        status: "em_andamento",
        progresso: 0,
      });
      if (insErr) {
        // Desfaz o lock se insert falhou
        if (entrada > 0) {
          const { data: wallet } = await (supabase as any)
            .from("wallets").select("balance, locked_balance").eq("user_id", user.id).maybeSingle();
          await (supabase as any).from("wallets").update({
            balance: Number(wallet?.balance ?? 0) + entrada,
            locked_balance: Math.max(0, Number(wallet?.locked_balance ?? 0) - entrada),
          }).eq("user_id", user.id);
        }
        throw new Error(insErr.message);
      }

      toast.success("Você entrou no desafio! Valor em custódia: " + (entrada > 0 ? fmtMoeda(entrada) : "sem valor"));
      qc.invalidateQueries({ queryKey: ["equipe-desafios-participacoes", id, user.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao entrar no desafio");
    } finally {
      setEntrando(null);
    }
  }

  async function convidar() {
    const link = `${window.location.origin}/equipes/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de convite copiado!");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  const souCriador = equipe.criador_id === user.id;
  const souMembro = (membros ?? []).some((m: any) => m.user_id === user.id);

  async function salvarEdicao(patch: { nome?: string; descricao?: string; avatar_url?: string; categoria?: string }) {
    setBusy(true);
    const { error } = await (supabase as any).from("equipes").update(patch).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Equipe atualizada");
    setShowEdit(false);
    qc.invalidateQueries({ queryKey: ["equipe", id] });
  }

  async function excluirEquipe() {
    setBusy(true);
    const { error } = await (supabase as any).from("equipes").delete().eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Equipe excluída");
    navigate({ to: "/equipes" });
  }

  async function sairDaEquipe() {
    setBusy(true);
    const { error } = await (supabase as any).from("equipe_membros").delete().eq("user_id", user.id).eq("equipe_id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Você saiu da equipe");
    navigate({ to: "/equipes" });
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2 relative">
        <button onClick={() => navigate({ to: "/equipes" })} className="flex h-9 w-9 items-center justify-center rounded-full text-primary-light">
          <ArrowLeft size={20} />
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary-light"><MoreHorizontal size={16} /></button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-40 w-52 rounded-2xl border border-border bg-card p-1 shadow-glow">
                {souCriador ? (
                  <>
                    <button onClick={() => { setMenuOpen(false); setShowEdit(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"><Pencil size={14} /> Editar equipe</button>
                    <button onClick={() => { setMenuOpen(false); setShowDelete(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-400 hover:bg-secondary"><Trash2 size={14} /> Excluir equipe</button>
                  </>
                ) : souMembro ? (
                  <button onClick={() => { setMenuOpen(false); setShowLeave(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-400 hover:bg-secondary"><LogOut size={14} /> Sair da equipe</button>
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma ação disponível</div>
                )}
              </div>
            </>
          )}
        </div>
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
                    <div key={d.id} className="rounded-2xl border border-border bg-card p-3 space-y-2">
                      <div className="flex items-center gap-3">
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
                          <div className={`inline-flex items-center gap-1 text-[10px] font-semibold capitalize ${ok ? "text-accent" : "text-primary-light"}`}>{d.status}</div>
                        </div>
                        {souAdmin && (
                          <button onClick={() => setDesafioEditando(d)} className="rounded-full p-1.5 text-muted-foreground hover:text-primary-light hover:bg-secondary shrink-0">
                            <Pencil size={15} />
                          </button>
                        )}
                      </div>
                      {/* QR Code para admin quando tipo_validacao === qrcode */}
                      {souAdmin && d.tipo_validacao === "qrcode" && d.local_id && (
                        <DesafioQrCode localId={d.local_id} />
                      )}
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
              (desafios ?? []).map((d: any) => {
                const participa = jaParticipa(d.id);
                const carregando = entrando === d.id;
                return (
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
                  {d.status === "ativo" && (
                    <div className="mt-3">
                      {participa ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                            <CheckCircle2 size={14} /> Participando
                          </div>
                          <button
                            onClick={() => setDesafioCheckin(d)}
                            className="flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-glow"
                          >
                            <Camera size={13} /> Check-in
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => entrarNoDesafio(d)}
                          disabled={carregando}
                          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow disabled:opacity-60"
                        >
                          {carregando ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
                          {carregando ? "Entrando…" : `Entrar — ${fmtMoeda(Number(d.valor_entrada ?? 0))}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                );
              })
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

      {showEdit && (
        <EditEquipeModal equipe={equipe} busy={busy} onClose={() => setShowEdit(false)} onSave={salvarEdicao} />
      )}
      {showDelete && (
        <ConfirmModal
          title="Excluir equipe"
          message="Esta ação não pode ser desfeita. Todos os membros serão removidos."
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onClose={() => setShowDelete(false)}
          onConfirm={excluirEquipe}
        />
      )}
      {showLeave && (
        <ConfirmModal
          title="Sair da equipe"
          message="Tem certeza que quer sair desta equipe? Você perderá acesso aos desafios internos."
          confirmLabel="Sair"
          destructive
          busy={busy}
          onClose={() => setShowLeave(false)}
          onConfirm={sairDaEquipe}
        />
      )}

      {desafioCheckin && (
        <CheckinDesafioModal
          desafio={desafioCheckin}
          userId={user.id}
          onClose={() => setDesafioCheckin(null)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["equipe-desafios", id] });
            setDesafioCheckin(null);
          }}
        />
      )}

      {desafioEditando && (
        <EditDesafioSheet
          desafio={desafioEditando}
          onClose={() => setDesafioEditando(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["equipe-desafios", id] });
            setDesafioEditando(null);
          }}
        />
      )}

      <BottomNav />
    </main>
  );
}

function EditEquipeModal({ equipe, busy, onClose, onSave }: { equipe: any; busy: boolean; onClose: () => void; onSave: (p: any) => void }) {
  const [nome, setNome] = useState(equipe.nome ?? "");
  const [descricao, setDescricao] = useState(equipe.descricao ?? "");
  const [avatarUrl, setAvatarUrl] = useState(equipe.avatar_url ?? "");
  const [categoria, setCategoria] = useState(equipe.categoria ?? "");
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Editar equipe</h3>
          <button onClick={onClose} className="text-muted-foreground"><X size={18} /></button>
        </div>
        <label className="block text-xs">
          <span className="text-muted-foreground">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Descrição</span>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">URL do avatar</span>
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Categoria</span>
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold">Cancelar</button>
          <button
            onClick={() => onSave({ nome: nome.trim(), descricao: descricao.trim() || null, avatar_url: avatarUrl.trim() || null, categoria: categoria.trim() || null })}
            disabled={busy || !nome.trim()}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, destructive, busy, onClose, onConfirm }: { title: string; message: string; confirmLabel: string; destructive?: boolean; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold">Cancelar</button>
          <button onClick={onConfirm} disabled={busy} className={`flex-1 rounded-xl py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60 ${destructive ? "bg-rose-500 text-white" : "bg-primary text-primary-foreground"}`}>
            {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
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

// ─── Edit Desafio Sheet ──────────────────────────────────────────────────────

const CATEGORIAS_DESAFIO = [
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "saude", label: "Saúde", icon: Heart },
  { id: "estudos", label: "Estudos", icon: BookOpen },
  { id: "financas", label: "Finanças", icon: DollarSign },
  { id: "habitos", label: "Hábitos", icon: Calendar },
  { id: "outro", label: "Outro", icon: Sparkles },
];

function EditDesafioSheet({ desafio, onClose, onSaved }: { desafio: any; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(desafio.titulo ?? "");
  const [descricao, setDescricao] = useState(desafio.descricao ?? "");
  const [categoria, setCategoria] = useState(desafio.categoria ?? "");
  const [valorEntrada, setValorEntrada] = useState(desafio.valor_entrada ? String(desafio.valor_entrada).replace(".", ",") : "");
  const [duracaoDias, setDuracaoDias] = useState(String(desafio.duracao_dias ?? ""));
  const [premiacao, setPremiacao] = useState(desafio.premiacao ?? "");
  const [tipoValidacao, setTipoValidacao] = useState<TipoValidacao>(desafio.tipo_validacao ?? "foto_arbitro");
  const [localId, setLocalId] = useState<string | null>(desafio.local_id ?? null);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim()) return toast.error("Preencha o título");
    setSaving(true);
    const valor = parseFloat(valorEntrada.replace(",", ".")) || 0;
    const { error } = await (supabase as any).from("desafios_equipe").update({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      categoria,
      valor_entrada: valor,
      duracao_dias: parseInt(duracaoDias) || desafio.duracao_dias,
      premiacao: premiacao.trim() || null,
      tipo_validacao: tipoValidacao,
      local_id: tipoValidacao === "foto_arbitro" ? null : localId,
    }).eq("id", desafio.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Desafio atualizado!");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-border bg-card animate-in slide-in-from-bottom overflow-y-auto" style={{ maxHeight: "92dvh" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-base font-bold">Editar desafio</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18} /></button>
        </div>
        <div className="space-y-5 px-5 py-5 pb-8">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Título</span>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</span>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
          </label>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Categoria</span>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS_DESAFIO.map(({ id, label, icon: Icon }) => (
                <button type="button" key={id} onClick={() => setCategoria(id)} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${categoria === id ? "border-primary bg-primary/10 text-primary-light" : "border-border bg-background text-muted-foreground"}`}>
                  <Icon size={20} /><span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Duração (dias)</span>
              <input type="number" value={duracaoDias} onChange={(e) => setDuracaoDias(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Valor de entrada</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary-light">R$</span>
                <input type="text" inputMode="decimal" value={valorEntrada} onChange={(e) => setValorEntrada(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00" className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-3.5 text-sm font-bold outline-none focus:border-primary" />
              </div>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Premiação (opcional)</span>
            <input type="text" value={premiacao} onChange={(e) => setPremiacao(e.target.value)} placeholder="Ex: Top 3 dividem o fundo" className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-primary" />
          </label>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Método de validação</span>
            <ValidacaoStep tipoValidacao={tipoValidacao} onChangeTipo={setTipoValidacao} localId={localId} onChangeLocalId={setLocalId} userId={desafio.criador_id} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-3xl border border-border bg-background py-3.5 text-sm font-semibold text-muted-foreground">Cancelar</button>
            <button type="button" onClick={salvar} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QR Code inline para desafio ─────────────────────────────────────────────

function DesafioQrCode({ localId }: { localId: string }) {
  const { data: local } = useQuery({
    queryKey: ["desafio-local", localId],
    queryFn: async () => {
      const { data } = await supabase.from("locais_validacao").select("id, nome, qrcode_token").eq("id", localId).maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!local?.qrcode_token) return null;

  return (
    <div className="pt-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-light mb-2">
        <QrCode size={13} /> QR Code de check-in
      </div>
      <QrCodeExportCard nome={local.nome} token={local.qrcode_token} />
    </div>
  );
}

// ─── Checkin Desafio Modal ────────────────────────────────────────────────────

function CheckinDesafioModal({ desafio, userId, onClose, onCreated }: {
  desafio: any; userId: string; onClose: () => void; onCreated: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!msg.trim() && !file) return toast.error("Adicione uma mensagem ou foto");
    setLoading(true);
    try {
      let foto_url: string | null = null;
      if (file) {
        const path = `${userId}/${desafio.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("checkins").upload(path, file);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("checkins").getPublicUrl(path);
        foto_url = data.publicUrl;
      }
      // Insert checkin_desafio record
      const { error } = await (supabase as any).from("checkins_desafio_equipe").insert({
        desafio_id: desafio.id,
        user_id: userId,
        mensagem: msg.trim() || null,
        foto_url,
      });
      // Fallback: se a tabela for checkins genérica com campo desafio_id
      if (error) {
        const { error: err2 } = await (supabase as any).from("checkins").insert({
          meta_id: null,
          desafio_id: desafio.id,
          user_id: userId,
          mensagem: msg.trim() || null,
          foto_url,
        });
        if (err2) throw err2;
      }
      // Atualizar progresso do participante
      await (supabase as any).from("desafio_equipe_participantes")
        .update({ ultimo_checkin: new Date().toISOString() } as any)
        .eq("desafio_id", desafio.id)
        .eq("user_id", userId);
      toast.success("Check-in registrado!");
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar check-in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 space-y-3 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Check-in — {desafio.titulo}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18} /></button>
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={4}
          placeholder="O que você fez hoje? Conte sua evolução…"
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        {preview && (
          <div className="relative">
            <img src={preview} alt="" className="w-full h-48 rounded-xl object-cover" />
            <button onClick={() => pickFile(null)} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"><X size={14} /></button>
          </div>
        )}
        <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-primary-light cursor-pointer">
          <Camera size={16} /> {file ? "Trocar foto" : "Adicionar foto"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        </label>
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 size={14} className="animate-spin" />} Publicar check-in
        </button>
      </div>
    </div>
  );
}
