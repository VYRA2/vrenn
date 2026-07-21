import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { Search, SlidersHorizontal, MoreVertical, Clock, X, Users, Globe } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/busca")({
  component: BuscaPage,
});

type Tab = "pessoas" | "metas" | "duelos" | "equipes";

function BuscaPage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("pessoas");
  const [q, setQ] = useState("");

  const { data: results, isFetching } = useQuery({
    queryKey: ["busca", tab, q],
    queryFn: async () => {
      if (q.trim().length < 2) return [];
      const term = `%${q.trim()}%`;
      if (tab === "pessoas") {
        const { data } = await supabase
          .from("profiles")
          .select("id, nome, username, avatar_url")
          .or(`nome.ilike.${term},username.ilike.${term}`)
          .limit(20);
        return data ?? [];
      }
      if (tab === "metas") {
        const { data } = await supabase
          .from("metas")
          .select("id, titulo, categoria, progresso, user_id, profiles:user_id(nome, username, avatar_url)")
          .ilike("titulo", term)
          .limit(20);
        return data ?? [];
      }
      if (tab === "duelos") {
        const { data } = await supabase
          .from("duelos")
          .select("id, titulo, status")
          .ilike("titulo", term)
          .limit(20);
        return data ?? [];
      }
      if (tab === "equipes") {
        const { data } = await supabase
          .from("equipes")
          .select("id, nome, descricao, foto_url, publica, criador_id, profiles:criador_id(nome, username)")
          .ilike("nome", term)
          .eq("publica", true)
          .limit(20);
        return data ?? [];
      }
      return [];
    },
  });

  const { data: recentes, refetch: refetchRecentes } = useQuery({
    queryKey: ["buscas-recentes", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_searches").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
  });

  async function saveSearch(termo: string) {
    if (termo.trim().length < 2) return;
    await supabase.from("user_searches").insert({ user_id: user.id, termo: termo.trim() });
    refetchRecentes();
  }
  async function clearAll() {
    await supabase.from("user_searches").delete().eq("user_id", user.id);
    refetchRecentes();
  }
  async function removeSearch(id: string) {
    await supabase.from("user_searches").delete().eq("id", id);
    refetchRecentes();
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md flex-col items-center pt-5 pb-3">
        <VyraLogo size={32} />
      </header>

      <div className="mx-auto max-w-md px-5">
        <div className="flex items-center gap-2 rounded-2xl border border-primary/60 bg-background px-4 py-3">
          <Search size={18} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => saveSearch(q)}
            placeholder="Buscar pessoas, metas, equipes…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button className="text-muted-foreground"><SlidersHorizontal size={16} /></button>
        </div>

        <div className="mt-4 flex justify-around border-b border-border">
          {(["pessoas", "metas", "duelos", "equipes"] as const).map((k) => {
            const a = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} className={`relative flex-1 pb-2 text-sm font-semibold capitalize ${a ? "text-primary-light" : "text-muted-foreground"}`}>
                {k}
                {a && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {q.trim().length >= 2 && (
          <section className="mt-4">
            <h3 className="mb-3 text-sm font-bold">Resultados para você</h3>
            {isFetching && <p className="text-xs text-muted-foreground">Buscando…</p>}
            <div className="space-y-2">
              {tab === "pessoas" && (results ?? []).map((p: any) => <PessoaRow key={p.id} pessoa={p} userId={user.id} />)}
              {tab === "metas" && (results ?? []).map((m: any) => (
                <Link key={m.id} to="/meta/$id" params={{ id: m.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{m.titulo}</div>
                    <div className="text-xs text-muted-foreground">@{m.profiles?.username ?? "—"} · {m.categoria}</div>
                  </div>
                  <span className="text-xs font-bold text-primary-light">{m.progresso}%</span>
                </Link>
              ))}
              {tab === "duelos" && (results ?? []).map((d: any) => (
                <Link key={d.id} to="/duelo/$id" params={{ id: d.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{d.titulo}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                    d.status === "ativo" ? "bg-accent/15 text-accent" :
                    d.status === "pendente" ? "bg-yellow-500/15 text-yellow-500" :
                    "bg-muted text-muted-foreground"
                  }`}>{d.status}</span>
                </Link>
              ))}
              {tab === "equipes" && (results ?? []).map((e: any) => (
                <EquipeRow key={e.id} equipe={e} userId={user.id} />
              ))}
              {!isFetching && (results ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sem resultados para "{q}".</p>
              )}
            </div>
          </section>
        )}

        {q.trim().length < 2 && (
          <>
            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold">Buscas recentes</h3>
                {(recentes?.length ?? 0) > 0 && (
                  <button onClick={clearAll} className="text-xs font-semibold text-primary-light">Limpar tudo</button>
                )}
              </div>
              <div className="space-y-1">
                {(recentes ?? []).map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 px-1 py-2 border-b border-border/40">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 text-primary-light"><Clock size={14} /></div>
                    <button onClick={() => setQ(r.termo)} className="flex-1 text-left text-sm truncate">{r.termo}</button>
                    <button onClick={() => removeSearch(r.id)} className="text-muted-foreground"><X size={14} /></button>
                  </div>
                ))}
                {(recentes?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Sem buscas recentes.</p>}
              </div>
            </section>

            <section className="mt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 text-primary-light"><Search size={26} /></div>
              <h4 className="mt-4 text-base font-bold">Busque pessoas para seguir</h4>
              <p className="mt-1 text-xs text-muted-foreground">Encontre pessoas incríveis, inspire-se e conquiste junto.</p>
            </section>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function PessoaRow({ pessoa, userId }: { pessoa: any; userId: string }) {
  const [seguindo, setSeguindo] = useState(false);
  const [busy, setBusy] = useState(false);
  async function seguir() {
    if (pessoa.id === userId) return;
    setBusy(true);
    const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: pessoa.id, status: "aceito" });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else { setSeguindo(true); toast.success(`Seguindo @${pessoa.username}`); }
    setBusy(false);
  }
  const initial = (pessoa.nome || "?")[0].toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Link to="/u/$username" params={{ username: pessoa.username }} className="shrink-0">
        {pessoa.avatar_url ? (
          <img src={pessoa.avatar_url} className="h-11 w-11 rounded-full border-2 border-primary/60 object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold">{initial}</div>
        )}
      </Link>
      <Link to="/u/$username" params={{ username: pessoa.username }} className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{pessoa.nome}</div>
        <div className="text-xs text-muted-foreground truncate">@{pessoa.username}</div>
      </Link>
      <button onClick={seguir} disabled={busy || seguindo} className={`rounded-2xl px-4 py-2 text-xs font-bold ${seguindo ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
        {seguindo ? "Seguindo" : "Seguir"}
      </button>
      <button className="text-muted-foreground"><MoreVertical size={18} /></button>
    </div>
  );
}

function EquipeRow({ equipe, userId }: { equipe: any; userId: string }) {
  const [entrando, setEntrando] = useState(false);
  const [entrou, setEntrou] = useState(false);

  async function entrar() {
    if (equipe.criador_id === userId) return;
    setEntrando(true);
    const { error } = await supabase
      .from("equipe_membros")
      .insert({ equipe_id: equipe.id, user_id: userId, papel: "membro" });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else { setEntrou(true); toast.success(`Você entrou em ${equipe.nome}!`); }
    setEntrando(false);
  }

  const initial = (equipe.nome || "?")[0].toUpperCase();
  const ehCriador = equipe.criador_id === userId;

  return (
    <Link to="/equipes/$id" params={{ id: equipe.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      {equipe.foto_url ? (
        <img src={equipe.foto_url} className="h-11 w-11 rounded-full border-2 border-primary/60 object-cover shrink-0" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold">{initial}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold truncate">{equipe.nome}</span>
          <Globe size={11} className="shrink-0 text-muted-foreground" />
        </div>
        <div className="text-xs text-muted-foreground truncate">
          por @{equipe.profiles?.username ?? "—"}
        </div>
        {equipe.descricao && (
          <div className="mt-0.5 text-xs text-muted-foreground truncate">{equipe.descricao}</div>
        )}
      </div>
      {!ehCriador && (
        <button
          onClick={(e) => { e.preventDefault(); entrar(); }}
          disabled={entrando || entrou}
          className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-bold ${
            entrou ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground"
          }`}
        >
          <Users size={12} className="inline mr-1" />
          {entrou ? "Membro" : entrando ? "…" : "Entrar"}
        </button>
      )}
    </Link>
  );
}
