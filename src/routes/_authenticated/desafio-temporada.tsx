import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import {
  ArrowLeft, Trophy, Flame, Shield, ChevronDown, ChevronUp,
  Crown, Target, Calendar, Users, Loader2, X, Camera, CheckCircle2,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/desafio-temporada")({
  component: DesafioTemporada,
});

const ADMIN_ID = "52fd9ebb-5d88-4b33-acc3-97b70c62a426";

const REGULAMENTO_FIXO = `**Artigo 1 — Natureza e Propósito**
O VRENN Master Season é a competição oficial da plataforma VRENN, operada pela VRENN Tecnologia Social. Realizada em ciclos de 90 dias, cada temporada representa o mais alto nível de comprometimento disponível na plataforma — onde disciplina real encontra consequência real.

**Artigo 2 — Elegibilidade**
Qualquer usuário com conta ativa e verificada na plataforma VRENN é elegível para participar. Não há restrição de nível, reputação ou histórico de participação.

**Artigo 3 — Taxa de Participação**
Cada temporada tem uma taxa de participação definida pelos operadores do VRENN antes do início do ciclo. O valor integral da taxa é destinado à VRENN Tecnologia Social como receita operacional da plataforma e não compõe o fundo de premiação. A taxa é não-reembolsável sob qualquer circunstância após a confirmação da inscrição.

**Artigo 4 — Fundo de Premiação**
O fundo de premiação é formado pelo acumulativo de valores em custódia de participantes eliminados ou que não cumpriram os critérios da temporada, somado a aportes de outras modalidades da plataforma conforme configuração vigente. A cada temporada, os operadores do VRENN determinam se o prêmio será o fundo acumulado, um prêmio externo de valor fixo, ou uma combinação de ambos.

**Artigo 5 — Definição da Temporada**
A modalidade do desafio, a frequência mínima de check-ins, os critérios de eliminação e o formato do prêmio são definidos pelos operadores do VRENN antes de cada temporada. Essas condições são imutáveis após o início do ciclo e se aplicam igualmente a todos os participantes.

**Artigo 6 — Eliminação**
Os critérios de eliminação são específicos de cada temporada e divulgados antes do início do ciclo. Uma vez eliminado, o participante perde o direito ao prêmio mas pode continuar fazendo check-ins para fins de reputação e conquistas. Valores em custódia de participantes eliminados são transferidos automaticamente para o fundo de premiação da temporada.

**Artigo 7 — Resultado**
O resultado é determinado automaticamente pelo sistema às 00h do último dia de cada temporada, com base nos registros de check-in verificados. O resultado é definitivo e não sujeito a contestação manual.

**Artigo 8 — Modificações**
Os operadores do VRENN reservam-se o direito de encerrar antecipadamente uma temporada em casos de falha técnica grave, fraude comprovada ou força maior. Nestes casos, os valores em custódia serão integralmente devolvidos aos participantes.`;

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasRestantes(dataFim: string) {
  return Math.max(0, Math.ceil((new Date(dataFim).getTime() - Date.now()) / 86400000));
}

