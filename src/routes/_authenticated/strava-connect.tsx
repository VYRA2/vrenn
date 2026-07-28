import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Shield, CheckCircle2, XCircle, Loader2, Unlink, Activity, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strava-connect")({
  component: StravaConnect,
});

const STRAVA_CLIENT_ID = "268185";
const STRAVA_SCOPE = "read,activity:read";

function StravaConnect() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: stravaData, isLoading, refetch } = useQuery({
    queryKey: ["strava-connection", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("strava_connections")
        .select("athlete_id, athlete_name, athlete_photo, connected_at, ultima_atividade_tipo, ultima_atividade_km, ultima_atividade_em, total_atividades")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Processar code do Strava — vem do sessionStorage (salvo no callback)
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;

    // Erro explícito via query param
    if (params.get("strava_error")) {
      toast.error("Conexão com Strava cancelada ou negada.");
      window.history.replaceState({}, "", "/strava-connect");
      return;
    }

    // Code salvo no sessionStorage pelo /strava-callback
    const code = sessionStorage.getItem("strava_pending_code");
    const ts = Number(sessionStorage.getItem("strava_pending_ts") ?? 0);
    const age = Date.now() - ts;

    if (code && age < 55000) { // válido por até 55s (Strava expira em 60s)
      sessionStorage.removeItem("strava_pending_code");
      sessionStorage.removeItem("strava_pending_ts");
      setConnecting(true);
      exchangeCode(code);
    } else if (code && age >= 55000) {
      // Code expirado
      sessionStorage.removeItem("strava_pending_code");
      sessionStorage.removeItem("strava_pending_ts");
      toast.error("O código do Strava expirou. Tente conectar novamente.");
    }
  }, []);

  async function exchangeCode(code: string) {
    try {
      // Trocar code por tokens diretamente no browser (temporário até deploy da edge function)
      const tokenRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: "268185",
          client_secret: "6ae83310ea696cfce7ec3720a57c1beb4c0b7791",
          code,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(tokenData.message ?? tokenData.error ?? "Erro ao conectar com Strava");
      }

      const athlete = tokenData.athlete;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      // Salvar conexão no banco
      const { error: upsertErr } = await (supabase as any).from("strava_connections").upsert({
        user_id: user.id,
        athlete_id: String(athlete.id),
        athlete_name: `${athlete.firstname} ${athlete.lastname}`,
        athlete_photo: athlete.profile_medium ?? athlete.profile ?? null,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        connected_at: new Date().toISOString(),
        total_atividades: 1,
      }, { onConflict: "user_id" });

      if (upsertErr) throw new Error("Erro ao salvar: " + upsertErr.message);

      toast.success(`Strava conectado! Bem-vindo, ${athlete.firstname}! 🎉`);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao conectar com Strava");
    } finally {
      setConnecting(false);
    }
  }

  function conectarStrava() {
    const redirectUri = `${window.location.origin}/strava-callback`;
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=${STRAVA_SCOPE}&state=vrenn-strava-oauth`;
    window.location.href = url;
  }

  async function desconectarStrava() {
    if (!user) return;
    setDisconnecting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-disconnect`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Strava desconectado. Seus tokens foram excluídos.");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  const conectado = !!stravaData?.athlete_id;

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md px-4 pt-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate({ to: "/perfil" })} className="rounded-full p-2 text-muted-foreground hover:bg-card">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Conectar com Strava</h1>
            <p className="text-xs text-muted-foreground">Valide atividades físicas automaticamente</p>
          </div>
        </div>

        {isLoading || connecting ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 size={32} className="animate-spin text-primary-light" />
            <p className="text-sm text-muted-foreground">{connecting ? "Conectando ao Strava..." : "Carregando..."}</p>
          </div>
        ) : conectado ? (
          /* Estado: conectado */
          <div className="space-y-4">
            <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5">
              <div className="flex items-center gap-4">
                {stravaData.athlete_photo ? (
                  <img src={stravaData.athlete_photo} alt="Foto Strava" className="h-16 w-16 rounded-full border-2 border-green-500/40 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FC4C02]/20 text-3xl">🏃</div>
                )}
                <div>
                  <div className="font-bold text-foreground">{stravaData.athlete_name}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Conectado
                  </div>
                </div>
              </div>

              {stravaData.ultima_atividade_tipo && (
                <div className="mt-4 rounded-xl border border-border bg-background p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Última atividade sincronizada</div>
                  <div className="flex items-center gap-2 text-sm">
                    <Activity size={14} className="text-[#FC4C02]" />
                    <span className="font-semibold text-foreground capitalize">{stravaData.ultima_atividade_tipo}</span>
                    {stravaData.ultima_atividade_km && (
                      <span className="text-muted-foreground">— {Number(stravaData.ultima_atividade_km).toFixed(1)} km</span>
                    )}
                  </div>
                  {stravaData.ultima_atividade_em && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={11} />
                      {new Date(stravaData.ultima_atividade_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              )}

              {stravaData.total_atividades > 0 && (
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  {stravaData.total_atividades} atividades sincronizadas no total
                </div>
              )}
            </div>

            <button
              onClick={desconectarStrava}
              disabled={disconnecting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 py-3.5 text-sm font-bold text-red-400 disabled:opacity-60"
            >
              {disconnecting ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
              Desconectar Strava
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Ao desconectar, seus tokens de acesso são excluídos imediatamente.
            </p>
          </div>
        ) : (
          /* Estado: desconectado */
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FC4C02]">
                <span className="text-3xl font-black text-white">S</span>
              </div>
              <h2 className="text-lg font-bold text-foreground">Conecte sua conta Strava</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Valide suas atividades físicas de forma automática nos seus check-ins.
              </p>
              <button
                onClick={conectarStrava}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg"
                style={{ backgroundColor: "#FC4C02" }}
              >
                <span className="text-lg font-black">S</span>
                Conectar com Strava
              </button>
              <label className="mt-3 flex items-start gap-2 text-left">
                <input type="checkbox" defaultChecked className="mt-0.5 accent-[#FC4C02]" />
                <span className="text-xs text-muted-foreground">Sincronizar corridas, caminhadas e pedaladas automaticamente.</span>
              </label>
            </div>

            {/* O que acessamos */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">O que acessamos</h3>
              {[
                { ok: true, text: "Suas atividades recentes (corrida, caminhada, natação, ciclismo)" },
                { ok: true, text: "Distância e duração de cada atividade" },
                { ok: true, text: "Data e horário da atividade" },
                { ok: false, text: "Dados pessoais além do necessário" },
                { ok: false, text: "Localização em tempo real" },
                { ok: false, text: "Acesso a pagamentos ou conta bancária" },
              ].map(({ ok, text }) => (
                <div key={text} className="flex items-start gap-2 text-xs text-muted-foreground">
                  {ok
                    ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-500" />
                    : <XCircle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* Atividades suportadas */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Atividades suportadas</h3>
              <div className="grid grid-cols-3 gap-2">
                {[["🏃", "Corrida"], ["🚶", "Caminhada"], ["🏊", "Natação"], ["🚴", "Ciclismo"], ["🏋️", "Funcional"], ["⚽", "Esporte"]].map(([emoji, label]) => (
                  <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background py-3 text-xs text-muted-foreground">
                    <span className="text-xl">{emoji}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocolo de privacidade */}
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary-light">
                  <Shield size={14} /> Protocolo de Validação VRENN
                </div>
                <span className="text-xs font-black text-primary-light">VRENN</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seus dados são usados apenas para verificação de metas. Nunca vendemos ou compartilhamos suas atividades com terceiros.
              </p>
              <Link to="/politica-privacidade" className="text-xs font-semibold text-primary-light underline underline-offset-2">
                Ver Política de Privacidade completa →
              </Link>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
