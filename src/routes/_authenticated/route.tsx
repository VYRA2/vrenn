import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedAuth = {
  user: User;
  onboardingDone: boolean;
  checkedAt: number;
};

let cachedAuth: CachedAuth | null = null;
let authListenerStarted = false;

export function clearAuthenticatedRouteCache() {
  cachedAuth = null;
}

function ensureAuthCacheInvalidation() {
  if (authListenerStarted || typeof window === "undefined") return;
  authListenerStarted = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") {
      clearAuthenticatedRouteCache();
      return;
    }

    if (event === "SIGNED_IN" && cachedAuth?.user.id !== session?.user.id) {
      clearAuthenticatedRouteCache();
    }
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  staleTime: AUTH_CACHE_TTL_MS,
  beforeLoad: async () => {
    ensureAuthCacheInvalidation();
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
      clearAuthenticatedRouteCache();
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
