import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { QrCodeExportCard } from "@/components/QrCodeExportCard";
import { ValidacaoStep, type TipoValidacao } from "@/components/ValidacaoStep";
import { toast } from "sonner";
import { useState } from "react";
import {
  ArrowLeft, Calendar, Wallet, Pencil, Trash2, X,
  Loader2, Target, QrCode, Lock, Dumbbell, Heart, BookOpen,
  DollarSign, Sparkles, Swords, Camera, AlertTriangle, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/duelo/$id")({
  component: DueloDetalhe,
});

const CATEGORIAS = [
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "saude", label: "Saúde", icon: Heart },
  { id: "estudos", label: "Estudos", icon: BookOpen },
  { id: "financas", label: "Finanças", icon: DollarSign },
  { id: "habitos", label: "Hábitos", icon: Calendar },
  { id: "outro", label: "Outro", icon: Sparkles },
];

function DueloDetalhe() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showJustificar, setShowJustificar] = useState(false);
  const [showEncerrar, setShowEncerrar] = useState(false);

  const { data: duelo, isLoading } = useQuery({
    queryKey: ["duelo", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("duelos")
        .select("*, challenger:profiles!duelos_challenger_profile_fk(nome,username,avatar_url), opponent:profiles!duelos_opponent_profile_fk(nome,username,avatar_url)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: local } = useQuery({
    queryKey: ["duelo-local", duelo?.local_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("locais_validacao")
        .select("id, nome, latitude, longitude, raio_geofence_metros, qrcode_token")
        .eq("id", duelo!.local_id)
        .maybeSingle();
      return data;
    },
    enabled: !!duelo?.local_id,
    staleTime: 5 * 60 * 1000,
  });

  // Check-in de hoje neste duelo
  const hoje = new Date().toISOString().split("T")[0];
  const { data: checkinHoje } = useQuery({
    queryKey: ["duelo-checkin-hoje", id, user.id],
    queryFn: async () => {
      const { data } = await supabase.from("checkins")
        .select("id")
        .eq("duelo_id", id)
        .eq("user_id", user.id)
        .gte("created_at", `${hoje}T00:00:00`)
        .maybeSingle();
      return data;
    },
    enabled: !!duelo && duelo.status === "ativo",
  });

  // Justificativa pendente (enviada pelo oponente esperando minha aprovação)
  const { data: justificativaPendente } = useQuery({
    queryKey: ["duelo-justificativa-pendente", id, user.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("justificativas_falta")
        .select("id, user_id, motivo, data_referencia, profiles:user_id(nome, avatar_url)")
        .eq("duelo_id", id)
        .eq("status", "pendente")
        .neq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!duelo && duelo.status === "ativo",
  });

  if (isLoading) return <main className="min-h-screen bg-background" />;
  if (!duelo) return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Duelo não encontrado.</p>
    </main>
  );

  const isChallenger = duelo.challenger_id === user.id;
  const isOwner = isChallenger;
  const me = isChallenger ? duelo.challenger : duelo.opponent;
  const rival = isChallenger ? duelo.opponent : duelo.challenger;
  const meuProgresso = isChallenger ? duelo.progresso_challenger : duelo.progresso_opponent;
  const rivalProgresso = isChallenger ? duelo.progresso_opponent : duelo.progresso_challenger;
  const dias = duelo.prazo ? Math.max(0, Math.ceil((new Date(duelo.prazo).getTime() - Date.now()) / 86400000)) : null;
  const euEliminado = isChallenger ? duelo.challenger_eliminado : duelo.opponent_eliminado;
  const rivalEliminado = isChallenger ? duelo.opponent_eliminado : duelo.challenger_eliminado;
  const frequenciaLabel = duelo.frequencia_tipo === "diario"
    ? `${duelo.frequencia_quantidade}x por dia`
    : duelo.frequencia_tipo === "semanal"
    ? `${duelo.frequencia_quantidade}x por semana`
    : `${duelo.frequencia_quantidade} check-in(s) no total`;

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/duelos" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="flex-1 text-base font-bold truncate text-center">Duelo</h1>
          <div className="flex items-center gap-1">
            {isOwner && duelo.status !== "concluido" && (
              <button onClick={() => setShowEdit(true)} className="rounded-full p-2 text-muted-foreground hover:text-primary-light hover:bg-card">
                <Pencil size={18} />
              </button>
            )}
            {isOwner && duelo.status !== "concluido" && (
              <button onClick={() => setShowDelete(true)} className="rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-card">
                <Trash2 size={18} />
              </button>
            )}
            {!(isOwner && duelo.status !== "concluido") && <div className="w-9" />}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {/* VS Card */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <AvatarBlock profile={me} label="Você" />
            <div className="flex flex-col items-center gap-1">
              <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-light">
                {duelo.status === "pendente" ? "Pendente" : duelo.status === "em_andamento" ? "Em andamento" : "Concluído"}
              </span>
              <div className="text-3xl font-extrabold text-primary">VS</div>
              {dias !== null && <div className="text-xs text-muted-foreground">{dias} dias restantes</div>}
            </div>
            <AvatarBlock profile={rival} label={rival?.nome ?? "Rival"} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-center">{duelo.titulo}</h2>
          {duelo.categoria && (
            <div className="mt-1 text-center">
              <span className="inline-block rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">{duelo.categoria}</span>
            </div>
          )}
        </section>

        {/* Progresso */}
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-bold">Progresso</h3>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-primary-light font-bold">Você — {meuProgresso ?? 0}%</span>
              <span className="font-bold">{rival?.nome ?? "Rival"} — {rivalProgresso ?? 0}%</span>
            </div>
            <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-gradient-primary transition-all" style={{ width: `${meuProgresso ?? 0}%` }} />
            </div>
          </div>
        </section>

        {/* Info boxes */}
        <div className="grid grid-cols-3 gap-2">
          <InfoBox icon={Calendar} label="Prazo" value={duelo.prazo ? new Date(duelo.prazo).toLocaleDateString("pt-BR") : "Aberto"} />
          <InfoBox icon={Target} label="Categoria" value={duelo.categoria ?? "—"} />
          <InfoBox icon={Wallet} label="Custódia" value={duelo.valor_custodia ? `R$${Number(duelo.valor_custodia).toLocaleString("pt-BR")}` : "—"} />
        </div>

        {/* Custódia highlight */}
        {isOwner && Number(duelo.valor_custodia ?? 0) > 0 && (
          <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary-light">🔒</div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Em custódia</div>
              <div className="text-lg font-bold text-primary-light">R$ {Number(duelo.valor_custodia).toLocaleString("pt-BR")}</div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary-light/80">Em jogo</span>
          </section>
        )}

        {/* Encerrar duelo — só para o challenger quando duelo está ativo */}
        {isOwner && duelo.status === "ativo" && (
          <section className="rounded-2xl border border-primary/40 bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary-light">🏆</div>
              <div className="flex-1">
                <div className="text-sm font-bold">Encerrar duelo</div>
                <div className="text-xs text-muted-foreground">Declare o vencedor e libere as custódias conforme as regras do VRENN.</div>
              </div>
            </div>
            <button
              onClick={() => setShowEncerrar(true)}
              className="w-full rounded-xl bg-primary/10 border border-primary/40 py-2.5 text-sm font-bold text-primary-light"
            >
              Declarar resultado 🏆
            </button>
          </section>
        )}

        {/* Frequência */}
        {duelo.frequencia_tipo && (
          <section className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
              <Target size={16} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Frequência exigida</div>
              <div className="text-sm font-bold">{frequenciaLabel}</div>
            </div>
          </section>
        )}

        {/* Banner eliminado */}
        {euEliminado && (
          <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-destructive shrink-0" />
            <div>
              <div className="text-sm font-bold text-destructive">Você foi eliminado</div>
              <div className="text-xs text-muted-foreground">Você não cumpriu a frequência exigida. Pode continuar fazendo check-ins, mas não concorre ao prêmio.</div>
            </div>
          </section>
        )}
        {rivalEliminado && !euEliminado && (
          <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-primary-light shrink-0" />
            <div>
              <div className="text-sm font-bold text-primary-light">Seu oponente foi eliminado!</div>
              <div className="text-xs text-muted-foreground">Continue fazendo check-ins para garantir sua vitória.</div>
            </div>
          </section>
        )}

        {/* Justificativa pendente do oponente — admin aprova */}
        {justificativaPendente && (
          <section className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-500" />
              <span className="text-sm font-bold text-yellow-500">Falta justificada pelo oponente</span>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{(justificativaPendente as any).profiles?.nome}</span> justificou a falta do dia{" "}
              {new Date(justificativaPendente.data_referencia + "T12:00:00").toLocaleDateString("pt-BR")}:
            </p>
            <p className="rounded-xl bg-card border border-border px-3 py-2 text-sm italic">"{justificativaPendente.motivo}"</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await (supabase as any).from("justificativas_falta")
                    .update({ status: "aprovado", aprovado_por: user.id, respondido_em: new Date().toISOString() })
                    .eq("id", justificativaPendente.id);
                  // Notificar o solicitante
                  await supabase.rpc("notify", {
                    _user_id: justificativaPendente.user_id,
                    _tipo: "justificativa_resultado",
                    _mensagem: `Sua justificativa de falta no duelo foi aprovada! Você não será eliminado por essa falta.`,
                    _link_id: id,
                  });
                  qc.invalidateQueries({ queryKey: ["duelo-justificativa-pendente", id, user.id] });
                  toast.success("Justificativa aprovada. O oponente não será eliminado por essa falta.");
                }}
                className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground">
                ✅ Aprovar
              </button>
              <button
                onClick={async () => {
                  await (supabase as any).from("justificativas_falta")
                    .update({ status: "recusado", aprovado_por: user.id, respondido_em: new Date().toISOString() })
                    .eq("id", justificativaPendente.id);
                  // Notificar o solicitante
                  await supabase.rpc("notify", {
                    _user_id: justificativaPendente.user_id,
                    _tipo: "justificativa_resultado",
                    _mensagem: `Sua justificativa de falta no duelo foi recusada. Fique atento para não ser eliminado.`,
                    _link_id: id,
                  });
                  qc.invalidateQueries({ queryKey: ["duelo-justificativa-pendente", id, user.id] });
                  toast("Justificativa recusada.");
                }}
                className="flex-1 rounded-xl border border-border bg-card py-2 text-xs font-bold text-destructive">
                ❌ Recusar
              </button>
            </div>
          </section>
        )}

        {/* Botões de ação — check-in e justificar falta */}
        {duelo.status === "ativo" && !euEliminado && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCheckin(true)}
              disabled={!!checkinHoje}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
              <Camera size={16} />
              {checkinHoje ? "Check-in feito hoje ✓" : "Fazer check-in"}
            </button>
            {!checkinHoje && duelo.frequencia_tipo === "diario" && (
              <button
                onClick={() => setShowJustificar(true)}
                className="rounded-2xl border border-border bg-card px-4 py-3.5 text-xs font-semibold text-muted-foreground hover:border-yellow-500/50 hover:text-yellow-500">
                Justificar falta
              </button>
            )}
          </div>
        )}

        {/* QR Code permanente */}
        {isOwner && duelo.tipo_validacao === "qrcode" && duelo.local_id && (
          <section className="space-y-2">
            <h3 className="text-sm font-bold inline-flex items-center gap-2">
              <QrCode size={16} className="text-primary-light" /> Seu QR Code de check-in
            </h3>
            <p className="text-xs text-muted-foreground">Imprima e fixe no local. Se perder, baixe aqui novamente.</p>
            {local?.qrcode_token ? (
              <QrCodeExportCard nome={local.nome} token={local.qrcode_token} />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">Carregando QR Code…</div>
            )}
          </section>
        )}
      </div>

      {/* Modal check-in do duelo */}
      {showCheckin && (
        <CheckinDueloModal
          dueloId={id}
          userId={user.id}
          onClose={() => setShowCheckin(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["duelo-checkin-hoje", id, user.id] });
            qc.invalidateQueries({ queryKey: ["duelo", id] });
            setShowCheckin(false);
          }}
        />
      )}

      {/* Modal justificar falta */}
      {showJustificar && (
        <JustificarFaltaModal
          dueloId={id}
          userId={user.id}
          rivalId={isChallenger ? duelo.opponent_id : duelo.challenger_id}
          onClose={() => setShowJustificar(false)}
          onDone={() => setShowJustificar(false)}
        />
      )}

      {showEdit && (
        <EditDueloSheet
          duelo={duelo}
          onClose={() => setShowEdit(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["duelo", id] }); qc.invalidateQueries({ queryKey: ["duelos"] }); setShowEdit(false); }}
        />
      )}
      {showEncerrar && (
        <EncerrarDueloModal
          duelo={duelo}
          userId={user.id}
          onClose={() => setShowEncerrar(false)}
          onDone={() => { setShowEncerrar(false); qc.invalidateQueries({ queryKey: ["duelo", id] }); }}
        />
      )}
      {showDelete && (
        <DeleteDueloModal dueloId={id} onClose={() => setShowDelete(false)} onDeleted={() => navigate({ to: "/duelos" })} />
      )}

      <BottomNav />
    </main>
  );
}

