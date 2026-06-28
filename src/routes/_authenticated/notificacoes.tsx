import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Bell, Heart, MessageCircle, UserPlus, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: Notificacoes,
});

const ICONS: Record<string, any> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  achievement: Trophy,
};

function Notificacoes() {
  const { user } = Route.useRouteContext();
  const { data: items } = useQuery({
    queryKey: ["notifs", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("notificacoes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const groups = groupByDay(items ?? []);

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/feed" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="text-base font-bold">Notificações</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-5">
        {(!items || items.length === 0) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Bell size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Sem notificações por enquanto.</p>
          </div>
        )}
        {Object.entries(groups).map(([label, list]) => (
          <section key={label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h2>
            <div className="space-y-2">
              {list.map((n) => {
                const Icon = ICONS[n.tipo] ?? Bell;
                return (
                  <div key={n.id} className={`flex items-start gap-3 rounded-2xl border border-border bg-card p-3 ${!n.lida ? "ring-1 ring-primary/40" : ""}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{n.mensagem}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                    {!n.lida && <span className="mt-1 h-2 w-2 rounded-full bg-primary" />}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}

function groupByDay(items: any[]) {
  const out: Record<string, any[]> = { Hoje: [], Ontem: [], "Esta semana": [], Anterior: [] };
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  for (const i of items) {
    const d = new Date(i.created_at);
    const diffDays = (now.getTime() - d.getTime()) / 86400000;
    if (d.toDateString() === today) out.Hoje.push(i);
    else if (d.toDateString() === yesterday) out.Ontem.push(i);
    else if (diffDays < 7) out["Esta semana"].push(i);
    else out.Anterior.push(i);
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v.length));
}
