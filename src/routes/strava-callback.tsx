import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/strava-callback")({
  component: StravaCallback,
});

function StravaCallback() {
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const code = params.get("code");
    const error = params.get("error");
    const state = params.get("state");

    if (error || !code) {
      // Redirecionar com erro
      window.location.replace("/strava-connect?strava_error=1");
      return;
    }

    if (state !== "vrenn-strava-oauth") {
      window.location.replace("/strava-connect?strava_error=1");
      return;
    }

    // Redirecionar imediatamente para tela autenticada com o code
    // O code é válido por 60s — o redirect é instantâneo
    window.location.replace(`/strava-connect?strava_code=${encodeURIComponent(code)}`);
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FC4C02] text-3xl font-black text-white">S</div>
      <Loader2 size={28} className="animate-spin text-purple-400" />
      <p className="text-sm text-gray-400">Conectando ao Strava...</p>
    </main>
  );
}
