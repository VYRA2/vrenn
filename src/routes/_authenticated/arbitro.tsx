import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Shield, CheckCircle2, XCircle, Clock,
  Image as ImageIcon, ChevronRight, Swords, Target,
  AlertTriangle, Loader2, MessageSquare
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/arbitro")({
  component: ArbitroCentral,
});

export default function ArbitroCentral() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pendentes" | "historico">("pendentes");

  // Buscar todas as metas onde sou árbitro aceito
  const { data: metasArbitro, isLoading: loadingMetas } = useQuery({
    queryKey: ["arbitro-metas", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("arbitros")
        .select("meta_id, status, metas:meta_id(id, titulo, categoria, status, user_id, profiles:user_id(nome, username, avatar_url))")
        .eq("arbitro_id", user.id)
        .eq("status", "aceito");
      return data ?? [];
    },
  });

  // Buscar duelos onde sou árbitro aceito
  const { data: duelosArbitro, isLoading: loadingDuelos } = useQuery({
    queryKey: ["arbitro-duelos", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("duelos")
        .select("id, status, valor_custodia, prazo, progresso_challenger, progresso_opponent, challenger_id, opponent_id, challenger:challenger_id(nome, username, avatar_url), opponent:opponent_id(nome, username, avatar_url)")
        .eq("arbitro_id", user.id)
        .eq("arbitro_status", "aceito")
        .neq("status", "concluido");
      return data ?? [];
    },
  });

  const metaIds = (metasArbitro ?? [])
    .filter((a: any) => a.metas?.status === "em_andamento")
    .map((a: any) => a.meta_id);

  // Buscar todos os checkins pendentes de validação
  const { data: checkinsPendentes, isLoading: loadingCheckins } = useQuery({
    queryKey: ["arbitro-checkins-pendentes", user.id, metaIds],
    queryFn: async () => {
      if (!metaIds.length) return [];

      // Buscar checkins não validados das metas onde sou árbitro
      const { data: checkins } = await supabase
        .from("checkins")
        .select("id, meta_id, user_id, foto_url, mensagem, created_at, validado, metas:meta_id(titulo, categoria, profiles:user_id(nome, username, avatar_url))")
        .in("meta_id", metaIds)
        .eq("validado", false)
        .order("created_at", { ascending: false });

      if (!checkins?.length) return [];

      // Filtrar os que eu ainda não validei
      const checkinIds = checkins.map((c: any) => c.id);
      const { data: minhasValidacoes } = await supabase
        .from("checkin_validacoes")
        .select("checkin_id")
        .in("checkin_id", checkinIds)
        .eq("arbitro_id", user.id);

      const jaValidados = new Set((minhasValidacoes ?? []).map((v: any) => v.checkin_id));
      return checkins.filter((c: any) => !jaValidados.has(c.id));
    },
    enabled: metaIds.length > 0,
  });

  // Histórico — últimas validações feitas
  const { data: historico, isLoading: loadingHistorico } = useQuery({
    queryKey: ["arbitro-historico", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkin_validacoes")
        .select("id, checkin_id, status, comentario, created_at, checkins:checkin_id(meta_id, foto_url, metas:meta_id(titulo, profiles:user_id(nome, username, avatar_url)))")
        .eq("arbitro_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: tab === "historico",
  });

  const loading = loadingMetas || loadingDuelos || loadingCheckins;
  const totalPendentes = (checkinsPendentes?.length ?? 0) + (duelosArbitro?.length ?? 0);

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/feed" className="rounded-full p-2 hover:bg-card">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold">Painel do Árbitro</h1>
            <p className="text-[11px] text-muted-foreground">Suas responsabilidades de validação</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary-light">
            <Shield size={16} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pendentes", val: totalPendentes, color: totalPendentes > 0 ? "text-amber-400" : "text-muted-foreground", bg: totalPendentes > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-card border-border" },
            { label: "Metas ativas", val: metaIds.length, color: "text-primary-light", bg: "bg-card border-border" },
            { label: "Duelos ativos", val: duelosArbitro?.length ?? 0, color: "text-primary-light", bg: "bg-card border-border" },
          ].map(({ label, val, color, bg }) => (
            <div key={label} className={`rounded-2xl border ${bg} p-3 text-center`}>
              <div className={`text-2xl font-bold ${color}`}>{val}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl border border-border bg-card p-1">
          {(["pendentes", "historico"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {t === "pendentes" ? `Pendentes${totalPendentes > 0 ? ` (${totalPendentes})` : ""}` : "Histórico"}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary-light" />
          </div>
        )}

        {/* Tab Pendentes */}
        {tab === "pendentes" && !loading && (
          <div className="space-y-4">

            {/* Duelos aguardando declaração */}
            {(duelosArbitro ?? []).length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary-light flex items-center gap-1.5">
                  <Swords size={12} /> Duelos — aguardando resultado
                </h2>
                {duelosArbitro!.map((duelo: any) => (
                  <ArbitroDueloCard key={duelo.id} duelo={duelo} userId={user.id}
                    onDone={() => qc.invalidateQueries({ queryKey: ["arbitro-duelos", user.id] })} />
                ))}
              </div>
            )}

            {/* Check-ins pendentes de validação */}
            {(checkinsPendentes ?? []).length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary-light flex items-center gap-1.5">
                  <Target size={12} /> Check-ins — aguardando validação
                </h2>
                {checkinsPendentes!.map((checkin: any) => (
                  <ArbitroCheckinCard key={checkin.id} checkin={checkin} userId={user.id}
                    onDone={() => {
                      qc.invalidateQueries({ queryKey: ["arbitro-checkins-pendentes", user.id, metaIds] });
                      qc.invalidateQueries({ queryKey: ["arbitro-historico", user.id] });
                    }} />
                ))}
              </div>
            )}

            {totalPendentes === 0 && !loading && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-green-400" />
                <div className="text-sm font-bold">Tudo em dia!</div>
                <div className="text-xs text-muted-foreground">Nenhuma validação pendente no momento.</div>
              </div>
            )}

            {/* Metas como árbitro */}
            {(metasArbitro ?? []).length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield size={12} /> Metas que acompanho
                </h2>
                {metasArbitro!.map((a: any) => (
                  <Link key={a.meta_id} to="/meta/$id" params={{ id: a.meta_id }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-light text-lg">
                      🎯
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{a.metas?.titulo ?? "Meta"}</div>
                      <div className="text-xs text-muted-foreground">
                        de @{a.metas?.profiles?.username ?? "—"} · {a.metas?.status === "em_andamento" ? "Em andamento" : a.metas?.status}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            )}

            {(metasArbitro ?? []).length === 0 && (duelosArbitro ?? []).length === 0 && !loading && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
                <Shield size={32} className="mx-auto text-muted-foreground" />
                <div className="text-sm font-bold">Nenhuma responsabilidade ativa</div>
                <div className="text-xs text-muted-foreground">Você será notificado quando alguém te convidar como árbitro.</div>
              </div>
            )}
          </div>
        )}

        {/* Tab Histórico */}
        {tab === "historico" && (
          <div className="space-y-2">
            {loadingHistorico && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-primary-light" />
              </div>
            )}
            {(historico ?? []).length === 0 && !loadingHistorico && (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <div className="text-sm text-muted-foreground">Nenhuma validação feita ainda.</div>
              </div>
            )}
            {(historico ?? []).map((v: any) => (
              <div key={v.id} className="rounded-2xl border border-border bg-card p-3 flex items-start gap-3">
                {v.status === "validado"
                  ? <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
                  : <XCircle size={18} className="text-destructive shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {v.checkins?.metas?.titulo ?? "Meta"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    de @{v.checkins?.metas?.profiles?.username ?? "—"}
                  </div>
                  {v.comentario && (
                    <div className="mt-1 text-xs text-muted-foreground italic">"{v.comentario}"</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(v.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.status === "validado" ? "bg-green-500/15 text-green-400" : "bg-destructive/15 text-destructive"}`}>
                  {v.status === "validado" ? "Aprovado" : "Questionado"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Card de check-in para o árbitro validar ──────────────────────
function ArbitroCheckinCard({ checkin, userId, onDone }: any) {
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const [showComentario, setShowComentario] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function validar(status: "validado" | "questionado") {
    if (status === "questionado" && !comentario.trim()) {
      return toast.error("Adicione um comentário explicando o motivo");
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("checkin_validacoes").upsert({
        checkin_id: checkin.id,
        arbitro_id: userId,
        status,
        comentario: comentario || null,
      }, { onConflict: "checkin_id,arbitro_id" });
      if (error) throw error;

      if (status === "validado") {
        await supabase.from("checkins").update({ validado: true }).eq("id", checkin.id);
      }

      await supabase.rpc("notify", {
        _user_id: checkin.user_id,
        _tipo: status === "validado" ? "checkin_validado" : "checkin_questionado",
        _mensagem: status === "validado"
          ? "Seu check-in foi aprovado pelo árbitro ✓"
          : `Seu check-in foi questionado pelo árbitro: ${comentario}`,
        _link_id: checkin.meta_id,
      });

      toast.success(status === "validado" ? "Check-in aprovado!" : "Check-in questionado");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao validar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header do card */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-3 text-left">
        {checkin.foto_url ? (
          <img src={checkin.foto_url} className="h-14 w-14 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
            <ImageIcon size={20} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-primary-light truncate">{checkin.metas?.titulo ?? "Meta"}</div>
          <div className="text-xs text-muted-foreground">de @{checkin.metas?.profiles?.username ?? "—"}</div>
          {checkin.mensagem && (
            <div className="text-xs text-muted-foreground italic truncate mt-0.5">"{checkin.mensagem}"</div>
          )}
          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            {new Date(checkin.created_at).toLocaleString("pt-BR")}
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
          <AlertTriangle size={10} /> Pendente
        </span>
      </button>

      {/* Foto expandida */}
      {expanded && checkin.foto_url && (
        <img src={checkin.foto_url} className="w-full max-h-64 object-contain bg-black/20" />
      )}

      {/* Ações */}
      <div className="border-t border-border p-3 space-y-2">
        {showComentario && (
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Explique o motivo do questionamento..."
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary resize-none"
          />
        )}
        <div className="flex gap-2">
          <button onClick={() => { setShowComentario(false); validar("validado"); }}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-500/15 border border-green-500/30 py-2.5 text-xs font-bold text-green-400 disabled:opacity-50">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Aprovar
          </button>
          <button onClick={() => showComentario ? validar("questionado") : setShowComentario(true)}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive/10 border border-destructive/30 py-2.5 text-xs font-bold text-destructive disabled:opacity-50">
            {showComentario ? <><Loader2 size={13} className={loading ? "animate-spin" : "hidden"} /><XCircle size={13} /> Confirmar</> : <><MessageSquare size={13} /> Questionar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de duelo para árbitro declarar resultado ────────────────
function ArbitroDueloCard({ duelo, userId, onDone }: any) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const v = duelo.valor_custodia ?? 0;

  function calcPreview() {
    if (!resultado) return null;
    if (resultado === "challenger") return { challenger: v + v*0.88, opponent: 0, vrenn: v*0.06, fundo: v*0.06 };
    if (resultado === "opponent")   return { challenger: 0, opponent: v + v*0.88, vrenn: v*0.06, fundo: v*0.06 };
    if (resultado === "empate_sucesso") return { challenger: v, opponent: v, vrenn: 0, fundo: 0 };
    return { challenger: 0, opponent: 0, vrenn: v*0.25*2, fundo: v*0.75*2 };
  }

  async function confirmar() {
    if (!resultado) return toast.error("Selecione o resultado");
    setLoading(true);
    try {
      const { error } = await supabase.rpc("arbitro_declarar_resultado_duelo", {
        _duelo_id:  duelo.id,
        _winner_id: resultado === "challenger" ? duelo.challenger_id
                  : resultado === "opponent"   ? duelo.opponent_id
                  : null,
        _empate:   resultado.startsWith("empate"),
        _sucesso:  resultado === "empate_sucesso",
      });
      if (error) throw error;
      toast.success("Resultado declarado! Custódias liberadas.");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao declarar resultado");
    } finally {
      setLoading(false);
    }
  }

  const preview = calcPreview();
  const OPCOES = [
    { id: "challenger", label: `${duelo.challenger?.nome ?? "Challenger"} venceu`, emoji: "🏆" },
    { id: "opponent",   label: `${duelo.opponent?.nome ?? "Opponent"} venceu`,     emoji: "🏆" },
    { id: "empate_sucesso",     label: "Empate — ambos completaram", emoji: "✨" },
    { id: "empate_sem_sucesso", label: "Empate — nenhum completou",  emoji: "😓" },
  ];

  return (
    <div className="rounded-2xl border border-primary/40 bg-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-2xl">⚔️</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate">
            {duelo.challenger?.nome ?? "?"} vs {duelo.opponent?.nome ?? "?"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            R$ {v} cada · Prazo: {duelo.prazo ? new Date(duelo.prazo).toLocaleDateString("pt-BR") : "—"}
          </div>
          <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
            <span>{duelo.challenger?.nome}: {duelo.progresso_challenger ?? 0}%</span>
            <span>{duelo.opponent?.nome}: {duelo.progresso_opponent ?? 0}%</span>
          </div>
        </div>
        <span className="text-[10px] font-bold text-primary-light bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full shrink-0">
          Declarar
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: duelo.challenger?.nome ?? "Challenger", prog: duelo.progresso_challenger ?? 0 },
              { label: duelo.opponent?.nome ?? "Opponent",     prog: duelo.progresso_opponent ?? 0 },
            ].map(({ label, prog }) => (
              <div key={label} className="rounded-xl border border-border bg-background p-2">
                <div className="text-[10px] text-muted-foreground truncate">{label}</div>
                <div className="text-base font-bold">{prog}%</div>
                <div className="h-1 rounded-full bg-secondary mt-1 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${prog}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            {OPCOES.map((o) => (
              <button key={o.id} onClick={() => setResultado(o.id)}
                className={`w-full rounded-xl border p-2.5 text-left flex items-center gap-2 text-xs transition-colors ${resultado === o.id ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
                <span>{o.emoji}</span>
                <span className="flex-1 font-bold">{o.label}</span>
                <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${resultado === o.id ? "border-primary bg-primary" : "border-border"}`} />
              </button>
            ))}
          </div>

          {preview && resultado && (
            <div className="rounded-xl border border-border bg-background p-2.5 space-y-1 text-[11px]">
              <div className="font-bold text-primary-light mb-1">Distribuição</div>
              <div className="flex justify-between"><span className="text-muted-foreground">{duelo.challenger?.nome}</span><span className="font-bold text-green-400">R$ {preview.challenger.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{duelo.opponent?.nome}</span><span className="font-bold text-green-400">R$ {preview.opponent.toFixed(2)}</span></div>
              {preview.vrenn > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa VRENN</span><span className="font-bold">R$ {preview.vrenn.toFixed(2)}</span></div>}
              {preview.fundo > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Fundo temporada</span><span className="font-bold">R$ {preview.fundo.toFixed(2)}</span></div>}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setExpanded(false)} className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground">Cancelar</button>
            <button onClick={confirmar} disabled={loading || !resultado}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50">
              {loading && <Loader2 size={13} className="animate-spin" />} Confirmar resultado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
