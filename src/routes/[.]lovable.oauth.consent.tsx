import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { ShieldCheck, Loader2 } from "lucide-react";

// Beta API surface — narrow local typing so TS is happy without grep'ing SDK internals.
type OAuthResult = { redirect_url?: string; redirect_to?: string; client?: { name?: string; redirect_uri?: string } };
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};
function oauthNs(): OAuthNs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.auth as any).oauth as OAuthNs;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">Não foi possível carregar a autorização</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "um aplicativo";

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setErr(null);
    const ns = oauthNs();
    const { data, error } = approve
      ? await ns.approveAuthorization(authorization_id)
      : await ns.denyAuthorization(authorization_id);
    if (error) { setBusy(null); setErr(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(null); setErr("O servidor de autorização não retornou uma URL de redirecionamento."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center px-6 py-10">
        <VyraLogo size={56} />
        <div className="mt-6 w-full rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <ShieldCheck size={20} className="text-primary-light" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Conectar {clientName} ao VRENN</h1>
              <p className="text-xs text-muted-foreground">
                Isso permite que {clientName} use o VRENN como você.
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-sm">
            <li className="rounded-xl border border-border bg-background/50 px-3 py-2">
              Ler e criar suas metas
            </li>
            <li className="rounded-xl border border-border bg-background/50 px-3 py-2">
              Consultar o saldo da sua carteira
            </li>
            <li className="rounded-xl border border-border bg-background/50 px-3 py-2">
              Ler suas notificações
            </li>
          </ul>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Isso não ignora as permissões do VRENN nem as políticas do banco de dados.
          </p>

          {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}

          <div className="mt-5 flex gap-2">
            <button
              disabled={busy !== null}
              onClick={() => decide(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy === "approve" && <Loader2 size={16} className="animate-spin" />}
              Aprovar
            </button>
            <button
              disabled={busy !== null}
              onClick={() => decide(false)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-semibold disabled:opacity-60"
            >
              {busy === "deny" && <Loader2 size={16} className="animate-spin" />}
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