function EncerrarDueloModal({ duelo, userId, onClose, onDone }: {
  duelo: any; userId: string; onClose: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<"eu_venci" | "rival_venceu" | "empate_sucesso" | "empate_sem_sucesso" | null>(null);

  const isChallenger = duelo.challenger_id === userId;
  const meuProgresso = isChallenger ? duelo.progresso_challenger : duelo.progresso_opponent;
  const rivalProgresso = isChallenger ? duelo.progresso_opponent : duelo.progresso_challenger;
  const ambosCompletos = meuProgresso >= 100 && rivalProgresso >= 100;
  const nenhum = meuProgresso < 100 && rivalProgresso < 100;

  const OPCOES = [
    { id: "eu_venci",           label: "Eu venci",              sub: "Completei meu objetivo, rival não",  emoji: "🏆", show: !ambosCompletos && !nenhum || meuProgresso >= 100 },
    { id: "rival_venceu",       label: "Rival venceu",          sub: "Rival completou, eu não",           emoji: "🤝", show: !ambosCompletos && !nenhum || rivalProgresso >= 100 },
    { id: "empate_sucesso",     label: "Empate — ambos vencemos", sub: "Ambos completaram o objetivo",   emoji: "✨", show: ambosCompletos },
    { id: "empate_sem_sucesso", label: "Empate — ambos falhamos", sub: "Nenhum completou o objetivo",    emoji: "😓", show: nenhum },
  ] as const;

  // Percentuais conforme tabela VRENN:
  // Vitória: vencedor recebe 100% próprio + 88% rival; fundo 6% rival; VRENN 6% rival
  // Empate sucesso: cada um recebe 100% próprio, 0% VRENN
  // Empate sem sucesso: cada um perde tudo; 75% fundo, 25% VRENN

  function calcPreview() {
    const v = duelo.valor_custodia ?? 0;
    if (!resultado) return null;
    if (resultado === "eu_venci")     return { voce: v + v * 0.88, rival: 0,   vrenn: v * 0.06, fundo: v * 0.06 };
    if (resultado === "rival_venceu") return { voce: 0,   rival: v + v * 0.88, vrenn: v * 0.06, fundo: v * 0.06 };
    if (resultado === "empate_sucesso")     return { voce: v, rival: v, vrenn: 0,         fundo: 0 };
    if (resultado === "empate_sem_sucesso") return { voce: 0, rival: 0, vrenn: v * 0.25 * 2, fundo: v * 0.75 * 2 };
    return null;
  }

  async function confirmar() {
    if (!resultado) return toast.error("Selecione o resultado");
    setLoading(true);
    try {
      const winnerId =
        resultado === "eu_venci"           ? userId :
        resultado === "rival_venceu"       ? (isChallenger ? duelo.opponent_id : duelo.challenger_id) :
        null;

      const { error } = await supabase.rpc("resolve_duelo_custodia", {
        _duelo_id:   duelo.id,
        _winner_id:  winnerId,
        _empate:     resultado.startsWith("empate"),
        _sucesso:    resultado === "empate_sucesso",
      });

      if (error) throw error;

      // Notificar rival
      const rivalId = isChallenger ? duelo.opponent_id : duelo.challenger_id;
      const msg =
        resultado === "eu_venci"           ? "O criador do duelo declarou que venceu. Confira o resultado." :
        resultado === "rival_venceu"       ? "O criador do duelo declarou que você venceu! Parabéns 🏆" :
        resultado === "empate_sucesso"     ? "O duelo terminou em empate — ambos completaram o objetivo! ✨" :
        "O duelo terminou sem sucesso para nenhum dos dois.";

      await supabase.rpc("notify", {
        _user_id:  rivalId,
        _tipo:     "desafio_duelo",
        _mensagem: msg,
        _link_id:  duelo.id,
      });

      toast.success("Resultado declarado! Custódias liberadas.");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao encerrar duelo");
    } finally {
      setLoading(false);
    }
  }

  const preview = calcPreview();
  const v = duelo.valor_custodia ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 space-y-4 pb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-light text-lg">🏆</div>
          <div>
            <h3 className="text-base font-bold">Declarar resultado do duelo</h3>
            <p className="text-xs text-muted-foreground">As custódias serão liberadas automaticamente.</p>
          </div>
        </div>

        <div className="space-y-2">
          {OPCOES.filter(o => o.show).map((o) => (
            <button key={o.id} onClick={() => setResultado(o.id as any)}
              className={`w-full rounded-2xl border p-3.5 text-left flex items-center gap-3 transition-colors ${resultado === o.id ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
              <span className="text-xl">{o.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-bold">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.sub}</div>
              </div>
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${resultado === o.id ? "border-primary bg-primary" : "border-border"}`}>
                {resultado === o.id && <span className="h-2 w-2 rounded-full bg-white"/>}
              </div>
            </button>
          ))}
        </div>

        {preview && (
          <div className="rounded-2xl border border-border bg-background p-3 space-y-1.5 text-xs">
            <div className="font-bold text-primary-light mb-1">Prévia da distribuição (R$ {v} cada)</div>
            <div className="flex justify-between"><span className="text-muted-foreground">Você recebe</span><span className="font-bold text-green-400">R$ {preview.voce.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rival recebe</span><span className="font-bold text-green-400">R$ {preview.rival.toFixed(2)}</span></div>
            {preview.vrenn > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa VRENN</span><span className="font-bold">R$ {preview.vrenn.toFixed(2)}</span></div>}
            {preview.fundo > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Fundo temporada</span><span className="font-bold">R$ {preview.fundo.toFixed(2)}</span></div>}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={loading} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground disabled:opacity-60">Cancelar</button>
          <button onClick={confirmar} disabled={loading || !resultado} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {loading && <Loader2 size={14} className="animate-spin"/>} Confirmar resultado
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDueloSheet({ duelo, onClose, onSaved }: { duelo: any; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(duelo.titulo ?? "");
  const [categoria, setCategoria] = useState(duelo.categoria ?? "");
  const [prazo, setPrazo] = useState(duelo.prazo ? duelo.prazo.slice(0, 10) : "");
  const [valorCustodia, setValorCustodia] = useState(duelo.valor_custodia ? String(duelo.valor_custodia).replace(".", ",") : "");
  const [tipoValidacao, setTipoValidacao] = useState<TipoValidacao>(duelo.tipo_validacao ?? "foto_arbitro");
  const [localId, setLocalId] = useState<string | null>(duelo.local_id ?? null);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim()) return toast.error("Preencha o título");
    setSaving(true);
    const valor = parseFloat(valorCustodia.replace(",", ".")) || 0;
    const { error } = await (supabase as any).from("duelos").update({
      titulo: titulo.trim(),
      categoria: categoria || null,
      prazo: prazo ? new Date(prazo).toISOString() : null,
      valor_custodia: valor,
      tipo_validacao: tipoValidacao,
      local_id: tipoValidacao === "foto_arbitro" ? null : localId,
    }).eq("id", duelo.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Duelo atualizado!");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-border bg-card animate-in slide-in-from-bottom overflow-y-auto" style={{ maxHeight: "92dvh" }}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-base font-bold">Editar duelo</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18} /></button>
        </div>
        <div className="space-y-5 px-5 py-5 pb-8">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Título</span>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Perder 5kg em 30 dias" className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-primary" />
          </label>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Categoria</span>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS.map(({ id, label, icon: Icon }) => (
                <button type="button" key={id} onClick={() => setCategoria(id)} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${categoria === id ? "border-primary bg-primary/10 text-primary-light" : "border-border bg-background text-muted-foreground"}`}>
                  <Icon size={20} /><span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Prazo</span>
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-primary" />
          </label>
          <div className="rounded-2xl border border-border bg-background p-4">
            <h3 className="text-sm font-bold inline-flex items-center gap-2"><Lock size={14} className="text-primary-light" /> Em custódia</h3>
            <div className="mt-3 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary-light">R$</span>
              <input type="text" inputMode="decimal" value={valorCustodia} onChange={(e) => setValorCustodia(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00" className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-3.5 text-base font-bold outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Método de validação</span>
            <ValidacaoStep tipoValidacao={tipoValidacao} onChangeTipo={setTipoValidacao} localId={localId} onChangeLocalId={setLocalId} userId={duelo.challenger_id} />
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

function DeleteDueloModal({ dueloId, onClose, onDeleted }: { dueloId: string; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  async function confirmar() {
    setLoading(true);
    const { error } = await (supabase as any).from("duelos").delete().eq("id", dueloId);
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success("Duelo excluído");
    onDeleted();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"><Trash2 size={18} /></div>
          <div>
            <h3 className="text-base font-bold">Excluir duelo</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">Tem certeza? O valor em custódia será devolvido. Essa ação não pode ser desfeita.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={loading} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-60">Cancelar</button>
          <button onClick={confirmar} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-destructive py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {loading && <Loader2 size={14} className="animate-spin" />} Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarBlock({ profile, label }: { profile: any; label: string }) {
  const initial = (profile?.nome ?? label ?? "?")[0]?.toUpperCase();
  return (
    <div className="flex flex-col items-center gap-2">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full ring-2 ring-primary object-cover" />
        : <div className="h-16 w-16 rounded-full ring-2 ring-primary flex items-center justify-center bg-gradient-primary text-lg font-bold text-primary-foreground">{initial}</div>}
      <span className="text-xs font-semibold text-center max-w-[72px] truncate">{label}</span>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <Icon size={18} className="mx-auto text-primary-light" />
      <div className="mt-1 text-xs font-bold truncate">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ─── Check-in do Duelo ───────────────────────────────────────────────────────
function CheckinDueloModal({ dueloId, userId, onClose, onDone }: { dueloId: string; userId: string; onClose: () => void; onDone: () => void }) {
  const [mensagem, setMensagem] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = { current: null as HTMLInputElement | null };

  function pickFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      setFile(f);
      setPreview(URL.createObjectURL(f));
    };
    input.click();
  }

  async function enviar() {
    setLoading(true);
    try {
      let foto_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `duelo/${dueloId}/${userId}/${Date.now()}.${ext}`;
        await supabase.storage.from("checkins").upload(path, file);
        const { data: pub } = supabase.storage.from("checkins").getPublicUrl(path);
        foto_url = pub.publicUrl;
      }
      const { error } = await supabase.from("checkins").insert({
        duelo_id: dueloId,
        user_id: userId,
        foto_url,
        mensagem: mensagem || null,
        meta_id: null,
      } as any);
      if (error) throw error;
      toast.success("Check-in registrado!");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar check-in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Check-in do duelo</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {preview ? (
          file?.type.startsWith("video") ? (
            <video src={preview} controls className="w-full max-h-48 rounded-xl object-cover" />
          ) : (
            <img src={preview} className="w-full max-h-48 rounded-xl object-cover" />
          )
        ) : (
          <button onClick={pickFile} className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-8 text-sm text-muted-foreground hover:border-primary/50">
            <Camera size={28} className="text-primary-light" />
            Tirar foto ou gravar vídeo
          </button>
        )}
        {preview && (
          <button onClick={pickFile} className="text-xs text-primary-light underline">Trocar arquivo</button>
        )}
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Descreva sua prova (opcional)..."
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary resize-none h-20"
        />
        <button
          onClick={enviar}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Publicar check-in
        </button>
      </div>
    </div>
  );
}

// ─── Justificar Falta ────────────────────────────────────────────────────────
function JustificarFaltaModal({ dueloId, userId, rivalId, onClose, onDone }: { dueloId: string; userId: string; rivalId: string; onClose: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const hoje = new Date().toISOString().split("T")[0];

  async function enviar() {
    if (motivo.trim().length < 10) return toast.error("Descreva o motivo (mínimo 10 caracteres).");
    setLoading(true);
    try {
      const { error } = await (supabase as any).from("justificativas_falta").insert({
        user_id: userId,
        duelo_id: dueloId,
        data_referencia: hoje,
        motivo: motivo.trim(),
      });
      if (error) throw error;
      // Notificar o oponente para que ele analise a justificativa
      await supabase.rpc("notify", {
        _user_id: rivalId,
        _tipo: "justificativa_pendente",
        _mensagem: "Seu oponente justificou a falta de hoje no duelo. Aprove ou recuse antes das 23h59.",
        _link_id: dueloId,
      });
      toast.success("Justificativa enviada! Seu oponente vai analisar.");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar justificativa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-background p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Justificar falta de hoje</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          Explique o motivo de não ter feito check-in hoje. Seu oponente poderá aprovar ou recusar até as 23h59. Se aprovado, você não será eliminado por essa falta.
        </p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex: Viagem de emergência, problema de saúde, compromisso inadiável..."
          className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary resize-none h-28"
          maxLength={500}
        />
        <p className="text-right text-[10px] text-muted-foreground">{motivo.length}/500</p>
        <button
          onClick={enviar}
          disabled={loading || motivo.trim().length < 10}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Enviar justificativa
        </button>
      </div>
    </div>
  );
}



