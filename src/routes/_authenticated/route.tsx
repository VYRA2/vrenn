import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Only check onboarding if NOT already on the onboarding page
    if (!location.pathname.startsWith("/onboarding")) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_done")
          .eq("id", data.user.id)
          .maybeSingle();
        // Only redirect if onboarding_done is explicitly false
        // null/undefined = existing user before feature, let them through
        if (profile?.onboarding_done === false) {
          throw redirect({ to: "/onboarding" });
        }
      } catch (e: any) {
        // If it's a redirect, re-throw it; otherwise ignore DB errors
        if (e?.message?.includes("redirect") || e?._isRedirect) throw e;
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
