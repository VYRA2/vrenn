import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { TrendingUp } from "lucide-react";
import heroImg from "@/assets/splash-hero.jpg";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const [, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Hero background image bottom half */}
      <div
        className="absolute inset-x-0 bottom-0 h-[65vh] bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImg})` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[65vh] bg-gradient-to-b from-background via-background/40 to-background/90" />

      <div className="relative z-10 flex min-h-screen flex-col items-center px-6 pt-16 pb-8">
        <VyraLogo size={96} vertical />
        <p className="mt-3 text-center text-sm text-foreground/90">
          Não diga que vai fazer. <span className="text-primary-light font-semibold">Mostre.</span>
        </p>

        <div className="flex-1" />

        <div className="flex flex-col items-center text-center px-4">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/40 bg-card/40 backdrop-blur">
            <TrendingUp size={20} className="text-primary-light" />
          </div>
          <h2 className="text-xl font-bold leading-tight">
            Transforme disciplina<br />
            <span className="text-primary-light">em reputação.</span>
          </h2>
          <p className="mt-3 max-w-xs text-xs text-muted-foreground leading-relaxed">
            A primeira rede social onde sua evolução é registrada, acompanhada e reconhecida.
          </p>
          <div className="mt-5 flex gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-primary" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          </div>
        </div>

        <div className="mt-8 w-full max-w-sm space-y-3">
          <Link
            to="/auth"
            className="flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-glow transition-transform active:scale-[0.98]"
          >
            Começar agora
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/auth" className="text-primary-light font-semibold">Entrar</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
