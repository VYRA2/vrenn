import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/metas")({
  component: Metas,
});

function Metas() {
  const { user } = Route.useRouteContext();
  const { data: metas } = useQuery({
    queryKey: ["my-metas-list", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto max-w-md px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold inline-flex items-center gap-2"><Target size={22} className="text-primary-light"/> Minhas metas</h1>
      </header>
      <div className="mx-auto max-w-md space-y-3 px-5">
        {(metas ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Você ainda não criou metas. <Link to="/nova-meta" className="text-primary-light font-semibold">Criar agora</Link>
          </div>
        )}
        {(metas ?? []).map((m: any) => (
          <Link key={m.id} to="/meta/$id" params={{ id: m.id }} className="block rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold truncate">{m.titulo}</h3>
              <span className="text-xs font-bold text-primary-light">{m.progresso}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#2E2E50] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary-light" style={{ width: `${Math.max(2, m.progresso)}%` }} />
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">{m.categoria} · {m.status}</div>
          </Link>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}
