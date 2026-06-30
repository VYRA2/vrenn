import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { Search, Bell, Heart, Bell as BellIcon, Swords, MoreHorizontal, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/feed")({
  component: Feed,
});

type Tab = "para-voce" | "seguindo" | "em-alta";

function Feed() {
  const [tab, setTab] = useState<Tab>("para-voce");
  const { user } = Route.useRouteContext();

  const { data: metas, isLoading } = useQuery({
    queryKey: ["feed-metas", tab, user.id],
    queryFn: async () => {
      if (tab === "seguindo") {
        const { data: f } = await supabase
          .from("follows").select("following_id")
          .eq("follower_id", user.id).eq("status", "aceito");
        const ids = (f ?? []).map((x: any) => x.following_id);
        if (!ids.length) return [];
        const { data } = await supabase
          .from("metas")
          .select("id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, valor_custodia, profiles:user_id (nome, username, avatar_url)")
          .in("user_id", ids)
          .order("created_at", { ascending: false }).limit(30);
        return data ?? [];
      }
      if (tab === "em-alta") {
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data: ap } = await supabase.from("apoios").select("meta_id").gte("created_at", since);
        const counts = new Map<string, number>();
        (ap ?? []).forEach((r: any) => counts.set(r.meta_id, (counts.get(r.meta_id) ?? 0) + 1));
        const { data } = await supabase
          .from("metas")
          .select("id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, valor_custodia, profiles:user_id (nome, username, avatar_url)")
          .order("created_at", { ascending: false }).limit(60);
        return (data ?? []).sort((a: any, b: any) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).slice(0, 20);
      }
      const { data } = await supabase
        .from("metas")
        .select("id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, valor_custodia, profiles:user_id (nome, username, avatar_url)")
        .order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2">
          <VyraLogo size={32} />
          <div className="flex items-center gap-1">
            <Link to="/busca" className="rounded-full p-2 text-foreground/90"><Search size={22} /></Link>
            <Link to="/ranking" className="rounded-full p-2 text-foreground/90"><Trophy size={22} /></Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-md px-5">
          {([["para-voce", "Para você"], ["seguindo", "Seguindo"], ["em-alta", "Em alta"]] as const).map(([k, l]) => {
            const active = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${active ? "text-primary-light" : "text-muted-foreground"}`}>
                {l}
                {active && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-border" />
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {isLoading && [1, 2, 3].map(i => <Skeleton key={i} />)}
        {!isLoading && (!metas || metas.length === 0) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {tab === "seguindo" ? "Você ainda não segue ninguém. Use a busca para encontrar pessoas." : "Nenhuma meta ainda."}
            </p>
            {tab !== "seguindo" && (
              <Link to="/nova-meta" className="mt-4 inline-block rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">Criar minha meta</Link>
            )}
          </div>
        )}
        {metas?.map((m: any) => <MetaCard key={m.id} meta={m} userId={user.id} />)}
      </div>

      <BottomNav />
    </main>
  );
}

function MetaCard({ meta, userId }: { meta: any; userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = meta.profiles;
  const initial = (profile?.nome || profile?.username || "?")[0].toUpperCase();
  const diasRestantes = meta.prazo ? Math.max(0, Math.ceil((new Date(meta.prazo).getTime() - Date.now()) / 86400000)) : null;
  const [busy, setBusy] = useState<string | null>(null);

  async function apoiar(e: React.MouseEvent) {
    e.preventDefault();
    setBusy("apoiar");
    const { error } = await supabase.from("apoios").insert({ user_id: userId, meta_id: meta.id });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else {
      toast.success("Apoio registrado");
      if (meta.user_id !== userId) await supabase.rpc("notify", { _user_id: meta.user_id, _tipo: "apoio", _mensagem: "Alguém apoiou sua meta.", _link_id: meta.id });
      qc.invalidateQueries({ queryKey: ["feed-metas"] });
    }
    setBusy(null);
  }
  async function cobrar(e: React.MouseEvent) {
    e.preventDefault();
    if (meta.user_id === userId) return toast.info("Você não pode se cobrar.");
    setBusy("cobrar");
    const { error } = await supabase.rpc("notify", { _user_id: meta.user_id, _tipo: "cobranca", _mensagem: "Alguém te cobrou na meta.", _link_id: meta.id });
    if (error) toast.error(error.message); else toast.success("Cobrança enviada");
    setBusy(null);
  }
  function desafiar(e: React.MouseEvent) {
    e.preventDefault();
    navigate({ to: "/duelos", search: { challenge: meta.user_id, titulo: meta.titulo } as any });
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <Link to="/meta/$id" params={{ id: meta.id }} className="block">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.nome} className="h-11 w-11 rounded-full border-2 border-primary/60 object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold text-primary-foreground">
              {initial}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-base font-bold">{profile?.nome ?? "Usuário"}</span>
              <BadgeCheck size={16} className="text-primary-light fill-primary/20" />
            </div>
            <div className="text-xs text-muted-foreground">@{profile?.username ?? "—"} · {formatWhen(meta.created_at)}</div>
          </div>
          <button onClick={(e) => e.preventDefault()} className="text-muted-foreground"><MoreHorizontal size={20} /></button>
        </div>

        <h3 className="mt-3 text-lg font-extrabold leading-tight">{meta.titulo}</h3>
        {meta.descricao && <p className="mt-1.5 text-sm text-muted-foreground leading-snug">{meta.descricao}</p>}

        {meta.foto_capa_url && (
          <div className="mt-3 overflow-hidden rounded-xl">
            <img src={meta.foto_capa_url} alt="" className="w-full h-48 object-cover" />
          </div>
        )}

        <div className="mt-3">
          <div className="mb-1.5 flex items-end justify-between">
            <div>
              <span className="text-xs text-muted-foreground">Progresso</span>
              <div className="text-xl font-bold text-primary-light leading-none mt-1">{meta.progresso}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-primary-light">{diasRestantes !== null ? `${diasRestantes} dias restantes` : "Sem prazo"}</div>
              {meta.prazo && <div className="text-[10px] text-muted-foreground mt-0.5">Até {new Date(meta.prazo).toLocaleDateString("pt-BR")}</div>}
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-[#2E2E50] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light transition-all" style={{ width: `${Math.max(2, meta.progresso)}%` }} />
          </div>
        </div>
      </Link>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
        <MicroAction icon={<Heart size={16} />} label="Apoiar" color="text-rose-400" onClick={apoiar} disabled={busy === "apoiar"} />
        <MicroAction icon={<BellIcon size={16} />} label="Cobrar" color="text-amber-400" onClick={cobrar} disabled={busy === "cobrar"} />
        <MicroAction icon={<Swords size={16} />} label="Desafiar" color="text-primary-light" onClick={desafiar} />
      </div>
    </article>
  );
}

function MicroAction({ icon, label, color, onClick, disabled }: { icon: React.ReactNode; label: string; color: string; onClick?: (e: React.MouseEvent) => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2 text-xs font-semibold ${color} hover:border-primary/50 transition-colors disabled:opacity-60`}>
      {icon}<span>{label}</span>
    </button>
  );
}

function Skeleton() { return <div className="h-56 animate-pulse rounded-2xl bg-card" />; }

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const hh = d.toTimeString().slice(0, 5);
  if (sameDay) return `Hoje às ${hh}`;
  if (isYesterday) return `Ontem às ${hh}`;
  return d.toLocaleDateString("pt-BR");
}
