import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthCallback,
});

function isSafeNext(next: string | undefined): next is string {
  return !!next && next.startsWith("/") && !next.startsWith("//");
}

function AuthCallback() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (!cancelled) navigate({ to: "/auth", replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_done")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile?.onboarding_done) {
        navigate({ to: "/onboarding", replace: true });
        return;
      }

      const dest = isSafeNext(next) ? next : "/feed";
      navigate({ to: dest, replace: true });
    };

    // Wait briefly for session to hydrate if this is a fresh OAuth return.
    const timer = setTimeout(resolve, 50);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") resolve();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [navigate, next]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Entrando…</p>
      </div>
    </div>
  );
}
