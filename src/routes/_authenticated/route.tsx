import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedAuth = {
  user: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] extends infer S
    ? S extends { user: infer U }
      ? U
      : never
    : never;
  onboardingDone: boolean;
  checkedAt: number;
};

let cachedAuth: CachedAuth | null = null;

export function clearAuthenticatedRouteCache() {
  cachedAuth = null;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  staleTime: AUTH_CACHE_TTL_MS,
  beforeLoad: async () => {
    const now = Date.now();

    if (cachedAuth && now - cachedAuth.checkedAt < AUTH_CACHE_TTL_MS) {
      if (!cachedAuth.onboardingDone) throw redirect({ to: "/onboarding" });
      return { user: cachedAuth.user };
    }

    // getSession lê a sessão local já validada pelo Supabase e evita uma
    // chamada de rede em cada troca entre telas autenticadas.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (error || !user) {
      cachedAuth = null;
      throw redirect({ to: "/auth" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_done")
      .eq("id", user.id)
      .maybeSingle();

    const onboardingDone = profile?.onboarding_done === true;
    cachedAuth = { user, onboardingDone, checkedAt: now };

    if (!onboardingDone) throw redirect({ to: "/onboarding" });

    return { user };
  },
  component: () => <Outlet />,
});
