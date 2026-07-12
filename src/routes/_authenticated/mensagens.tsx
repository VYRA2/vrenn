import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, PenSquare, Search, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mensagens")({
  component: Mensagens,
});

function Mensagens() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [openNew, setOpenNew] = useState(false);
  const [busca, setBusca] = useState("");

  const { data: conversas } = useQuery({
    queryKey: ["conversas", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversas")
        .select("id, user1_id, user2_id, ultima_mensagem, ultima_mensagem_at, created_at")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("ultima_mensagem_at", { ascending: false, nullsFirst: false });
      const items = data ?? [];
      const otherIds = Array.from(new Set(items.map((c: any) => (c.user1_id === user.id ? c.user2_id : c.user1_id))));
      let profiles: Record<string, any> = {};
      if (otherIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome, username, avatar_url").in("id", otherIds);
        (profs ?? []).forEach((p: any) => { profiles[p.id] = p; });
      }
      return items.map((c: any) => ({ ...c, other: profiles[c.user1_id === user.id ? c.user2_id : c.user1_id] }));
    },
  });

  const { data: buscaUsers } = useQuery({
    enabled: openNew && busca.trim().length > 0,
    queryKey: ["mensagens-buscar", busca],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, username, avatar_url")
        .neq("id", user.id)
        .or(`nome.ilike.%${busca.trim()}%,username.ilike.%${busca.trim()}%`)
        .limit(20);
      return data ?? [];
    },
  });

  async function iniciarConversa(otherId: string) {
    const [a, b] = [user.id, otherId].sort();
    const { data: existente } = await supabase
      .from("conversas")
      .select("id")
      .or(`and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`)
      .maybeSingle();
    if (existente?.id) {
      navigate({ to: "/mensagens/$id", params: { id: existente.id } });
      return;
    }
    const { data: nova, error } = await supabase
      .from("conversas")
      .insert({ user1_id: user.id, user2_id: otherId } as any)
      .select("id")
      .single();
    if (error || !nova) return toast.error(error?.message ?? "Erro ao criar conversa");
    navigate({ to: "/mensagens/$id", params: { id: nova.id } });
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/feed" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="flex-1 text-base font-bold text-center">Mensagens</h1>
          <button onClick={() => setOpenNew(true)} className="rounded-full p-2 text-primary-light hover:bg-card" aria-label="Nova conversa">
            <PenSquare size={20} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-3 space-y-2">
        {(!conversas || conversas.length === 0) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <MessageCircle size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
            <button onClick={() => setOpenNew(true)} className="mt-4 rounded-xl bg-gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground">Iniciar conversa</button>
          </div>
        )}
        {(conversas ?? []).map((c: any) => (
          <Link
            key={c.id}
            to="/mensagens/$id"
            params={{ id: c.id }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50"
          >
            <Avatar url={c.other?.avatar_url} nome={c.other?.nome} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm truncate">{c.other?.nome ?? "Usuário"}</div>
                <div className="text-[10px] text-muted-foreground shrink-0">{tempoRel(c.ultima_mensagem_at ?? c.created_at)}</div>
              </div>
              <div className="text-xs text-muted-foreground truncate">@{c.other?.username ?? "—"}</div>
              <div className="text-xs text-foreground/80 truncate mt-0.5">{(c.ultima_mensagem ?? "").slice(0, 40) || "Sem mensagens"}</div>
            </div>
          </Link>
        ))}
      </div>

      {openNew && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setOpenNew(false)}>
          <div className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-8 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">Nova conversa</h3>
              <button onClick={() => setOpenNew(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18} /></button>
            </div>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou @username" className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-3 text-sm outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              {(buscaUsers ?? []).map((u: any) => (
                <button key={u.id} onClick={() => iniciarConversa(u.id)} className="w-full flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-left hover:border-primary/50">
                  <Avatar url={u.avatar_url} nome={u.nome} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{u.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                  </div>
                </button>
              ))}
              {busca.trim() && (buscaUsers ?? []).length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Nenhum usuário encontrado</div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function Avatar({ url, nome }: { url?: string | null; nome?: string | null }) {
  const initial = (nome ?? "?")[0]?.toUpperCase();
  return (
    <div className="h-12 w-12 shrink-0 rounded-full border border-primary/40 overflow-hidden">
      {url ? (
        <img src={url} className="h-full w-full object-cover" alt="" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-primary text-sm font-bold">{initial}</div>
      )}
    </div>
  );
}

function tempoRel(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("pt-BR");
}
