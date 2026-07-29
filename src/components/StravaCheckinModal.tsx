import { useEffect, useState } from "react";
import { Loader2, X, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ExecutionCardModal } from "./ExecutionCardModal";
import type { ExecutionCardData } from "@/lib/executionCard";

type Tipo = "meta" | "duelo" | "desafio_equipe";

interface Props {
  tipo: Tipo;
  refId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}


/**
 * Modal de check-in via Strava — usado em Meta, Duelo e Desafio em Equipe.
 * Chama a edge function `strava-validate-checkin` que valida janela de tempo (30 min)
 * e distância GPS (500 m) entre o check-in e o início da atividade no Strava.
 */
export function StravaCheckinModal({ tipo, refId, userId, onClose, onCreated }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [cardData, setCardData] = useState<ExecutionCardData | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setPos(null),
      { timeout: 10000 },
    );
  }, []);

  async function validar() {
    setBuscando(true);
    setErro(null);
    setResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body: Record<string, any> = {
        lat_checkin: pos?.lat ?? null,
        lng_checkin: pos?.lng ?? null,
      };
      if (tipo === "meta") body.meta_id = refId;
      if (tipo === "duelo") body.duelo_id = refId;
      if (tipo === "desafio_equipe") body.desafio_id = refId;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-validate-checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error && data.code === "not_connected") {
        setErro("Strava não conectado");
        return;
      }
      if (data.error) throw new Error(data.error);
      setResultado(data);
      if (data.valido) toast.success("Check-in validado pelo Strava!");
    } catch (e: any) {
      setErro(e.message ?? "Erro ao validar com Strava");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 space-y-4 pb-8"
        style={{ maxHeight: "90dvh" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FC4C02]/15 text-2xl">🚴</div>
          <div className="flex-1">
            <h3 className="text-base font-bold">Validar com Strava</h3>
            <p className="text-xs text-muted-foreground">Sua atividade mais recente será verificada</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background">
            <X size={18} />
          </button>
        </div>

        <div className={`rounded-xl border p-3 flex items-center gap-2 text-xs ${pos ? "border-green-500/30 bg-green-500/5" : "border-border bg-card"}`}>
          {pos
            ? <><span className="text-green-400">📍</span><span className="text-green-400 font-bold">Localização capturada</span></>
            : <><span className="text-muted-foreground">📍</span><span className="text-muted-foreground">Capturando localização…</span></>
          }
        </div>

        {!resultado && !erro && (
          <div className="rounded-2xl border border-border bg-background p-3 space-y-2 text-xs">
            <div className="font-bold text-primary-light mb-1">O que será validado</div>
            <div className="flex items-start gap-2"><span>⏱️</span><span>Atividade iniciada há no máximo <strong>30 minutos</strong></span></div>
            <div className="flex items-start gap-2"><span>📍</span><span>Início da atividade a no máximo <strong>500 metros</strong> daqui</span></div>
            <div className="flex items-start gap-2"><span>🏃</span><span>Corrida, caminhada, ciclismo ou natação registradas no Strava</span></div>
          </div>
        )}

        {resultado && (
          <div className={`rounded-2xl border p-4 space-y-2 ${resultado.valido ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"}`}>
            <div className={`text-sm font-bold flex items-center gap-2 ${resultado.valido ? "text-green-400" : "text-destructive"}`}>
              {resultado.valido ? "✅ Atividade validada!" : "❌ Validação falhou"}
            </div>
            {resultado.atividade && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <div><strong className="text-foreground">{resultado.atividade.nome}</strong> · {resultado.atividade.tipo}</div>
                <div>🏃 {resultado.atividade.distancia_km}km · ⏱️ {resultado.atividade.duracao_min}min</div>
                {resultado.atividade.distancia_checkin_metros !== null && (
                  <div>📍 {resultado.atividade.distancia_checkin_metros}m do local de check-in</div>
                )}
              </div>
            )}
            {resultado.motivo && !resultado.valido && (
              <div className="text-xs text-destructive">{resultado.motivo}</div>
            )}
          </div>
        )}

        {erro && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {erro === "Strava não conectado"
              ? <><strong>Strava não conectado.</strong> Vá em Configurações → Conectar Strava.</>
              : erro}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground">
            Cancelar
          </button>
          {resultado?.valido ? (
            <>
              <button
                onClick={async () => {
                  const a = resultado.atividade ?? {};
                  const { data: prof } = await supabase
                    .from("profiles")
                    .select("nome, username, avatar_url, nivel, rep_total")
                    .eq("id", userId)
                    .maybeSingle();
                  setCardData({
                    userName: prof?.nome ?? "Atleta VRENN",
                    userHandle: prof?.username ?? "seuusuario",
                    avatarUrl: prof?.avatar_url ?? null,
                    nivel: prof?.nivel ?? null,
                    rep: prof?.rep_total ?? null,
                    tipo: a.tipo === "Ride" ? "CICLISMO" : a.tipo === "Swim" ? "NATAÇÃO" : a.tipo === "Walk" ? "CAMINHADA" : "CORRIDA",
                    subtitulo: "ATIVIDADE AO AR LIVRE",
                    distanciaKm: a.distancia_km_num ?? parseFloat(a.distancia_km ?? "0"),
                    tempoSeg: a.tempo_seg ?? (a.duracao_min ?? 0) * 60,
                    ritmoStr: a.ritmo ?? null,
                    calorias: a.calorias ?? null,
                    elevacaoM: a.elevacao_m ?? null,
                    fcMedia: a.fc_media ?? null,
                    polyline: a.polyline ?? null,
                    data: a.inicio ? new Date(a.inicio) : new Date(),
                    repGanho: 250,
                    metaConcluida: true,
                    qrCodeUrl: null,
                  });
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 py-3 text-xs font-bold text-primary-light"
              >
                <Share2 size={14} /> Cartão
              </button>
              <button onClick={onCreated} className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-bold text-white">
                ✓ Confirmar
              </button>
            </>
          ) : (
            <button
              onClick={validar}
              disabled={buscando}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC4C02] py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {buscando ? <><Loader2 size={14} className="animate-spin" /> Verificando…</> : "Buscar atividade"}
            </button>
          )}
        </div>
      </div>
      {cardData && <ExecutionCardModal data={cardData} onClose={() => setCardData(null)} />}

    </div>
  );
}
