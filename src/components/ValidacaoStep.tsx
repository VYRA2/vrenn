import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, MapPin, Shield, Search, Plus, Crosshair, Loader2, Minus, Camera } from "lucide-react";

export type TipoValidacao = "qrcode" | "geolocalizacao" | "foto_arbitro";
type ValStep = "metodo" | "buscar" | "cadastrar";

interface ValidacaoStepProps {
  tipoValidacao: TipoValidacao;
  onChangeTipo: (v: TipoValidacao) => void;
  localId: string | null;
  onChangeLocalId: (id: string | null) => void;
  userId: string;
}

export function ValidacaoStep({ tipoValidacao, onChangeTipo, localId, onChangeLocalId, userId }: ValidacaoStepProps) {
  const [valStep, setValStep] = useState<ValStep>("metodo");
  const [localNome, setLocalNome] = useState("");
  const [localQrToken, setLocalQrToken] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoEndereco, setNovoEndereco] = useState("");
  const [novoLat, setNovoLat] = useState<number | null>(null);
  const [novoLng, setNovoLng] = useState<number | null>(null);
  const [novoRaio, setNovoRaio] = useState(100);
  const [saving, setSaving] = useState(false);

  const { data: locais } = useQuery({
    queryKey: ["locais-validacao", busca],
    queryFn: async () => {
      let q = supabase.from("locais_validacao").select("id, nome, latitude, longitude, raio_geofence_metros, qrcode_token").limit(20);
      if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
      const { data } = await q;
      return data ?? [];
    },
    enabled: valStep === "buscar",
  });

  function usarLocalizacao() {
    if (!navigator.geolocation) return toast.error("Geolocalização não suportada");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setNovoLat(pos.coords.latitude); setNovoLng(pos.coords.longitude); toast.success("Localização capturada"); },
      () => toast.error("Não foi possível obter localização"),
    );
  }

  async function cadastrar() {
    if (!novoNome.trim()) return toast.error("Informe o nome do local");
    if (novoLat == null || novoLng == null) return toast.error("Capture a localização atual");
    if (novoRaio < 20) return toast.error("Raio mínimo é 20m");
    setSaving(true);
    const { data, error } = await supabase.from("locais_validacao").insert({
      nome: novoNome.trim(),
      latitude: novoLat,
      longitude: novoLng,
      raio_geofence_metros: novoRaio,
      criado_por: userId,
    } as any).select("id, nome, qrcode_token").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    onChangeLocalId(data.id);
    setLocalNome(data.nome);
    setLocalQrToken((data as any).qrcode_token ?? null);
    toast.success("Local cadastrado");
    setValStep("metodo");
  }

  function selecionar(l: { id: string; nome: string; qrcode_token?: string }) {
    onChangeLocalId(l.id);
    setLocalNome(l.nome);
    setLocalQrToken(l.qrcode_token ?? null);
    setValStep("metodo");
  }

  if (valStep === "buscar") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Este local já está cadastrado?</h2>
        <p className="text-xs text-muted-foreground">Busque por um local existente.</p>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar local..." className="w-full rounded-xl border border-primary/40 bg-card pl-9 pr-3 py-3 text-sm outline-none focus:border-primary" />
        </div>
        <div className="space-y-2">
          {(locais ?? []).map((l: any) => (
            <button key={l.id} onClick={() => selecionar(l)} className="w-full rounded-xl border border-border bg-card p-3 text-left flex items-start gap-3">
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
    );
  }

  if (valStep === "cadastrar") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Cadastrar novo local</h2>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome do local</span>
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Academia Alpha" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Endereço (opcional)</span>
          <input value={novoEndereco} onChange={(e) => setNovoEndereco(e.target.value)} placeholder="Ex.: R. das Flores, 123" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Localização</span>
          <button onClick={usarLocalizacao} className="w-full rounded-xl border border-primary/40 bg-card p-3 text-sm font-semibold text-primary-light inline-flex items-center justify-center gap-2">
            <Crosshair size={16} /> Usar minha localização atual
          </button>
          {novoLat != null && novoLng != null && (
            <div className="mt-2 text-[11px] text-muted-foreground">Lat: {novoLat.toFixed(5)}, Lng: {novoLng.toFixed(5)}</div>
          )}
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Raio de validação</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setNovoRaio(Math.max(20, novoRaio - 10))} className="h-11 w-11 rounded-xl bg-card border border-border inline-flex items-center justify-center text-primary-light"><Minus size={16} /></button>
            <div className="flex-1 text-center rounded-xl bg-card border border-border py-3 font-bold">{novoRaio} m</div>
            <button onClick={() => setNovoRaio(novoRaio + 10)} className="h-11 w-11 rounded-xl bg-card border border-border inline-flex items-center justify-center text-primary-light"><Plus size={16} /></button>
          </div>
        </div>
        <button onClick={cadastrar} disabled={saving} className="w-full rounded-3xl bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving && <Loader2 size={16} className="animate-spin" />} Cadastrar local
        </button>
        <button onClick={() => setValStep("buscar")} className="w-full text-center text-xs text-muted-foreground py-2">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-center">Como será validado o check-in?</h2>
        <p className="mt-1 text-xs text-center text-muted-foreground">Escolha o método de comprovação.</p>
      </div>
      <MetodoCard
        active={tipoValidacao === "qrcode"}
        onClick={() => { onChangeTipo("qrcode"); onChangeLocalId(null); setLocalNome(""); }}
        icon={<QrCode size={22} className="text-primary-light" />}
        title="QR Code"
        desc="Escaneie o mesmo QR Code todos os dias no local físico."
      />
      <MetodoCard
        active={tipoValidacao === "geolocalizacao"}
        onClick={() => { onChangeTipo("geolocalizacao"); onChangeLocalId(null); setLocalNome(""); }}
        icon={<MapPin size={22} className="text-emerald-400" />}
        title="Geolocalização"
        desc="Check-in automático em um raio de localização definido."
      />
      <MetodoCard
        active={tipoValidacao === "foto_arbitro"}
        onClick={() => { onChangeTipo("foto_arbitro"); onChangeLocalId(null); setLocalNome(""); }}
        icon={<Camera size={22} className="text-primary-light" />}
        title="Foto + Árbitro"
        desc="Envie uma foto do progresso e um árbitro convidado valida cada check-in."
      />

      {tipoValidacao !== "foto_arbitro" && (
        <button onClick={() => setValStep("buscar")} className="w-full rounded-xl border border-border bg-card p-3 text-left text-sm">
          <div className="text-xs text-muted-foreground">Local selecionado</div>
          <div className="mt-1 font-semibold truncate">{localNome || (localId ? "Local escolhido" : "Nenhum — toque para escolher")}</div>
        </button>
      )}

      {tipoValidacao === "qrcode" && localId && localQrToken && (
        <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Imprima este QR Code e cole em <span className="font-semibold text-foreground">{localNome}</span>. Ele será escaneado a cada check-in.</p>
          <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-xl bg-white p-2">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(localQrToken)}`}
              alt={`QR Code de ${localNome}`}
              className="h-full w-full"
            />
          </div>
        </div>
      )}
      {tipoValidacao === "foto_arbitro" && (
        <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
          Nesta modalidade não é necessário definir um local. Você fará check-ins com foto e um árbitro convidado aprova cada envio.
        </div>
      )}
    </div>
  );
}

function MetodoCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <div className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${active ? "border-primary bg-primary" : "border-border"}`} />
    </button>
  );
}
