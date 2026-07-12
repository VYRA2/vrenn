import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Dumbbell, Heart, BookOpen, DollarSign, Calendar, Sparkles, Loader2, Lock, QrCode, MapPin, Shield, Search, Plus, Crosshair, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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

type TipoValidacao = "qrcode" | "geolocalizacao" | "foto_arbitro";
type ValStep = "metodo" | "buscar" | "cadastrar";

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

  // Validação
  const [tipoValidacao, setTipoValidacao] = useState<TipoValidacao>("qrcode");
  const [valStep, setValStep] = useState<ValStep>("metodo");
  const [localId, setLocalId] = useState<string | null>(null);
  const [localNome, setLocalNome] = useState<string>("");
  const [busca, setBusca] = useState("");
  // Cadastrar local
  const [novoNome, setNovoNome] = useState("");
  const [novoEndereco, setNovoEndereco] = useState("");
  const [novoLat, setNovoLat] = useState<number | null>(null);
  const [novoLng, setNovoLng] = useState<number | null>(null);
  const [novoRaio, setNovoRaio] = useState(100);
  const [savingLocal, setSavingLocal] = useState(false);

  const { data: locais } = useQuery({
    queryKey: ["locais-validacao", busca],
    queryFn: async () => {
      let q = supabase.from("locais_validacao").select("id, nome, latitude, longitude, raio_geofence_metros").limit(20);
      if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
    enabled: step === 3 && valStep === "buscar",
  });

  function usarLocalizacaoAtual() {
    if (!navigator.geolocation) return toast.error("Geolocalização não suportada");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setNovoLat(pos.coords.latitude); setNovoLng(pos.coords.longitude); toast.success("Localização capturada"); },
      () => toast.error("Não foi possível obter localização"),
    );
  }

  async function cadastrarLocal() {
    if (!novoNome.trim()) return toast.error("Informe o nome do local");
    if (novoLat == null || novoLng == null) return toast.error("Capture a localização atual");
    if (novoRaio < 20) return toast.error("Raio mínimo é 20m");
    setSavingLocal(true);
    const { data, error } = await supabase.from("locais_validacao").insert({
      nome: novoNome.trim(),
      latitude: novoLat,
      longitude: novoLng,
      raio_geofence_metros: novoRaio,
      criado_por: user.id,
    }).select("id, nome").single();
    setSavingLocal(false);
    if (error) return toast.error(error.message);
    setLocalId(data.id);
    setLocalNome(data.nome);
    toast.success("Local cadastrado");
    setValStep("metodo");
  }

  function selecionarLocal(l: { id: string; nome: string }) {
    setLocalId(l.id);
    setLocalNome(l.nome);
    setValStep("metodo");
  }

  function proximoStep() {
    if (step === 3) {
      if (tipoValidacao !== "foto_arbitro" && !localId) {
        return toast.error("Selecione ou cadastre um local");
      }
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

        {step === 3 && valStep === "metodo" && (
          <div className="space-y-4 mt-4">
            <div>
              <h2 className="text-lg font-bold text-center">Como será validado seu check-in diário?</h2>
              <p className="mt-1 text-xs text-center text-muted-foreground">Escolha o método usado para comprovar presença.</p>
            </div>
            <MetodoCard
              active={tipoValidacao === "qrcode"}
              onClick={() => { setTipoValidacao("qrcode"); setLocalId(null); setLocalNome(""); }}
              icon={<QrCode size={22} className="text-primary-light" />}
              title="QR Code"
              desc="Escaneie o mesmo QR Code todos os dias no local físico da meta."
            />
            <MetodoCard
              active={tipoValidacao === "geolocalizacao"}
              onClick={() => { setTipoValidacao("geolocalizacao"); setLocalId(null); setLocalNome(""); }}
              icon={<MapPin size={22} className="text-emerald-400" />}
              title="Geolocalização"
              desc="Check-in automático em um raio de localização definido."
            />
            <MetodoCard
              active={false}
              disabled
              onClick={() => toast.info("Em breve")}
              icon={<Shield size={22} className="text-emerald-400" />}
              title="CT VRENN"
              desc="Check-in dentro do ecossistema VRENN. (em breve)"
            />

            {tipoValidacao !== "foto_arbitro" && (
              <button onClick={() => setValStep("buscar")} className="w-full rounded-xl border border-border bg-card p-3 text-left text-sm">
                <div className="text-xs text-muted-foreground">Local selecionado</div>
                <div className="mt-1 font-semibold truncate">{localNome || "Nenhum — toque para escolher"}</div>
              </button>
            )}
          </div>
        )}

        {step === 3 && valStep === "buscar" && (
          <div className="space-y-3 mt-4">
            <h2 className="text-lg font-bold">Este local já está cadastrado?</h2>
            <p className="text-xs text-muted-foreground">Busque por um local existente para reutilizar {tipoValidacao === "qrcode" ? "o QR Code e as coordenadas" : "as coordenadas"}.</p>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar local cadastrado..." className="w-full rounded-xl border border-primary/40 bg-card pl-9 pr-3 py-3 text-sm outline-none focus:border-primary" />
            </div>
            <div className="text-xs text-muted-foreground">Locais encontrados</div>
            <div className="space-y-2">
              {(locais ?? []).map((l: any) => (
                <button key={l.id} onClick={() => selecionarLocal(l)} className="w-full rounded-xl border border-border bg-card p-3 text-left flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15"><MapPin size={18} className="text-primary-light" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{l.nome}</div>
                    <div className="text-[11px] text-emerald-400 font-semibold">
                      {tipoValidacao === "qrcode" ? "QR Code disponível" : `Raio: ${l.raio_geofence_metros}m`}
                    </div>
                  </div>
                </button>
              ))}
              {(locais ?? []).length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Nenhum local encontrado</div>
              )}
            </div>
            <button onClick={() => setValStep("cadastrar")} className="w-full rounded-xl border border-primary/60 bg-transparent p-3 text-sm font-semibold text-primary-light inline-flex items-center justify-center gap-2">
              <Plus size={16} /> Cadastrar novo local
            </button>
            <button onClick={() => setValStep("metodo")} className="w-full text-center text-xs text-muted-foreground py-2">Voltar</button>
          </div>
        )}

        {step === 3 && valStep === "cadastrar" && (
          <div className="space-y-4 mt-4">
            <h2 className="text-lg font-bold">Cadastrar novo local</h2>
            <p className="text-xs text-muted-foreground">Este local será usado para validar o check-in diário via {tipoValidacao === "qrcode" ? "QR Code" : "geolocalização"}.</p>
            <Field label="Nome do local" value={novoNome} onChange={setNovoNome} placeholder="Ex.: Academia Alpha" />
            <Field label="Endereço (opcional)" value={novoEndereco} onChange={setNovoEndereco} placeholder="Ex.: R. das Flores, 123" />
            <div>
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Localização</span>
              <button onClick={usarLocalizacaoAtual} className="w-full rounded-xl border border-primary/40 bg-card p-3 text-sm font-semibold text-primary-light inline-flex items-center justify-center gap-2">
                <Crosshair size={16} /> Usar minha localização atual
              </button>
              {novoLat != null && novoLng != null && (
                <div className="mt-2 text-[11px] text-muted-foreground">Lat: {novoLat.toFixed(5)}, Lng: {novoLng.toFixed(5)}</div>
              )}
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Raio de validação (geofence)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setNovoRaio(Math.max(20, novoRaio - 10))} className="h-11 w-11 rounded-xl bg-card border border-border inline-flex items-center justify-center text-primary-light"><Minus size={16} /></button>
                <div className="flex-1 text-center rounded-xl bg-card border border-border py-3 font-bold">{novoRaio} m</div>
                <button onClick={() => setNovoRaio(novoRaio + 10)} className="h-11 w-11 rounded-xl bg-card border border-border inline-flex items-center justify-center text-primary-light"><Plus size={16} /></button>
              </div>
            </div>
            <button onClick={cadastrarLocal} disabled={savingLocal} className="w-full rounded-3xl bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {savingLocal && <Loader2 size={16} className="animate-spin" />} Cadastrar local
            </button>
            <button onClick={() => setValStep("buscar")} className="w-full text-center text-xs text-muted-foreground py-2">Voltar</button>
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
