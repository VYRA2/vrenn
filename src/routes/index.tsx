import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-gradient-glow opacity-80" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-6 py-16">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <VyraLogo size={88} />
          <h1 className="mt-12 text-4xl font-extrabold leading-tight tracking-tight max-w-xs">
            Não diga que vai fazer.<br />
            <span className="bg-gradient-to-r from-primary-light to-primary bg-clip-text text-transparent">Mostre.</span>
          </h1>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            A rede social onde compromissos viram reputação verificada.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <Link
            to="/auth"
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-glow transition-transform active:scale-[0.98]"
          >
            Começar agora <ArrowRight size={18} />
          </Link>
          <Link to="/auth" className="block text-center text-sm text-muted-foreground py-2">
            Já tenho uma conta
          </Link>
        </div>
        {checking && <div className="sr-only">Verificando sessão</div>}
      </div>
    </main>
  );
}