function DesafioTemporada() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = user.id === ADMIN_ID;

  const [showRegulamento, setShowRegulamento] = useState(false);
  const [showTermo, setShowTermo] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [entrando, setEntrando] = useState(false);

  // Temporada ativa
  const { data: temporada, isLoading } = useQuery({
    queryKey: ["temporada-ativa"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("temporadas")
        .select("*")
        .in("status", ["inscricoes_abertas", "ativa"])
        .order("data_inicio", { ascending: false })
        .maybeSingle();
      return data;
    },
  });

  // Minha participação
  const { data: minha, refetch: refetchMinha } = useQuery({
    queryKey: ["temporada-minha", temporada?.id, user.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("temporada_participantes")
        .select("*")
        .eq("temporada_id", temporada!.id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!temporada?.id,
  });

  // Total de participantes
  const { data: totalParticipantes } = useQuery({
    queryKey: ["temporada-participantes-count", temporada?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("temporada_participantes")
        .select("*", { count: "exact", head: true })
        .eq("temporada_id", temporada!.id);
      return count ?? 0;
    },
    enabled: !!temporada?.id,
  });

  // Check-in de hoje
  const hoje = new Date().toISOString().split("T")[0];
  const { data: checkinHoje, refetch: refetchCheckin } = useQuery({
    queryKey: ["temporada-checkin-hoje", temporada?.id, user.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("temporada_checkins")
        .select("id")
        .eq("temporada_id", temporada!.id)
        .eq("user_id", user.id)
        .gte("created_at", `${hoje}T00:00:00`)
        .maybeSingle();
      return data;
    },
    enabled: !!temporada?.id && !!minha,
  });

  async function entrar() {
    if (!temporada) return;
    setEntrando(true);
    try {
      const { error } = await (supabase as any).from("temporada_participantes").insert({
        temporada_id: temporada.id,
        user_id: user.id,
        taxa_paga: temporada.taxa_entrada,
        valor_custodia: 0,
        termo_aceito_em: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Bem-vindo ao VRENN Master Season!");
      refetchMinha();
      qc.invalidateQueries({ queryKey: ["temporada-participantes-count", temporada.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao entrar na temporada");
    } finally {
      setEntrando(false);
      setShowTermo(false);
    }
  }

  const freqLabel = temporada
    ? temporada.frequencia_tipo === "diario"
      ? `${temporada.frequencia_quantidade}x por dia`
      : temporada.frequencia_tipo === "semanal"
      ? `${temporada.frequencia_quantidade}x por semana`
      : `${temporada.frequencia_quantidade} check-ins no total`
    : "";

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary-light" />
      </main>
    );
  }

  if (!temporada) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-24">
        <header className="relative mx-auto flex max-w-md items-center justify-center px-5 pt-5 pb-4">
          <button onClick={() => navigate({ to: "/feed" })} className="absolute left-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold">Master Season</h1>
        </header>
        <div className="mx-auto max-w-md px-5 mt-16 text-center space-y-4">
          <Crown size={48} className="mx-auto text-primary-light/30" />
          <h2 className="text-xl font-bold">Nenhuma temporada ativa</h2>
          <p className="text-sm text-muted-foreground">A próxima temporada será anunciada em breve. Fique atento às notificações.</p>
          {isAdmin && (
            <button onClick={() => setShowAdmin(true)} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow">
              <Crown size={14} /> Criar temporada
            </button>
          )}
        </div>
        {isAdmin && showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} userId={user.id} onCreated={() => { qc.invalidateQueries({ queryKey: ["temporada-ativa"] }); setShowAdmin(false); }} />}
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="relative mx-auto flex max-w-md items-center justify-center px-5 pt-5 pb-4">
        <button onClick={() => navigate({ to: "/feed" })} className="absolute left-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-bold">Master Season</h1>
        {isAdmin && (
          <button onClick={() => setShowAdmin(true)} className="absolute right-5 flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary-light">
            <Crown size={16} />
          </button>
        )}
      </header>

      <div className="mx-auto max-w-md px-4 space-y-4">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/5 to-background p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary-light/70">
              Season {temporada.numero} · {temporada.status === "inscricoes_abertas" ? "Inscrições abertas" : "Em andamento"}
            </div>
            <h2 className="text-xl font-bold leading-tight">{temporada.titulo}</h2>
            {temporada.descricao && (
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{temporada.descricao}</p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <InfoChip icon={<Calendar size={12} />} label="Encerra em" value={`${diasRestantes(temporada.data_fim)} dias`} />
              <InfoChip icon={<Users size={12} />} label="Participantes" value={String(totalParticipantes ?? 0)} />
              <InfoChip icon={<Flame size={12} />} label="Frequência" value={freqLabel} />
            </div>
          </div>
        </div>

        {/* Fundo acumulado */}
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Fundo acumulado</div>
            <div className="text-2xl font-bold text-accent">{formatBRL(temporada.fundo_acumulado ?? 0)}</div>
          </div>
          <Trophy size={32} className="text-accent/40" />
        </div>

        {/* Prêmio */}
        {temporada.descricao_premio && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Crown size={14} className="text-yellow-400" />
              <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Prêmio da temporada</span>
            </div>
            <p className="text-sm font-semibold">{temporada.descricao_premio}</p>
            {temporada.valor_premio_externo > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">+ {formatBRL(temporada.valor_premio_externo)} em prêmio externo</p>
            )}
          </div>
        )}

        {/* Status do participante */}
        {minha && (
          <div className={`rounded-2xl border p-4 space-y-3 ${minha.eliminado ? "border-destructive/40 bg-destructive/5" : "border-accent/40 bg-accent/5"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {minha.eliminado
                  ? <span className="text-sm font-bold text-destructive">⚠️ Eliminado</span>
                  : <span className="text-sm font-bold text-accent flex items-center gap-1.5"><CheckCircle2 size={14} /> Participando</span>
                }
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">Seus check-ins</div>
                <div className="text-sm font-bold">{minha.total_checkins}</div>
              </div>
            </div>
            {!minha.eliminado && (
              <button
                onClick={() => setShowCheckin(true)}
                disabled={!!checkinHoje}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
              >
                <Camera size={14} />
                {checkinHoje ? "Check-in feito hoje ✓" : "Fazer check-in"}
              </button>
            )}
          </div>
        )}

        {/* Regras da temporada */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Shield size={16} className="text-primary-light" />
            <span className="text-sm font-bold">Regras desta temporada</span>
          </div>
          <div className="p-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Modalidade</span><span className="font-semibold text-foreground capitalize">{temporada.modalidade}</span></div>
            <div className="flex justify-between"><span>Frequência</span><span className="font-semibold text-foreground">{freqLabel}</span></div>
            <div className="flex justify-between"><span>Tolerância de faltas</span><span className="font-semibold text-foreground">{temporada.tolerancia_faltas === 0 ? "Zero — faltou uma = eliminado" : `${temporada.tolerancia_faltas} falta(s)`}</span></div>
            <div className="flex justify-between"><span>Taxa de entrada</span><span className="font-semibold text-foreground">{formatBRL(temporada.taxa_entrada)} (100% VRENN)</span></div>
            <div className="flex justify-between"><span>Tipo de prêmio</span><span className="font-semibold text-foreground capitalize">{temporada.tipo_premio === "fundo" ? "Fundo acumulado" : temporada.tipo_premio === "externo" ? "Prêmio externo" : "Fundo + prêmio externo"}</span></div>
            <div className="flex justify-between"><span>Duração</span><span className="font-semibold text-foreground">90 dias</span></div>
          </div>
          {temporada.regulamento && (
            <button onClick={() => setShowRegulamento(true)} className="w-full border-t border-border px-4 py-3 text-xs font-semibold text-primary-light flex items-center justify-center gap-1">
              Ver regulamento completo da temporada
            </button>
          )}
        </div>

        {/* Regulamento fixo */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            className="flex w-full items-center justify-between px-4 py-3"
            onClick={() => setShowRegulamento(v => !v)}
          >
            <span className="text-sm font-bold">Regulamento Oficial VRENN Master</span>
            {showRegulamento ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showRegulamento && (
            <div className="border-t border-border px-4 pb-4 pt-3 text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">
              {REGULAMENTO_FIXO}
            </div>
          )}
        </div>

        {/* CTA entrar */}
        {!minha && temporada.status === "inscricoes_abertas" && (
          <button
            onClick={() => setShowTermo(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow"
          >
            <Crown size={16} /> Entrar na temporada · {formatBRL(temporada.taxa_entrada)}
          </button>
        )}
        {!minha && temporada.status === "ativa" && (
          <div className="rounded-2xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
            As inscrições para esta temporada estão encerradas.
          </div>
        )}
      </div>

      {/* Modal termo de aceite */}
      {showTermo && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowTermo(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Termo de aceite</h3>
              <button onClick={() => setShowTermo(false)}><X size={18} /></button>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground leading-relaxed">
              Ao confirmar minha participação no VRENN Master Season, declaro ter lido, compreendido e aceito integralmente o Regulamento Oficial vigente desta temporada. Reconheço que a taxa de participação de <strong className="text-foreground">{formatBRL(temporada.taxa_entrada)}</strong> é receita operacional da VRENN Tecnologia Social e não será reembolsada. Compreendo que o não cumprimento dos critérios definidos para esta temporada resultará em minha eliminação da disputa pelo prêmio e na transferência do meu valor em custódia para o fundo da temporada. Aceito que o resultado é determinado de forma automatizada e definitiva pelo sistema VRENN.
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
              <strong className="text-primary-light">Taxa de entrada:</strong> {formatBRL(temporada.taxa_entrada)} · Não reembolsável
            </div>
            <button
              onClick={entrar}
              disabled={entrando}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {entrando && <Loader2 size={14} className="animate-spin" />}
              <Crown size={14} /> Li e aceito — Entrar na temporada
            </button>
          </div>
        </div>
      )}

      {/* Modal check-in */}
      {showCheckin && temporada && (
        <CheckinMasterModal
          temporadaId={temporada.id}
          userId={user.id}
          onClose={() => setShowCheckin(false)}
          onDone={() => { refetchCheckin(); setShowCheckin(false); }}
        />
      )}

      {/* Modal regulamento da temporada */}
      {showRegulamento && temporada?.regulamento && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setShowRegulamento(false)}>
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">Regulamento da temporada</h3>
              <button onClick={() => setShowRegulamento(false)}><X size={18} /></button>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{temporada.regulamento}</div>
          </div>
        </div>
      )}

      {/* Painel admin */}
      {isAdmin && showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          userId={user.id}
          temporadaAtiva={temporada}
          onCreated={() => { qc.invalidateQueries({ queryKey: ["temporada-ativa"] }); setShowAdmin(false); }}
        />
      )}

      <BottomNav />
    </main>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] text-white/50 mb-0.5">{icon}{label}</div>
      <div className="text-xs font-bold text-white">{value}</div>
    </div>
  );
}

// ─── Check-in do Master ───────────────────────────────────────────────────────
function CheckinMasterModal({ temporadaId, userId, onClose, onDone }: {
  temporadaId: string; userId: string; onClose: () => void; onDone: () => void;
}) {
  const [mensagem, setMensagem] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function pickFile() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*,video/*"; input.capture = "environment";
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      setFile(f); setPreview(URL.createObjectURL(f));
    };
    input.click();
  }

  async function enviar() {
    setLoading(true);
    try {
      let foto_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `master/${temporadaId}/${userId}/${Date.now()}.${ext}`;
        await supabase.storage.from("checkins").upload(path, file);
        const { data: pub } = supabase.storage.from("checkins").getPublicUrl(path);
        foto_url = pub.publicUrl;
      }
      const { error } = await (supabase as any).from("temporada_checkins").insert({
        temporada_id: temporadaId, user_id: userId, foto_url, mensagem: mensagem || null,
      });
      if (error) throw error;
      toast.success("Check-in registrado! +5 pts de reputação");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar check-in");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-background p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Check-in · Master Season</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {preview ? (
          file?.type.startsWith("video")
            ? <video src={preview} controls className="w-full max-h-48 rounded-xl object-cover" />
            : <img src={preview} className="w-full max-h-48 rounded-xl object-cover" />
        ) : (
          <button onClick={pickFile} className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-8 text-sm text-muted-foreground hover:border-primary/50">
            <Camera size={28} className="text-primary-light" />
            Foto ou vídeo como prova
          </button>
        )}
        {preview && <button onClick={pickFile} className="text-xs text-primary-light underline">Trocar arquivo</button>}
        <textarea value={mensagem} onChange={e => setMensagem(e.target.value)}
          placeholder="Descreva sua prova (opcional)..."
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary resize-none h-20" />
        <button onClick={enviar} disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Publicar check-in
        </button>
      </div>
    </div>
  );
}

// ─── Painel de Administração ──────────────────────────────────────────────────
function AdminPanel({ onClose, userId, temporadaAtiva, onCreated }: {
  onClose: () => void; userId: string; temporadaAtiva?: any; onCreated: () => void;
}) {
  const [numero, setNumero] = useState(String((temporadaAtiva?.numero ?? 0) + 1));
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [taxa, setTaxa] = useState("10");
  const [freqTipo, setFreqTipo] = useState<"diario"|"semanal"|"total">("diario");
  const [freqQtd, setFreqQtd] = useState(1);
  const [tolerancia, setTolerancia] = useState(0);
  const [tipoPremio, setTipoPremio] = useState<"fundo"|"externo"|"combinado">("fundo");
  const [descPremio, setDescPremio] = useState("");
  const [valorExterno, setValorExterno] = useState("");
  const [regulamento, setRegulamento] = useState("");
  const [status, setStatus] = useState<"rascunho"|"inscricoes_abertas">("rascunho");
  const [loading, setLoading] = useState(false);

  async function salvar() {
    if (!titulo || !modalidade || !dataInicio) return toast.error("Preencha título, modalidade e data de início");
    setLoading(true);
    try {
      const inicio = new Date(dataInicio);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 90);

      const { error } = await (supabase as any).from("temporadas").insert({
        numero: parseInt(numero),
        titulo, descricao, modalidade,
        data_inicio: dataInicio,
        data_fim: fim.toISOString().split("T")[0],
        taxa_entrada: parseFloat(taxa) || 10,
        frequencia_tipo: freqTipo,
        frequencia_quantidade: freqQtd,
        tolerancia_faltas: tolerancia,
        tipo_premio: tipoPremio,
        descricao_premio: descPremio || null,
        valor_premio_externo: parseFloat(valorExterno) || 0,
        regulamento: regulamento || null,
        status,
        criado_por: userId,
      });
      if (error) throw error;
      toast.success("Temporada criada!");
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar temporada");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={onClose}>
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2"><Crown size={16} className="text-yellow-400" /> Nova temporada</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <AField label="Número da season" value={numero} onChange={setNumero} type="number" />
        <AField label="Título" value={titulo} onChange={setTitulo} placeholder="Ex: Season 1 — 30 Dias de Movimento" />
        <AField label="Descrição pública" value={descricao} onChange={setDescricao} placeholder="Breve descrição do desafio" textarea />
        <AField label="Modalidade" value={modalidade} onChange={setModalidade} placeholder="treino, leitura, alimentação…" />
        <AField label="Data de início" value={dataInicio} onChange={setDataInicio} type="date" />
        <AField label="Taxa de entrada (R$)" value={taxa} onChange={setTaxa} type="number" />

        {/* Frequência */}
        <div>
          <span className="mb-2 block text-xs font-medium text-muted-foreground">Frequência exigida</span>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {(["diario","semanal","total"] as const).map(t => (
              <button key={t} onClick={() => setFreqTipo(t)}
                className={`rounded-xl border py-2 text-xs font-bold ${freqTipo === t ? "border-primary bg-primary/10 text-primary-light" : "border-border bg-card text-muted-foreground"}`}>
                {t === "diario" ? "Diário" : t === "semanal" ? "Semanal" : "Total"}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: 7 }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setFreqQtd(n)}
                className={`h-9 w-9 shrink-0 rounded-xl border text-sm font-bold ${freqQtd === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Tolerância */}
        <div>
          <span className="mb-2 block text-xs font-medium text-muted-foreground">Tolerância de faltas antes de eliminar</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[0,1,2,3,5,7].map(n => (
              <button key={n} onClick={() => setTolerancia(n)}
                className={`h-9 w-9 shrink-0 rounded-xl border text-sm font-bold ${tolerancia === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Prêmio */}
        <div>
          <span className="mb-2 block text-xs font-medium text-muted-foreground">Tipo de prêmio</span>
          <div className="grid grid-cols-3 gap-2">
            {([["fundo","Fundo"],["externo","Externo"],["combinado","Ambos"]] as const).map(([v,l]) => (
              <button key={v} onClick={() => setTipoPremio(v)}
                className={`rounded-xl border py-2 text-xs font-bold ${tipoPremio === v ? "border-primary bg-primary/10 text-primary-light" : "border-border bg-card text-muted-foreground"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {(tipoPremio === "externo" || tipoPremio === "combinado") && (
          <AField label="Valor do prêmio externo (R$)" value={valorExterno} onChange={setValorExterno} type="number" />
        )}
        <AField label="Descrição do prêmio" value={descPremio} onChange={setDescPremio} placeholder="Ex: Viagem para Miami + fundo acumulado" />
        <AField label="Regulamento específico desta temporada (opcional)" value={regulamento} onChange={setRegulamento} textarea placeholder="Regras adicionais específicas desta temporada…" />

        {/* Status inicial */}
        <div>
          <span className="mb-2 block text-xs font-medium text-muted-foreground">Publicar como</span>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setStatus("rascunho")}
              className={`rounded-xl border py-2 text-xs font-bold ${status === "rascunho" ? "border-primary bg-primary/10 text-primary-light" : "border-border bg-card text-muted-foreground"}`}>
              Rascunho
            </button>
            <button onClick={() => setStatus("inscricoes_abertas")}
              className={`rounded-xl border py-2 text-xs font-bold ${status === "inscricoes_abertas" ? "border-primary bg-primary/10 text-primary-light" : "border-border bg-card text-muted-foreground"}`}>
              Abrir inscrições
            </button>
          </div>
        </div>

        <button onClick={salvar} disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
          {loading && <Loader2 size={14} className="animate-spin" />}
          <Crown size={14} /> Criar Season {numero}
        </button>
      </div>
    </div>
  );
}

function AField({ label, value, onChange, type = "text", placeholder, textarea }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary resize-none h-24" />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary" />
      }
    </label>
  );
}
