import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/strava-callback")({
  component: StravaCallback,
});

function StravaCallback() {
  const [debug, setDebug] = useState<string[]>([]);

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const allParams: string[] = [];
    params.forEach((v, k) => allParams.push(`${k}=${v.substring(0,20)}`));

    const code = params.get("code");
    const error = params.get("error");
    const state = params.get("state");

    setDebug([
      "URL params: " + (allParams.join(" | ") || "NENHUM"),
      "code: " + (code ? code.substring(0,12)+"..." : "AUSENTE"),
      "error: " + (error ?? "nenhum"),
      "state: " + (state ?? "ausente"),
      "state ok: " + (state === "vrenn-strava-oauth" ? "SIM" : "NAO - esperado: vrenn-strava-oauth"),
    ]);

    if (error) {
      setTimeout(() => window.location.replace("/strava-connect?strava_error=1"), 5000);
      return;
    }

    if (!code) {
      setTimeout(() => window.location.replace("/strava-connect?strava_error=1"), 5000);
      return;
    }

    // Salvar independente do state para testar
    sessionStorage.setItem("strava_pending_code", code);
    sessionStorage.setItem("strava_pending_ts", String(Date.now()));
    setDebug(prev => [...prev, "Code salvo no sessionStorage!"]);

    setTimeout(() => window.location.replace("/strava-connect"), 3000);
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FC4C02] text-3xl font-black text-white">S</div>
      <Loader2 size={28} className="animate-spin text-purple-400" />
      <p className="text-sm text-gray-400 text-center">Processando conexão...</p>
      <div className="mt-4 w-full max-w-sm rounded-xl bg-gray-900 p-3 space-y-1">
        {debug.map((line, i) => (
          <p key={i} className="text-xs text-gray-300 font-mono break-all">{line}</p>
        ))}
      </div>
      <p className="text-xs text-gray-500">Redirecionando em 3s...</p>
    </main>
  );
}
