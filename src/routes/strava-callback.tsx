import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/strava-callback")({
  component: StravaCallback,
});

function StravaCallback() {
  const [debug, setDebug] = useState("Iniciando...");

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const code = params.get("code");
    const error = params.get("error");
    const state = params.get("state");

    setDebug(`code: ${code ? code.substring(0,8)+"..." : "NULO"} | error: ${error ?? "nenhum"} | state: ${state ?? "nulo"}`);

    if (error) {
      setDebug("ERRO do Strava: " + error);
      setTimeout(() => window.location.replace("/strava-connect?strava_error=1"), 3000);
      return;
    }

    if (!code) {
      setDebug("ERRO: code ausente na URL");
      setTimeout(() => window.location.replace("/strava-connect?strava_error=1"), 3000);
      return;
    }

    if (state !== "vrenn-strava-oauth") {
      setDebug("ERRO: state inválido: " + state);
      setTimeout(() => window.location.replace("/strava-connect?strava_error=1"), 3000);
      return;
    }

    setDebug("Salvando code no sessionStorage... code=" + code.substring(0,8));
    sessionStorage.setItem("strava_pending_code", code);
    sessionStorage.setItem("strava_pending_ts", String(Date.now()));

    const saved = sessionStorage.getItem("strava_pending_code");
    setDebug("Salvo! Verificando: " + (saved ? saved.substring(0,8) : "FALHOU") + " — redirecionando...");

    setTimeout(() => {
      window.location.replace("/strava-connect");
    }, 1500);
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FC4C02] text-3xl font-black text-white">S</div>
      <Loader2 size={28} className="animate-spin text-purple-400" />
      <p className="text-sm text-gray-400 text-center">Conectando ao Strava...</p>
      <div className="mt-4 rounded-xl bg-gray-900 p-3 text-xs text-gray-300 font-mono break-all max-w-sm">
        {debug}
      </div>
    </main>
  );
}
