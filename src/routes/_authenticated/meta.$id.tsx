import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { findUserForInvite } from "@/lib/arbitros.functions";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Calendar,
  Target,
  UserPlus,
  Loader2,
  Camera,
  Shield,
  X,
  Trash2,
  QrCode,
  MapPin,
  ScanLine,
  Crosshair,
  Pencil,
  Dumbbell,
  Heart,
  BookOpen,
  DollarSign,
  Sparkles,
  Lock,
} from "lucide-react";
import { ValidacaoStep, type TipoValidacao } from "@/components/ValidacaoStep";
import { QrCodeExportCard } from "@/components/QrCodeExportCard";

export const Route = createFileRoute("/_authenticated/meta/$id")({
  component: MetaDetail,
});

const CATEGORIAS = [
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "saude", label: "Saúde", icon: Heart },
  { id: "estudos", label: "Estudos", icon: BookOpen },
  { id: "financas", label: "Finanças", icon: DollarSign },
  { id: "habitos", label: "Hábitos", icon: Calendar },
  { id: "outro", label: "Outro", icon: Sparkles },
];

function MetaDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showConcluirModal, setShowConcluirModal] = useState(false);
  const [showJustificarModal, setShowJustificarModal] = useState(false);

  const { data: meta, isLoading } = useQuery({
    queryKey: ["meta", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select(
          "id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, tipo_validacao, local_id, valor_custodia, motivacao, frequencia_tipo, frequencia_quantidade, profiles:user_id (nome, username, avatar_url)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: local } = useQuery({
    queryKey: ["meta-local", meta?.local_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("locais_validacao")
        .select("id, nome, latitude, longitude, raio_geofence_metros, qrcode_token")
        .eq("id", meta!.local_id!)
        .maybeSingle();
      return data;
    },
    enabled: !!meta?.local_id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: valorCustodia } = useQuery({
    queryKey: ["meta-valor-custodia", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_meta_valor_custodia", { _meta_id: id });
      return Number(data ?? 0);
    },
  });

  const { data: checkins } = useQuery({
    queryKey: ["checkins", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("*")
        .eq("meta_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Check-in de hoje nesta meta
  const hoje = new Date().toISOString().split("T")[0];
  const checkinHoje = (checkins ?? []).some(
    (c: any) => c.created_at?.slice(0, 10) === hoje
  );

  // Justificativa já enviada hoje
  const { data: justificativaHoje, refetch: refetchJustificativa } = useQuery({
    queryKey: ["meta-justificativa-hoje", id, user.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("justificativas_falta")
        .select("id, status, motivo")
        .eq("meta_id", id)
        .eq("user_id", user.id)
        .eq("data_referencia", hoje)
        .maybeSingle();
      return data;
    },
    enabled: isLoading === false,
  });

  const { data: arbitros } = useQuery({
    queryKey: ["arbitros", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("arbitros")
        .select("*, profiles:arbitro_id (nome, username, avatar_url)")
        .eq("meta_id", id);
      return data ?? [];
    },
  });

  const { data: validacoes } = useQuery({
    queryKey: ["validacoes", id],
    queryFn: async () => {
      if (!checkins?.length) return [];
      const { data } = await supabase
        .from("checkin_validacoes")
        .select("*")
        .in(
          "checkin_id",
          checkins.map((c) => c.id),
        );
      return data ?? [];
    },
    enabled: !!checkins,
  });

  if (isLoading) return <div className="min-h-screen bg-background p-8 text-muted-foreground">Carregando…</div>;
  if (!meta) return <div className="min-h-screen bg-background p-8 text-muted-foreground">Meta não encontrada.</div>;

  const isOwner = meta.user_id === user.id;
  const myArbitro = arbitros?.find((a) => a.arbitro_id === user.id && a.status === "aceito");
  const acceptedArbitros = arbitros?.filter((a) => a.status === "aceito") ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/feed" className="rounded-full p-2 hover:bg-card">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="flex-1 text-base font-bold truncate text-center">Minha Meta</h1>
          <div className="flex items-center gap-1">
            {isOwner && (
              <button
                onClick={() => setShowEditSheet(true)}
                className="rounded-full p-2 text-muted-foreground hover:text-primary-light hover:bg-card"
                aria-label="Editar meta"
              >
                <Pencil size={18} />
              </button>
            )}
            {isOwner && meta.status === "em_andamento" ? (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="rounded-full p-2 text-muted-foreground hover:text-destructive hover:bg-card"
                aria-label="Excluir meta"
              >
                <Trash2 size={18} />
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-light">
            {meta.status === "em_andamento" ? "Em andamento" : meta.status}
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <h2 className="mt-2 text-3xl font-bold">{meta.titulo}</h2>
          {meta.descricao && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{meta.descricao}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <InfoBox
            icon={Calendar}
            label="Prazo"
            value={meta.prazo ? new Date(meta.prazo).toLocaleDateString("pt-BR") : "Aberto"}
          />
          <InfoBox icon={Target} label="Categoria" value={meta.categoria} />
          <InfoBox icon={CheckCircle2} label="Check-ins" value={String(checkins?.length ?? 0)} />
        </div>

        {isOwner && Number(valorCustodia ?? 0) > 0 && (
          <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary-light">
              🔒
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Em custódia</div>
              <div className="text-lg font-bold text-primary-light">
                R$ {Number(valorCustodia).toLocaleString("pt-BR")}
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary-light/80">Em jogo</span>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Progresso atual</div>
              <div className="mt-1 text-4xl font-bold text-primary-light leading-none">{meta.progresso}%</div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {meta.prazo && (
                <div className="font-semibold text-foreground/80">
                  {Math.max(0, Math.ceil((new Date(meta.prazo).getTime() - Date.now()) / 86400000))} dias restantes
                </div>
              )}
            </div>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${meta.progresso}%` }} />
          </div>
        </section>

        {isOwner && <EmJogoPrivado metaId={id} />}

        {/* QR Code permanente — visível apenas para o dono quando a meta usa QR Code */}
        {isOwner && meta.tipo_validacao === "qrcode" && meta.local_id && (
          <section className="space-y-2">
            <h3 className="text-sm font-bold inline-flex items-center gap-2">
              <QrCode size={16} className="text-primary-light" /> Seu QR Code de check-in
            </h3>
            <p className="text-xs text-muted-foreground">Imprima e fixe no local. Se perder, baixe aqui novamente.</p>
            {local?.qrcode_token ? (
              <QrCodeExportCard nome={local.nome} token={local.qrcode_token} />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
                Carregando QR Code…
              </div>
            )}
          </section>
        )}

        <ArbitrosSection
          metaId={id}
          isOwner={isOwner}
          arbitros={arbitros ?? []}
          onChange={() => qc.invalidateQueries({ queryKey: ["arbitros", id] })}
          ownerId={meta.user_id}
        />

        <section>
          <h3 className="mb-3 text-sm font-bold">Últimas publicações</h3>
          <div className="space-y-3">
            {(checkins ?? []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Sem check-ins ainda.
              </div>
            )}
            {checkins?.map((c) => (
              <CheckinItem
                key={c.id}
                checkin={c}
                validacoes={(validacoes ?? []).filter((v) => v.checkin_id === c.id)}
                canValidate={!!myArbitro}
                userId={user.id}
                ownerId={meta.user_id}
                onChange={() => qc.invalidateQueries({ queryKey: ["validacoes", id] })}
              />
            ))}
          </div>
        </section>

        {isOwner && meta.status === "em_andamento" && (
          <div className="fixed bottom-24 left-0 right-0 z-30 mx-auto flex max-w-md gap-2 px-4 flex-wrap">
            <button
              onClick={() => setShowCheckinModal(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow"
            >
              <Camera size={16} /> Check-in
            </button>
            <button
              onClick={() => setShowConcluirModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-accent/60 bg-accent/10 px-4 py-3.5 text-sm font-bold text-accent"
            >
              <CheckCircle2 size={16} /> Concluir
            </button>
            {/* Justificar falta — aparece só quando frequência diária e não fez check-in hoje */}
            {(meta as any).frequencia_tipo === "diario" && !checkinHoje && (
              justificativaHoje ? (
                <div className={`w-full rounded-2xl border px-4 py-3 text-xs font-semibold text-center ${
                  justificativaHoje.status === "aprovado" ? "border-accent/40 bg-accent/10 text-accent" :
                  justificativaHoje.status === "recusado" ? "border-destructive/40 bg-destructive/10 text-destructive" :
                  "border-yellow-500/40 bg-yellow-500/10 text-yellow-500"
                }`}>
                  {justificativaHoje.status === "aprovado" ? "✅ Justificativa aprovada — falta não conta" :
                   justificativaHoje.status === "recusado" ? "❌ Justificativa recusada" :
                   "⏳ Justificativa enviada — aguardando análise"}
                </div>
              ) : (
                <button
                  onClick={() => setShowJustificarModal(true)}
                  className="w-full rounded-2xl border border-yellow-500/40 bg-yellow-500/10 py-3 text-xs font-semibold text-yellow-500"
                >
                  ⚠️ Justificar falta de hoje
                </button>
              )
            )}
            <button
              onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copiado!"); }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-3.5 text-sm font-bold"
            >
              <UserPlus size={16} />
            </button>
          </div>
        )}
      </div>

      {showCheckinModal && (
        <CheckinModal
          metaId={id}
          userId={user.id}
          acceptedArbitros={acceptedArbitros}
          tipoValidacao={meta.tipo_validacao}
          local={local}
          onClose={() => setShowCheckinModal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["checkins", id] });
            qc.invalidateQueries({ queryKey: ["feed-metas"] });
            setShowCheckinModal(false);
          }}
        />
      )}

      {showDeleteModal && (
        <DeleteMetaModal
          metaId={id}
          createdAt={meta.created_at}
          valorCustodia={Number(valorCustodia ?? 0)}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            qc.invalidateQueries({ queryKey: ["my-metas-list"] });
            qc.invalidateQueries({ queryKey: ["my-metas"] });
            qc.invalidateQueries({ queryKey: ["wallet"] });
            navigate({ to: "/metas" });
          }}
        />
      )}

      {showEditSheet && (
        <EditMetaSheet
          meta={meta}
          onClose={() => setShowEditSheet(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["meta", id] });
            setShowEditSheet(false);
          }}
        />
      )}

      {showConcluirModal && (
        <ConcluirMetaModal
          metaId={id}
          titulo={meta.titulo}
          valorCustodia={Number(valorCustodia ?? 0)}
          onClose={() => setShowConcluirModal(false)}
          onConcluida={() => {
            qc.invalidateQueries({ queryKey: ["meta", id] });
            qc.invalidateQueries({ queryKey: ["my-metas-list"] });
            qc.invalidateQueries({ queryKey: ["wallet"] });
            setShowConcluirModal(false);
          }}
        />
      )}

      {showJustificarModal && (
        <JustificarFaltaMetaModal
          metaId={id}
          userId={user.id}
          onClose={() => setShowJustificarModal(false)}
          onDone={() => {
            refetchJustificativa();
            setShowJustificarModal(false);
          }}
        />
      )}
    </main>
  );
}

// ─── Edit Sheet ────────────────────────────────────────────────────────────────

function EditMetaSheet({ meta, onClose, onSaved }: { meta: any; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(meta.titulo ?? "");
  const [categoria, setCategoria] = useState(meta.categoria ?? "");
  const [descricao, setDescricao] = useState(meta.descricao ?? "");
  const [motivacao, setMotivacao] = useState(meta.motivacao ?? "");
  const [prazo, setPrazo] = useState(meta.prazo ? meta.prazo.slice(0, 10) : "");
  const [valorCustodia, setValorCustodia] = useState(
    meta.valor_custodia ? String(meta.valor_custodia).replace(".", ",") : "",
  );
  const [tipoValidacao, setTipoValidacao] = useState<TipoValidacao>(meta.tipo_validacao ?? "foto_arbitro");
  const [localId, setLocalId] = useState<string | null>(meta.local_id ?? null);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim() || !categoria) return toast.error("Preencha título e categoria");
    setSaving(true);
    const valor = parseFloat(valorCustodia.replace(",", ".")) || 0;
    const { error } = await supabase
      .from("metas")
      .update({
        titulo: titulo.trim(),
        categoria,
        descricao: descricao.trim(),
        motivacao: motivacao.trim(),
        prazo: prazo ? new Date(prazo).toISOString() : null,
        valor_custodia: valor,
        tipo_validacao: tipoValidacao,
        local_id: tipoValidacao === "foto_arbitro" ? null : localId,
      } as any)
      .eq("id", meta.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Meta atualizada!");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-border bg-card animate-in slide-in-from-bottom overflow-y-auto"
        style={{ maxHeight: "92dvh" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-base font-bold">Editar meta</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 pb-8">
          {/* Título */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Título da meta</span>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Correr 5km em 30 dias"
              className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-primary"
            />
          </label>

          {/* Categoria */}
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Categoria</span>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIAS.map(({ id, label, icon: Icon }) => {
                const active = categoria === id;
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setCategoria(id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${active ? "border-primary bg-primary/10 text-primary-light" : "border-border bg-background text-muted-foreground"}`}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que você vai fazer?"
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </label>

          {/* Motivação */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              O que está em jogo? (privado, só você vê)
            </span>
            <textarea
              value={motivacao}
              onChange={(e) => setMotivacao(e.target.value)}
              placeholder="Ex: Perco R$200, faço 100 flexões em público, raspo o cabelo…"
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </label>

          {/* Valor em custódia */}
          <div className="rounded-2xl border border-border bg-background p-4">
            <h3 className="text-sm font-bold inline-flex items-center gap-2">
              <Lock size={14} className="text-primary-light" /> Em jogo (custódia)
            </h3>
            <div className="mt-3 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary-light">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={valorCustodia}
                onChange={(e) => setValorCustodia(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0,00"
                className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-3.5 text-base font-bold outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Validação */}
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Método de validação</span>
            <ValidacaoStep
              tipoValidacao={tipoValidacao}
              onChangeTipo={setTipoValidacao}
              localId={localId}
              onChangeLocalId={setLocalId}
              userId={meta.user_id}
            />
          </div>

          {/* Prazo */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Prazo final</span>
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm outline-none focus:border-primary"
            />
          </label>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-3xl border border-border bg-background py-3.5 text-sm font-semibold text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ───────────────────────────────────────────────────────────────

function DeleteMetaModal({
  metaId,
  createdAt,
  valorCustodia,
  onClose,
  onDeleted,
}: {
  metaId: string;
  createdAt: string;
  valorCustodia: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const dias = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const dentroPrazo = dias <= 7;
  const temCustodia = valorCustodia > 0;

  const mensagem = !temCustodia
    ? "Tem certeza que deseja excluir esta meta? Essa ação não pode ser desfeita."
    : dentroPrazo
      ? "Você ainda está dentro do prazo de arrependimento (7 dias). O valor em custódia será devolvido integralmente à sua carteira."
      : `Atenção: já se passaram mais de 7 dias. Se excluir agora, você perderá o valor em custódia (${valorCustodia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}), que será redistribuído. Essa ação não pode ser desfeita.`;

  const critico = temCustodia && !dentroPrazo;

  async function confirmar() {
    setLoading(true);
    try {
      const { error } = await supabase.from("metas").delete().eq("id", metaId);
      if (error) throw error;
      toast.success("Meta excluída");
      onDeleted();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir meta");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${critico ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary-light"}`}
          >
            {critico ? <AlertCircle size={20} /> : <Trash2 size={18} />}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold">Excluir meta</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{mensagem}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={loading}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60 ${critico ? "bg-destructive" : "bg-gradient-primary"}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />} Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function InfoBox({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <Icon size={18} className="mx-auto text-primary-light" />
      <div className="mt-1 text-xs font-bold truncate">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ArbitrosSection({ metaId, isOwner, arbitros, onChange, ownerId }: any) {
  const [open, setOpen] = useState(false);
  const [ident, setIdent] = useState("");
  const [loading, setLoading] = useState(false);
  const findUser = useServerFn(findUserForInvite);

  async function invite() {
    if (!ident.trim()) return;
    setLoading(true);
    try {
      const target: any = await findUser({ data: { identifier: ident } });
      if (target.id === ownerId) throw new Error("Você não pode ser árbitro da própria meta");
      const { data: arb, error } = await supabase
        .from("arbitros")
        .insert({
          meta_id: metaId,
          arbitro_id: target.id,
          convidado_por: ownerId,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.rpc("notify", {
        _user_id: target.id,
        _tipo: "convite_arbitro",
        _mensagem: "Você foi convidado para ser árbitro de uma meta.",
        _link_id: metaId,
      });
      toast.success(`Convite enviado para ${target.nome || target.username}`);
      setIdent("");
      setOpen(false);
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold inline-flex items-center gap-2">
          <Shield size={16} className="text-primary-light" /> Árbitros
        </h3>
        {isOwner && (
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary-light"
          >
            <UserPlus size={14} /> Convidar
          </button>
        )}
      </div>

      {open && (
        <div className="mb-3 space-y-2">
          <input
            value={ident}
            onChange={(e) => setIdent(e.target.value)}
            placeholder="@username ou email"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={invite}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 size={14} className="animate-spin" />} Enviar convite
          </button>
        </div>
      )}

      {arbitros.length === 0 && <p className="text-xs text-muted-foreground">Nenhum árbitro ainda.</p>}
      <div className="space-y-2">
        {arbitros.map((a: any) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-xl border border-border bg-background p-2.5"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                {(a.profiles?.nome || "?")[0].toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-semibold">{a.profiles?.nome || "Usuário"}</div>
                <div className="text-[10px] text-muted-foreground">@{a.profiles?.username}</div>
              </div>
            </div>
            <StatusPill status={a.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    pendente: { c: "bg-yellow-500/15 text-yellow-300", l: "Pendente" },
    aceito: { c: "bg-accent/15 text-accent", l: "Aceito" },
    recusado: { c: "bg-destructive/15 text-destructive", l: "Recusado" },
  };
  const m = map[status] ?? map.pendente;
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${m.c}`}>{m.l}</span>;
}

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function registrarCheckinAutomatico(metaId: string, userId: string, mensagem: string) {
  const { error } = await supabase.from("checkins").insert({
    meta_id: metaId,
    user_id: userId,
    mensagem,
    foto_url: null,
    validado: true,
  } as any);
  if (error) throw error;
}

function CheckinModal({ metaId, userId, acceptedArbitros, tipoValidacao, local, onClose, onCreated }: any) {
  if (tipoValidacao === "qrcode") {
    return <CheckinQrCode metaId={metaId} userId={userId} local={local} onClose={onClose} onCreated={onCreated} />;
  }
  if (tipoValidacao === "geolocalizacao") {
    return (
      <CheckinGeolocalizacao metaId={metaId} userId={userId} local={local} onClose={onClose} onCreated={onCreated} />
    );
  }
  return (
    <CheckinFotoArbitro
      metaId={metaId}
      userId={userId}
      acceptedArbitros={acceptedArbitros}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 space-y-3 animate-in slide-in-from-bottom"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CheckinFotoArbitro({ metaId, userId, acceptedArbitros, onClose, onCreated }: any) {
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
        const ok = ["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(file.type);
        if (!ok) throw new Error("Formato inválido. Use JPG, PNG, WebP ou MP4.");
        if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo maior que 50MB.");
        const path = `${userId}/${metaId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("checkins").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("checkins").getPublicUrl(path);
        foto_url = data.publicUrl;
      }
      const { error } = await supabase.from("checkins").insert({
        meta_id: metaId,
        user_id: userId,
        mensagem: msg,
        foto_url,
      });
      if (error) throw error;
      for (const c of (
        await supabase
          .from("checkins")
          .select("id")
          .eq("meta_id", metaId)
          .order("created_at", { ascending: false })
          .limit(1)
      ).data ?? []) {
        for (const a of acceptedArbitros) {
          await supabase.rpc("notify", {
            _user_id: a.arbitro_id,
            _tipo: "checkin_para_validar",
            _mensagem: "Novo check-in aguardando sua validação.",
            _link_id: c.id,
          });
        }
      }
      toast.success("Check-in publicado!");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Publicar atualização" onClose={onClose}>
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
          <button
            onClick={() => pickFile(null)}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-primary-light cursor-pointer">
          <Camera size={16} /> {file ? "Trocar foto" : "Adicionar foto"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading && <Loader2 size={14} className="animate-spin" />} Publicar check-in
      </button>
    </ModalShell>
  );
}

function CheckinQrCode({ metaId, userId, local, onClose, onCreated }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const suportado = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!scanning || !suportado) return;
    let stream: MediaStream | null = null;
    let raf: number;
    let ativo = true;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const loop = async () => {
          if (!ativo || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              await onCodigoLido(codes[0].rawValue);
              return;
            }
          } catch {
            /* frame inválido */
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e: any) {
        setErro("Não foi possível acessar a câmera. Verifique as permissões.");
        setScanning(false);
      }
    }
    start();
    return () => {
      ativo = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  async function onCodigoLido(valor: string) {
    if (!local?.qrcode_token) return;
    if (valor !== local.qrcode_token) {
      setErro("Esse QR Code não corresponde ao local desta meta.");
      return;
    }
    setScanning(false);
    setLoading(true);
    try {
      await registrarCheckinAutomatico(metaId, userId, `Check-in validado por QR Code em ${local.nome}.`);
      toast.success("Check-in validado por QR Code!");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Check-in por QR Code" onClose={onClose}>
      {!local ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nenhum local vinculado a esta meta.
        </div>
      ) : !suportado ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Seu navegador não suporta leitura de QR Code pela câmera. Tente pelo Chrome no Android.
        </div>
      ) : scanning ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-black aspect-square">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-primary" />
          </div>
          {erro && <p className="text-xs text-destructive text-center">{erro}</p>}
          <button
            onClick={() => setScanning(false)}
            className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <QrCode size={28} className="text-primary-light" />
          </div>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code fixado em <span className="font-semibold text-foreground">{local.nome}</span> para
            registrar seu check-in de hoje.
          </p>
          <button
            onClick={() => {
              setErro(null);
              setScanning(true);
            }}
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={16} />} Abrir câmera e escanear
          </button>
        </div>
      )}
    </ModalShell>
  );
}

function CheckinGeolocalizacao({ metaId, userId, local, onClose, onCreated }: any) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function confirmar() {
    if (!local) return;
    if (!navigator.geolocation) return setErro("Geolocalização não suportada neste navegador.");
    setLoading(true);
    setErro(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = distanciaMetros(pos.coords.latitude, pos.coords.longitude, local.latitude, local.longitude);
        if (dist > local.raio_geofence_metros) {
          setLoading(false);
          setErro(
            `Você está a ${Math.round(dist)}m de ${local.nome} — fora do raio de ${local.raio_geofence_metros}m permitido.`,
          );
          return;
        }
        try {
          await registrarCheckinAutomatico(metaId, userId, `Check-in validado por geolocalização em ${local.nome}.`);
          toast.success("Check-in validado!");
          onCreated();
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setErro("Não foi possível obter sua localização.");
      },
    );
  }

  return (
    <ModalShell title="Check-in por localização" onClose={onClose}>
      {!local ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nenhum local vinculado a esta meta.
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <MapPin size={28} className="text-emerald-400" />
          </div>
          <p className="text-sm text-muted-foreground">
            Confirme que você está em <span className="font-semibold text-foreground">{local.nome}</span> (raio de{" "}
            {local.raio_geofence_metros}m) para registrar seu check-in de hoje.
          </p>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <button
            onClick={confirmar}
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={16} />} Confirmar minha
            localização
          </button>
        </div>
      )}
    </ModalShell>
  );
}

function CheckinItem({ checkin, validacoes, canValidate, userId, onChange }: any) {
  const [comentario, setComentario] = useState("");
  const myValidacao = validacoes.find((v: any) => v.arbitro_id === userId);
  const validados = validacoes.filter((v: any) => v.status === "validado").length;
  const questionados = validacoes.filter((v: any) => v.status === "questionado").length;

  async function validar(status: "validado" | "questionado") {
    const { error } = await supabase.from("checkin_validacoes").upsert(
      {
        checkin_id: checkin.id,
        arbitro_id: userId,
        status,
        comentario: comentario || null,
      },
      { onConflict: "checkin_id,arbitro_id" },
    );
    if (error) return toast.error(error.message);
    if (status === "validado") {
      await supabase.from("checkins").update({ validado: true }).eq("id", checkin.id);
    }
    await supabase.rpc("notify", {
      _user_id: checkin.user_id,
      _tipo: status === "validado" ? "apoio" : "cobranca",
      _mensagem:
        status === "validado"
          ? "Um árbitro validou seu check-in."
          : `Um árbitro questionou: ${comentario || "sem comentário"}`,
      _link_id: checkin.meta_id,
    });
    toast.success(status === "validado" ? "Check-in validado" : "Check-in questionado");
    setComentario("");
    onChange();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        {checkin.foto_url ? (
          <img src={checkin.foto_url} alt="" className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-background text-muted-foreground">
            <ImageIcon size={20} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground">
            {new Date(checkin.created_at).toLocaleString("pt-BR")}
          </div>
          {checkin.mensagem && <p className="mt-1 text-sm">{checkin.mensagem}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {validados > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                <CheckCircle2 size={10} />
                {validados} validado(s)
              </span>
            )}
            {questionados > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                <AlertCircle size={10} />
                {questionados} questionado(s)
              </span>
            )}
          </div>
        </div>
      </div>

      {canValidate && (
        <div className="mt-3 border-t border-border pt-3 space-y-2">
          {myValidacao ? (
            <div className="text-xs text-muted-foreground">
              Você {myValidacao.status === "validado" ? "validou" : "questionou"} este check-in.
            </div>
          ) : (
            <>
              <input
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Comentário (opcional)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => validar("validado")}
                  className="rounded-xl bg-accent/20 py-2 text-xs font-bold text-accent inline-flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={14} /> Validar
                </button>
                <button
                  onClick={() => validar("questionado")}
                  className="rounded-xl bg-yellow-500/15 py-2 text-xs font-bold text-yellow-300 inline-flex items-center justify-center gap-1"
                >
                  <AlertCircle size={14} /> Questionar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConcluirMetaModal({ metaId, titulo, valorCustodia, onClose, onConcluida }: {
  metaId: string; titulo: string; valorCustodia: number; onClose: () => void; onConcluida: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function confirmar() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("metas")
        .update({ status: "concluida", progresso: 100 } as any)
        .eq("id", metaId);
      if (error) throw error;
      toast.success("🎉 Meta concluída! Parabéns!");
      onConcluida();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao concluir meta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold">Concluir meta</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Tem certeza que concluiu <span className="font-semibold text-foreground">"{titulo}"</span>?
              {valorCustodia > 0 && (
                <> O valor de <span className="font-bold text-accent">R$ {valorCustodia.toLocaleString("pt-BR")}</span> em custódia será devolvido à sua carteira.</>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={loading} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-60">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {loading && <Loader2 size={14} className="animate-spin" />} Confirmar conclusão
          </button>
        </div>
      </div>
    </div>
  );
}

function EmJogoPrivado({ metaId }: { metaId: string }) {
  const { data } = useQuery({
    queryKey: ["motivacao", metaId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_meta_motivacao", { _meta_id: metaId });
      return data as string | null;
    },
  });
  if (!data) return null;
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-primary-light">
        <Shield size={14} /> O que está em jogo (só você vê)
      </div>
      <p className="mt-2 text-sm whitespace-pre-line">{data}</p>
    </section>
  );
}

// ─── Justificar Falta na Meta Solo ───────────────────────────────────────────
function JustificarFaltaMetaModal({ metaId, userId, onClose, onDone }: {
  metaId: string; userId: string; onClose: () => void; onDone: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const hoje = new Date().toISOString().split("T")[0];

  async function enviar() {
    if (motivo.trim().length < 10) return toast.error("Descreva o motivo (mínimo 10 caracteres).");
    setLoading(true);
    try {
      const { error } = await (supabase as any).from("justificativas_falta").insert({
        user_id: userId,
        meta_id: metaId,
        data_referencia: hoje,
        motivo: motivo.trim(),
      });
      if (error) throw error;
      toast.success("Justificativa registrada! Sua meta não será marcada como falhada por hoje.");
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
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-card">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sua meta tem frequência diária obrigatória. Se não fizer check-in hoje e não registrar uma justificativa válida, ela poderá ser marcada como falhada às 00h.
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
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Registrar justificativa
        </button>
      </div>
    </div>
  );
}
