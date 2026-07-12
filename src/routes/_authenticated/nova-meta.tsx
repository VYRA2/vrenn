import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Dumbbell, Heart, BookOpen, DollarSign, Calendar, Sparkles, Loader2, Lock } from "lucide-react";
import { ValidacaoStep, type TipoValidacao } from "@/components/ValidacaoStep";

export const Route = createFileRoute("/_authenticated/nova-meta")({
  component: NovaMeta,
});

const CATEGORIAS = [
  { id: "fitness", label: "Fitness", icon: Dumbbell },
  { id: "saude", label: "Saúde", icon: Heart },
  { id: "estudos", label: "Estudos", icon: BookOpen },
  { id: "financas", label: "Finanças", icon: DollarSign },
  { id: "habitos", label: "Hábitos", icon: Calendar },
  { id: "outro", label: "Outro", icon: Sparkles },
];


function NovaMeta() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [motivacao, setMotivacao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [valorCustodia, setValorCustodia] = useState("");

  const [tipoValidacao, setTipoValidacao] = useState<TipoValidacao>("qrcode");
  const [localId, setLocalId] = useState<string | null>(null);

  function proximoStep() {
    if (step === 3 && tipoValidacao !== "foto_arbitro" && !localId) {
      return toast.error("Selecione ou cadastre um local");
    }
    setStep(step + 1);
  }


  async function salvar() {
    if (!titulo || !categoria) return toast.error("Preencha título e categoria");
    setLoading(true);
    const valor = parseFloat(valorCustodia.replace(",", ".")) || 0;
    const { data, error } = await supabase.from("metas").insert({
      user_id: user.id,
      titulo,
      categoria,
      descricao,
      motivacao,
      prazo: prazo ? new Date(prazo).toISOString() : null,
      valor_custodia: valor,
      tipo_validacao: tipoValidacao,
      local_id: tipoValidacao === "foto_arbitro" ? null : localId,
    } as any).select().single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Meta criada! Boa sorte.");
    navigate({ to: "/meta/$id", params: { id: data.id } });
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-12">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/feed" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="text-base font-bold">Nova meta</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-4">
        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-4 mt-4">
            <Field label="Título da meta" value={titulo} onChange={setTitulo} placeholder="Ex: Correr 5km em 30 dias" />
            <div>
              <span className="mb-2 block text-xs font-medium text-muted-foreground">Categoria</span>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIAS.map(({ id, label, icon: Icon }) => {
                  const active = categoria === id;
                  return (
                    <button type="button" key={id} onClick={() => setCategoria(id)} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${active ? "border-primary bg-primary/10 text-primary-light" : "border-border bg-card text-muted-foreground"}`}>
                      <Icon size={20} />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <Textarea label="Descrição" value={descricao} onChange={setDescricao} placeholder="O que você vai fazer?" />
            <Textarea label="O que está em jogo? (privado, só você vê)" value={motivacao} onChange={setMotivacao} placeholder="Ex: Perco R$200, faço 100 flexões em público, raspo o cabelo…" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 mt-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold inline-flex items-center gap-2"><Lock size={14} className="text-primary-light"/> Em jogo (custódia)</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Esse valor fica guardado enquanto você cumpre. Se concluir, recebe de volta.
                Se abandonar, você decide o destino. Valor simbólico por ora.
              </p>
              <div className="mt-3 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary-light">R$</span>
                <input
                  type="text" inputMode="decimal" value={valorCustodia}
                  onChange={(e) => setValorCustodia(e.target.value.replace(/[^0-9.,]/g, ""))}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3.5 text-base font-bold outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4">
            <ValidacaoStep
              tipoValidacao={tipoValidacao}
              onChangeTipo={setTipoValidacao}
              localId={localId}
              onChangeLocalId={setLocalId}
              userId={user.id}
            />
          </div>
        )}


        {step === 4 && (
          <div className="space-y-4 mt-4">
            <Field label="Prazo final" type="date" value={prazo} onChange={setPrazo} />
            <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
              Você poderá fazer check-ins diários a partir da data de início.
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3 mt-4">
            <h3 className="text-sm font-bold">Revisar</h3>
            <ReviewRow label="Título" value={titulo || "—"} />
            <ReviewRow label="Categoria" value={CATEGORIAS.find(c => c.id === categoria)?.label ?? "—"} />
            <ReviewRow label="Descrição" value={descricao || "—"} />
            <ReviewRow label="Em jogo" value={valorCustodia ? `R$ ${valorCustodia}` : "—"} />
            <ReviewRow label="Validação" value={tipoValidacao === "qrcode" ? `QR Code · ${localNome || "—"}` : tipoValidacao === "geolocalizacao" ? `Geolocalização · ${localNome || "—"}` : "CT VRENN"} />
            <ReviewRow label="Prazo" value={prazo || "Sem prazo"} />
          </div>
        )}

        {!(step === 3 && valStep !== "metodo") && (
          <div className="mt-8 flex gap-3">
            {step > 1 && <button onClick={() => setStep(step - 1)} className="flex-1 rounded-3xl border border-border bg-card py-3.5 text-sm font-semibold">Voltar</button>}
            {step < 5 ? (
              <button onClick={proximoStep} className="flex-1 rounded-3xl bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow">Continuar</button>
            ) : (
              <button onClick={salvar} disabled={loading} className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
                {loading && <Loader2 size={16} className="animate-spin" />}
                Publicar meta
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function MetodoCard({ active, disabled, onClick, icon, title, desc }: { active: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`w-full flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border bg-card"} ${disabled ? "opacity-60" : ""}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <div className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${active ? "border-primary bg-primary" : "border-border"}`} />
    </button>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Básicos", "Regras", "Validação", "Cronograma", "Resumo"];
  return (
    <div className="flex items-center justify-between gap-1">
      {labels.map((l, i) => {
        const idx = i + 1;
        const active = idx <= step;
        return (
          <div key={l} className="flex flex-1 flex-col items-center gap-1">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-gradient-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}>{idx}</div>
            <span className={`text-[10px] ${active ? "text-foreground" : "text-muted-foreground"}`}>{l}</span>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm outline-none focus:border-primary" />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
