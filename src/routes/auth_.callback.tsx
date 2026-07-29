import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth_/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [msg, setMsg] = useState("Finalizando login...");

  useEffect(() => {
    async function handleCallback() {
      try {
        // Supabase processa o hash/code automaticamente ao carregar a página
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setStatus("error");
          setMsg("Erro ao autenticar: " + error.message);
          setTimeout(() => navigate({ to: "/auth" }), 2500);
          return;
        }

        if (!session) {
          // Aguardar um pouco para o Supabase processar o OAuth callback
          await new Promise(r => setTimeout(r, 1500));
          const { data: { session: session2 } } = await supabase.auth.getSession();
          if (!session2) {
            setStatus("error");
            setMsg("Sessão não encontrada. Redirecionando...");
            setTimeout(() => navigate({ to: "/auth" }), 2000);
            return;
          }
        }

        // Sessão válida — verificar se perfil existe (novo usuário)
        const userId = session?.user?.id;
        if (userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, nome")
            .eq("id", userId)
            .maybeSingle();

          if (!profile?.username || !profile?.nome) {
            // Novo usuário via Google — ir para onboarding
            setMsg("Conta criada! Configurando seu perfil...");
            await new Promise(r => setTimeout(r, 800));
            navigate({ to: "/onboarding" });
          } else {
            // Usuário existente — ir para feed
            setMsg("Bem-vindo de volta! 🔥");
            await new Promise(r => setTimeout(r, 500));
            navigate({ to: "/feed" });
          }
        } else {
          navigate({ to: "/feed" });
        }
      } catch (e: any) {
        setStatus("error");
        setMsg("Erro inesperado. Redirecionando...");
        setTimeout(() => navigate({ to: "/auth" }), 2000);
      }
    }

    handleCallback();
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-foreground">
      {status === "loading" ? (
        <>
          <Loader2 size={36} className="animate-spin text-primary-light" />
          <p className="text-sm text-muted-foreground">{msg}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-destructive">{msg}</p>
          <p className="text-xs text-muted-foreground">Você será redirecionado em instantes...</p>
        </>
      )}
    </main>
  );
}
