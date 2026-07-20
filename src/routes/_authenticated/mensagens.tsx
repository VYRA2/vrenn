import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { Search, X, Shield, Users, Archive, MessageCircle, PenSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mensagens")({
  component: Mensagens,
});

type TabDM = "todas" | "nao_lidas" | "grupos" | "arquivadas";

function Mensagens() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [openNew, setOpenNew] = useState(false);
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<TabDM>("todas");

  const { data: conversas, refetch } = useQuery({
    queryKey: ["conversas", user.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("conversas")
        .select("id, user1_id, user2_id, ultima_mensagem, ultima_mensagem_at, created_at, tipo, equipe_id, nome")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("ultima_mensagem_at", { ascending: false, nullsFirst: false });
      const items = data ?? [];

      // DM profiles
      const dmIds = Array.from(new Set(
        items.filter((c: any) => c.tipo !== "grupo_equipe")
          .map((c: any) => c.user1_id === user.id ? c.user2_id : c.user1_id)
      ));
      let profiles: Record<string, any> = {};
      if (dmIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome, username, avatar_url, nivel").in("id", dmIds as string[]);
        (profs ?? []).forEach((p: any) => { profiles[p.id] = p; });
      }

      // Equipe names/avatars for group chats
      const equipeIds = items.filter((c: any) => c.tipo === "grupo_equipe" && c.equipe_id).map((c: any) => c.equipe_id);
      let equipes: Record<string, any> = {};
      if (equipeIds.length) {
        const { data: eqs } = await (supabase as any).from("equipes").select("id, nome, avatar_url").in("id", equipeIds);
        (eqs ?? []).forEach((e: any) => { equipes[e.id] = e; });
      }

      // Unread counts
      const { data: unreads } = await supabase
        .from("mensagens")
        .select("conversa_id")
        .in("conversa_id", items.map((c: any) => c.id))
        .neq("sender_id", user.id)
        .eq("lida", false);
      const unreadMap: Record<string, number> = {};
      (unreads ?? []).forEach((m: any) => { unreadMap[m.conversa_id] = (unreadMap[m.conversa_id] ?? 0) + 1; });

      return items.map((c: any) => {
        const isGrupo = c.tipo === "grupo_equipe";
        const equipe = isGrupo ? equipes[c.equipe_id] : null;
        const other = isGrupo ? null : profiles[c.user1_id === user.id ? c.user2_id : c.user1_id];
        return {
          ...c,
          other,
          equipe,
          unread: unreadMap[c.id] ?? 0,
          displayNome: isGrupo ? (equipe?.nome ?? c.nome ?? "Grupo") : (other?.nome ?? "Usuário"),
          displayAvatar: isGrupo ? equipe?.avatar_url : other?.avatar_url,
          isGrupo,
        };
      });
    },
  });

  const { data: buscaUsers } = useQuery({
    enabled: openNew && busca.trim().length > 0,
    queryKey: ["mensagens-buscar", busca],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, username, avatar_url").neq("id", user.id).or(`nome.ilike.%${busca.trim()}%,username.ilike.%${busca.trim()}%`).limit(20);
      return data ?? [];
    },
  });

  async function iniciarConversa(otherId: string) {
    const [a, b] = [user.id, otherId].sort();
    const { data: existente } = await (supabase as any).from("conversas").select("id").or(`and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`).maybeSingle();
    if (existente?.id) { navigate({ to: "/mensagens/$id", params: { id: existente.id } }); return; }
    const { data: nova, error } = await (supabase as any).from("conversas").insert({ user1_id: user.id, user2_id: otherId }).select("id").single();
    if (error || !nova) return toast.error(error?.message ?? "Erro");
    navigate({ to: "/mensagens/$id", params: { id: nova.id } });
  }

  const filtered = (conversas ?? []).filter((c: any) => {
    if (tab === "nao_lidas") return c.unread > 0;
    if (tab === "grupos") return c.isGrupo;
    return true;
  });

  const TABS: { id: TabDM; label: string; icon: any }[] = [
    { id: "todas", label: "Todas", icon: MessageCircle },
    { id: "nao_lidas", label: "Não lidas", icon: MessageCircle },
    { id: "grupos", label: "Grupos", icon: Users },
    { id: "arquivadas", label: "Arquivadas", icon: Archive },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      {/* Header estilo VRENN */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="mx-auto max-w-md px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <VyraLogo size={28} />
            <div className="flex items-center gap-2">
              <button onClick={() => setOpenNew(true)} className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-primary-light">
                <Search size={18} />
              </button>
              <button onClick={() => setOpenNew(true)} className="rounded-full bg-primary p-2 text-primary-foreground">
                <PenSquare size={18} />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Não diga que vai fazer. <span className="text-primary-light font-semibold">Mostre.</span></p>

          {/* Tabs */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${tab === id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
              >
                {label}
                {id === "nao_lidas" && (conversas ?? []).some((c: any) => c.unread > 0) && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-3 space-y-1">
        {/* Privacy card */}
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Shield size={18} className="text-primary-light" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold">Suas conversas são seguras</div>
            <div className="text-[11px] text-muted-foreground">Privacidade em primeiro lugar. Suas mensagens são protegidas.</div>
          </div>
          <span className="text-xs font-semibold text-primary-light shrink-0">Saiba mais →</span>
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <MessageCircle size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
            <button onClick={() => setOpenNew(true)} className="mt-4 rounded-xl bg-gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground">Iniciar conversa</button>
          </div>
        )}

        {filtered.map((c: any) => (
          <Link
            key={c.id}
            to="/mensagens/$id"
            params={{ id: c.id }}
            className="flex items-center gap-3 border-b border-border/40 py-3 hover:bg-card/50 rounded-xl px-2 transition-colors"
          >
            {/* Avatar com dot online */}
            <div className="relative shrink-0">
              <div className="h-14 w-14 rounded-full overflow-hidden ring-2 ring-primary/40">
                {c.displayAvatar ? (
                  <img src={c.displayAvatar} className="h-full w-full object-cover" alt="" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-primary text-base font-bold text-primary-foreground">
                    {c.displayNome[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              {!c.isGrupo && (
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-background" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm font-bold truncate">{c.displayNome}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{tempoRel(c.ultima_mensagem_at ?? c.created_at)}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{(c.ultima_mensagem ?? "").slice(0, 45) || "Sem mensagens"}</div>
              {/* Meta badge if exists */}
              {c.meta_titulo && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary-light">
                  ✓ Meta: {c.meta_titulo}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              {c.unread > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{c.unread}</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Modal nova conversa */}
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
                <button key={u.id} onClick={() => { iniciarConversa(u.id); setOpenNew(false); }} className="w-full flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-left hover:border-primary/50">
                  <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden ring-2 ring-primary/30">
                    {u.avatar_url ? <img src={u.avatar_url} className="h-full w-full object-cover" alt="" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-primary text-xs font-bold text-primary-foreground">{u.nome[0]?.toUpperCase()}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{u.nome}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
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

function tempoRel(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800) return ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()];
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
