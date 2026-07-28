import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/strava-callback")({
  component: StravaCallback,
});

function StravaCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [msg, setMsg] = useState("Conectando ao Strava...");

  useEffect(() => {
    async function handle() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error || !code) {
          setStatus("error");
          setMsg("Conexão cancelada ou erro no Strava.");
          setTimeout(() => navigate({ to: "/strava-connect" }), 2000);
          return;
        }

        if (state !== "vrenn-strava-oauth") {
          setStatus("error");
          setMsg("Estado inválido. Tente novamente.");
          setTimeout(() => navigate({ to: "/strava-connect" }), 2000);
          return;
        }

        // Garantir sessão ativa
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          // Salvar code no sessionStorage e redirecionar para login
          sessionStorage.setItem("strava_pending_code", code);
          navigate({ to: "/auth" });
          return;
        }

        const token = sessionData.session.access_token;

        setMsg("Trocando código por tokens...");

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-oauth`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ code }),
          }
        );

        const data = await res.json();

        if (data.error) throw new Error(data.error);

        setStatus("success");
        setMsg(`Strava conectado! Bem-vindo, ${data.athlete_name}!`);
        setTimeout(() => navigate({ to: "/strava-connect" }), 1500);
      } catch (e: any) {
        setStatus("error");
        setMsg(e.message ?? "Erro ao conectar com Strava");
        setTimeout(() => navigate({ to: "/strava-connect" }), 2500);
      }
    }

    handle();
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-foreground px-6">
      {status === "loading" && (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FC4C02] text-3xl font-black text-white">S</div>
          <Loader2 size={28} className="animate-spin text-primary-light" />
          <p className="text-sm text-muted-foreground text-center">{msg}</p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 size={48} className="text-green-500" />
          <p className="text-base font-bold text-foreground text-center">{msg}</p>
          <p className="text-xs text-muted-foreground">Redirecionando...</p>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle size={48} className="text-destructive" />
          <p className="text-sm text-muted-foreground text-center">{msg}</p>
          <p className="text-xs text-muted-foreground">Redirecionando...</p>
        </>
      )}
    </main>
  );
}
