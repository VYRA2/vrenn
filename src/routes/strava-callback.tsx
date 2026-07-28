import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/strava-callback")({
  component: StravaCallback,
});

function StravaCallback() {
  useEffect(() => {
    try {
      const params = new URL(window.location.href).searchParams;
      const code = params.get("code");
      const error = params.get("error");
      const state = params.get("state");

      if (error || !code || state !== "vrenn-strava-oauth") {
        window.location.replace("/strava-connect?strava_error=1");
        return;
      }

      sessionStorage.setItem("strava_pending_code", code);
      sessionStorage.setItem("strava_pending_ts", String(Date.now()));
      window.location.replace("/strava-connect");
    } catch (_) {
      window.location.replace("/strava-connect?strava_error=1");
    }
  }, []);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Conectando ao Strava...</div>
    </main>
  );
}
