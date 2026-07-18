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
  DollarSign, Sparkles, Swords,
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

      {showEdit && (
        <EditDueloSheet
          duelo={duelo}
          onClose={() => setShowEdit(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["duelo", id] }); qc.invalidateQueries({ queryKey: ["duelos"] }); setShowEdit(false); }}
        />
      )}
      {showDelete && (
        <DeleteDueloModal dueloId={id} onClose={() => setShowDelete(false)} onDeleted={() => navigate({ to: "/duelos" })} />
      )}

      <BottomNav />
    </main>
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
