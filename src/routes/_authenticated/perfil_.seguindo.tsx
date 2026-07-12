import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Search, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil_/seguindo")({
  component: Seguindo,
});

function Seguindo() {
  const { user } = Route.useRouteContext();
  const [q, setQ] = useState("");

  const { data: seguindo = [], isLoading } = useQuery({
    queryKey: ["meus-seguindo", user.id],
    queryFn: async () => {
      const { data: follows, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .eq("status", "aceito")
        .order("created_at", { ascending: false });

      if (error || !follows?.length) return [];

      const ids = follows.map((f: any) => f.following_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("nome, username, avatar_url")
        .in("id", ids);

      return profiles ?? [];
    },
  });

  const filtrados = seguindo.filter((p: any) => {
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return p.nome?.toLowerCase().includes(term) || p.username?.toLowerCase().includes(term);
  });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/perfil" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="flex-1 text-base font-bold text-center">Seguindo</h1>
          <button className="rounded-full p-2 text-primary-light" aria-label="Contatos"><UserCheck size={18} /></button>
        </div>
        <div className="mx-auto max-w-md px-4 pb-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
            <Search size={16} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar seguindo…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="mt-3 text-xs">
            <span className="font-bold text-primary-light">{seguindo.length}</span>{" "}
            <span className="text-muted-foreground">seguindo</span>
          </p>
        </div>
        <div className="h-px bg-border" />
      </header>

      <div className="mx-auto max-w-md px-4 pt-2">
        {isLoading && [...Array(6)].map((_, i) => <div key={i} className="my-2 h-16 animate-pulse rounded-2xl bg-card" />)}
        {!isLoading && filtrados.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {q ? "Nenhum perfil encontrado." : "Você ainda não segue ninguém."}
          </div>
        )}
        {filtrados.map((p: any) => (
          <div key={p.username} className="flex items-center gap-3 border-b border-border py-3">
            <Avatar profile={p} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{p.nome}</div>
              <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
            </div>
            <Link
              to="/u/$username"
              params={{ username: p.username }}
              className="rounded-full border border-primary px-4 py-1.5 text-xs font-bold text-primary-light"
            >
              Ver perfil
            </Link>
          </div>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}

function Avatar({ profile }: { profile: any }) {
  const initial = (profile?.nome ?? "?")[0]?.toUpperCase();
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full border-2 border-primary/60 object-cover" />;
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold text-primary-foreground">
      {initial}
    </div>
  );
}
