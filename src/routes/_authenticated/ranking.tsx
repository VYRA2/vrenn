import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: Ranking,
});

function Ranking() {
  const { data: top } = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, username, avatar_url, reputacao_pts, streak_dias").order("reputacao_pts", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md flex-col items-center pt-5 pb-3">
        <VyraLogo size={32} />
      </header>
      <div className="mx-auto max-w-md px-5">
        <h1 className="text-2xl font-bold inline-flex items-center gap-2"><Trophy size={22} className="text-primary-light"/> Ranking</h1>
        <p className="text-xs text-muted-foreground mt-1">Top da comunidade por reputação.</p>
        <div className="mt-5 space-y-2">
          {(top ?? []).map((p: any, i: number) => (
            <Link key={p.id} to="/perfil" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className={`w-6 text-center text-sm font-bold ${i < 3 ? "text-primary-light" : "text-muted-foreground"}`}>{i + 1}</span>
              {p.avatar_url ? <img src={p.avatar_url} className="h-10 w-10 rounded-full border-2 border-primary/40 object-cover"/> :
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/40 bg-gradient-primary text-sm font-bold">{(p.nome||"?")[0].toUpperCase()}</div>}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{p.nome}</div>
                <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-primary-light">{p.reputacao_pts ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">{p.streak_dias ?? 0}d streak</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
