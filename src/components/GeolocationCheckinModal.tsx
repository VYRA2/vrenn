import { useState } from "react";
import { Crosshair, Loader2, MapPin, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EntityType = "meta" | "duelo" | "desafio_equipe";

export function GeolocationCheckinModal({
  entityType,
  entityId,
  local,
  onClose,
  onCreated,
}: {
  entityType: EntityType;
  entityId: string;
  local: any;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!local?.id) return setError("Nenhum local de validação foi configurado.");
    if (!navigator.geolocation) return setError("Geolocalização não suportada neste aparelho.");

    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { error: rpcError } = await (supabase as any).rpc("registrar_checkin_validado", {
            _entidade: entityType,
            _entidade_id: entityId,
            _metodo: "geolocalizacao",
            _qrcode_token: null,
            _latitude: coords.latitude,
            _longitude: coords.longitude,
            _mensagem: `Check-in validado por geolocalização em ${local.nome}.`,
          });
          if (rpcError) throw rpcError;
          toast.success("Check-in validado pela localização!");
          onCreated();
        } catch (e: any) {
          setError(e?.message ?? "Não foi possível validar a localização.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError("Não foi possível obter sua localização. Verifique a permissão do navegador.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Validar pela localização</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <MapPin size={28} className="text-emerald-400" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Confirme que você está em <span className="font-semibold text-foreground">{local?.nome ?? "local definido"}</span>.
          A distância é verificada no servidor e não pode ser informada manualmente.
        </p>
        {error && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
        <button onClick={confirm} disabled={loading || !local?.id} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
          Confirmar localização atual
        </button>
      </div>
    </div>
  );
}
