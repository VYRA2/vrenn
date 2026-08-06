import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import {
  Search, SlidersHorizontal, Users, CheckCircle2, Shield, Bell, ArrowRight, Wallet,
  MoreVertical, Play, Images,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/descobrir")({
  component: DescobrirPage,
});

type Tab = "voce" | "em-alta" | "pessoas" | "comunidade" | "habitos" | "metas" | "provas";

const TABS: { id: Tab; label: string }[] = [
  { id: "voce", label: "Para você" },
  { id: "em-alta", label: "Em alta" },
  { id: "pessoas", label: "Pessoas" },
  { id: "comunidade", label: "Comunidade" },
];

const EM_ALTA_FILTROS = ["Tudo", "Fitness", "Corrida", "Disciplina", "Alimentação"];

const FILTER_OPTIONS: { id: Tab; label: string; icon: any }[] = [
  { id: "pessoas", label: "Pessoas", icon: Users },
  { id: "habitos", label: "Hábitos", icon: CheckCircle2 },
];

const CATEGORIAS = [
  { id: "fitness", label: "Corpo", emoji: "🏃", color: "#A855F7" },
  { id: "estudos", label: "Estudos", emoji: "📚", color: "#22D3A1" },
  { id: "financas", label: "Finanças", emoji: "💰", color: "#A855F7" },
  { id: "habitos", label: "Hábitos", emoji: "🎯", color: "#A855F7" },
  { id: "saude", label: "Mente", emoji: "🧠", color: "#22D3A1" },
  { id: "foco", label: "Foco", emoji: "⚡", color: "#A855F7" },
  { id: "esportes", label: "Esportes", emoji: "🏆", color: "#A855F7" },
];

function calcularCountdown(dataFim?: string | null) {
  if (!dataFim) return null;
  const fim = new Date(`${dataFim}T23:59:59`);
  const diferenca = fim.getTime() - Date.now();
  if (diferenca <= 0) return { dias: 0, horas: 0, minutos: 0, encerrado: true };
  return {
    dias: Math.floor(diferenca / 86_400_000),
    horas: Math.floor((diferenca % 86_400_000) / 3_600_000),
    minutos: Math.floor((diferenca % 3_600_000) / 60_000),
    encerrado: false,
  };
}

function DescobrirPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("voce");
  const [q, setQ] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [emAltaFiltro, setEmAltaFiltro] = useState("Tudo");
  const [, setClockTick] = useState(0);

  const buscando = q.trim().length >= 2;

  const { data: resultados, isFetching: buscandoAgora } = useQuery({
    queryKey: ["descobrir-busca", tab, q],
    enabled: buscando,
    queryFn: async () => {
      const term = `%${q.trim()}%`;
      if (tab === "metas") {
        const { data } = await supabase.from("metas").select("id, titulo, categoria, progresso, user_id, profiles:user_id(nome, username, avatar_url)").ilike("titulo", term).limit(20);
        return data ?? [];
      }
      const { data } = await supabase.from("profiles").select("id, nome, username, avatar_url, perfil_publico").or(`nome.ilike.${term},username.ilike.${term}`).neq("id", user.id).limit(20);
      return data ?? [];
    },
  });

  const { data: sugestoes } = useQuery({
    queryKey: ["descobrir-sugestoes", user.id],
    queryFn: async () => {
      const { data: fol } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      const excluir = [user.id, ...((fol ?? []).map((f: any) => f.following_id))];
      const { data } = await supabase.from("profiles").select("id, nome, username, avatar_url").not("id", "in", `(${excluir.join(",")})`).limit(5);
      return data ?? [];
    },
  });

  const { data: destaques } = useQuery({
    queryKey: ["descobrir-destaques"],
    queryFn: async () => {
      const [posts, desafios, metasC, duelos] = await Promise.all([
        supabase.from("posts").select("user_id").not("auto_gerado", "eq", true),
        supabase.from("desafio_equipe_participantes").select("user_id"),
        supabase.from("metas").select("user_id").eq("status", "concluida"),
        supabase.from("duelos").select("winner_id").not("winner_id", "is", null),
      ]);
      const score = new Map<string, number>();
      (posts.data ?? []).forEach((r: any) => score.set(r.user_id, (score.get(r.user_id) ?? 0) + 3));
      (desafios.data ?? []).forEach((r: any) => score.set(r.user_id, (score.get(r.user_id) ?? 0) + 4));
      (metasC.data ?? []).forEach((r: any) => score.set(r.user_id, (score.get(r.user_id) ?? 0) + 2));
      (duelos.data ?? []).forEach((r: any) => r.winner_id && score.set(r.winner_id, (score.get(r.winner_id) ?? 0) + 5));
      const top = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (!top.length) return [];
      const ids = top.map(([id]) => id);
      const [{ data: profs }, { data: lastPosts }] = await Promise.all([
        supabase.from("profiles").select("id, nome, username, avatar_url, perfil_publico").in("id", ids).eq("perfil_publico", true),
        supabase.from("posts").select("user_id, media_url, tipo, created_at, profiles:user_id(perfil_publico)").in("user_id", ids).not("media_url", "is", null).eq("tipo", "video").order("created_at", { ascending: false }),
      ]);
      const lastByUser = new Map<string, any>();
      (lastPosts ?? []).forEach((p: any) => { if (!lastByUser.has(p.user_id) && p.media_url) lastByUser.set(p.user_id, { url: p.media_url, tipo: p.tipo }); });
      return top.map(([id, pts]) => {
        const prof = (profs ?? []).find((p: any) => p.id === id);
        const media = lastByUser.get(id);
        return { id, pts, nome: prof?.nome ?? "—", username: prof?.username ?? "—", avatar_url: prof?.avatar_url, media_url: media?.url, media_tipo: media?.tipo };
      });
    },
  });

  const { data: temporadaAtiva } = useQuery({
    queryKey: ["temporada-ativa-descobrir"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("temporadas")
        .select("id, numero, titulo, data_fim, status")
        .in("status", ["inscricoes_abertas", "ativa"])
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: fundoTemporada } = useQuery({
    queryKey: ["fundo-temporada-descobrir"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fundo_temporada")
        .select("id, valor_acumulado, data_inicio, updated_at")
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: comunidades } = useQuery({
    queryKey: ["descobrir-comunidades"],
    queryFn: async () => {
      const { data: eqs } = await supabase.from("equipes").select("id, nome, avatar_url, categoria");
      const list = eqs ?? [];
      if (!list.length) return [];
      const ids = list.map((e: any) => e.id);
      const [{ data: mem }, { data: des }] = await Promise.all([
        supabase.from("equipe_membros").select("equipe_id").in("equipe_id", ids),
        supabase.from("desafios_equipe").select("equipe_id, status").in("equipe_id", ids).neq("status", "finalizado"),
      ]);
      const mcount = new Map<string, number>();
      const dcount = new Map<string, number>();
      (mem ?? []).forEach((m: any) => mcount.set(m.equipe_id, (mcount.get(m.equipe_id) ?? 0) + 1));
      (des ?? []).forEach((d: any) => dcount.set(d.equipe_id, (dcount.get(d.equipe_id) ?? 0) + 1));
      return list.map((e: any) => ({ ...e, membros: mcount.get(e.id) ?? 0, desafios: dcount.get(e.id) ?? 0, score: (mcount.get(e.id) ?? 0) * 2 + (dcount.get(e.id) ?? 0) * 5 })).sort((a, b) => b.score - a.score).slice(0, 8);
    },
  });

  const { data: todosPerfis } = useQuery({
    queryKey: ["descobrir-todos-perfis", q],
    enabled: tab === "comunidade",
    queryFn: async () => {
      let query = supabase.from("profiles").select("id, nome, username, avatar_url").neq("id", user.id).limit(100);
      const term = q.trim();
      if (term.length >= 2) query = query.or(`nome.ilike.%${term}%,username.ilike.%${term}%`);
      const { data } = await query.order("nome", { ascending: true });
      return data ?? [];
    },
  });

  const { data: emAlta } = useQuery({
    queryKey: ["descobrir-em-alta", emAltaFiltro],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("id, media_url, tipo, hashtags, likes_count, created_at, user_id, profiles:user_id(username, avatar_url, perfil_publico), metas:meta_id(categoria, subcategoria)").not("media_url", "is", null).order("likes_count", { ascending: false }).limit(60);
      const publicos = (data ?? []).filter((p: any) => p.profiles?.perfil_publico !== false);
      if (emAltaFiltro === "Tudo") return publicos.slice(0, 30);
      const alvo = emAltaFiltro.toLowerCase();
      return publicos.filter((p: any) => {
        const bag = [...(p.hashtags ?? []), p.metas?.categoria ?? "", p.metas?.subcategoria ?? ""].join(" ").toLowerCase();
        if (alvo === "fitness") return /fitness|treino|muscula|academia/.test(bag);
        if (alvo === "corrida") return /corrida|correr|run|caminhada/.test(bag);
        if (alvo === "disciplina") return /disciplina|habito|hábito|foco|rotina/.test(bag);
        return bag.includes(alvo.replace("ç", "c"));
      }).slice(0, 30);
    },
  });

  useEffect(() => {
    const interval = window.setInterval(() => setClockTick((value) => value + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase.channel("fundo-temporada-descobrir-realtime").on("postgres_changes", { event: "*", schema: "public", table: "fundo_temporada" }, () => {
      queryClient.invalidateQueries({ queryKey: ["fundo-temporada-descobrir"] });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const masterCountdown = calcularCountdown(temporadaAtiva?.data_fim);
  const fundoAtual = Number(fundoTemporada?.valor_acumulado ?? 0);

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto grid max-w-md grid-cols-3 items-center px-5 pt-4 pb-2">
          <div className="justify-self-start"><VyraLogo size={28} showWordmark={false} /></div>
          <div className="justify-self-center text-base font-bold tracking-widest text-foreground">VRENN</div>
          <div className="justify-self-end flex items-center gap-1">
            <Link to="/notificacoes" aria-label="Notificações" className="relative rounded-full p-2 text-foreground/90"><Bell size={22} /><span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" /></Link>
            <Link to="/wallet" aria-label="Carteira" className="rounded-full p-2 text-primary-light"><Wallet size={22} /></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5">
        <h1 className="sr-only">Descobrir</h1>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3"><Search size={18} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoas, hábitos, metas, provas..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></div>
          <div className="relative">
            <button onClick={() => setShowFilter(v => !v)} className={`flex h-12 w-12 items-center justify-center rounded-2xl border bg-card ${showFilter ? "border-primary text-primary-light" : "border-border text-primary-light"}`}><SlidersHorizontal size={18} /></button>
            {showFilter && <div className="absolute right-0 top-14 z-20 w-44 rounded-2xl border border-border bg-card p-2 shadow-glow"><div className="mb-1 px-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtrar por</div>{FILTER_OPTIONS.map(({ id, label, icon: Icon }) => { const a = tab === id; return <button key={id} onClick={() => { setTab(id); setShowFilter(false); }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${a ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}><Icon size={14} /> {label}</button>; })}</div>}
          </div>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filtros do Descobrir">
          {TABS.map(({ id, label }) => <button key={id} onClick={() => setTab(id)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${tab === id ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"}`}>{label}</button>)}
          {tab === "habitos" && <button onClick={() => setTab("voce")} className="shrink-0 rounded-full border border-primary bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary-light">Hábitos ✕</button>}
        </nav>

        {buscando ? (
          <section className="mt-5"><h3 className="mb-3 text-sm font-bold">Resultados para "{q.trim()}"</h3>{buscandoAgora && <p className="text-xs text-muted-foreground">Buscando…</p>}<div className="space-y-2">{!buscandoAgora && (resultados ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum resultado encontrado.</p>}{tab === "metas" ? (resultados ?? []).map((m: any) => <Link key={m.id} to="/meta/$id" params={{ id: m.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{m.titulo}</div><div className="text-xs text-muted-foreground">@{m.profiles?.username ?? "—"} · {m.categoria}</div></div><span className="text-xs font-bold text-primary-light">{m.progresso}%</span></Link>) : (resultados ?? []).map((p: any) => <PessoaRow key={p.id} pessoa={p} userId={user.id} />)}</div></section>
        ) : tab === "comunidade" ? (
          <section className="mt-5"><h3 className="mb-3 text-sm font-bold">Todos os perfis do VRENN</h3><div className="space-y-2">{(todosPerfis ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum perfil encontrado.</p>}{(todosPerfis ?? []).map((p: any) => <PessoaRow key={p.id} pessoa={p} userId={user.id} />)}</div></section>
        ) : tab === "pessoas" ? (
          <section className="mt-5"><h3 className="mb-3 text-sm font-bold">Pessoas para seguir</h3><div className="space-y-2">{(sugestoes ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">Nenhuma sugestão no momento</div> : (sugestoes ?? []).map((p: any) => <PessoaRow key={p.id} pessoa={p} userId={user.id} />)}</div></section>
        ) : tab === "em-alta" ? (
          <section className="mt-5"><div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{EM_ALTA_FILTROS.map((f) => { const a = emAltaFiltro === f; return <button key={f} onClick={() => setEmAltaFiltro(f)} className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-semibold transition-colors ${a ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground"}`}>{f}</button>; })}</div><EmAltaGrid posts={emAlta ?? []} /></section>
        ) : (
          <>
            <Link to="/desafio-temporada" className="mt-5 block overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-[#1a0f2e] via-[#2a0f3e] to-[#0F0F17] p-5 shadow-glow">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-light">Desafio Final da Temporada</p>
                <h2 className="mt-2 text-2xl font-black leading-none">DESAFIO DA</h2>
                <h2 className="text-2xl font-black leading-none bg-gradient-to-r from-primary-light to-primary bg-clip-text text-transparent">MASTER</h2>
                {temporadaAtiva?.titulo && <p className="mt-1 text-xs text-primary-light/70 font-semibold">Temporada {temporadaAtiva.numero} — {temporadaAtiva.titulo}</p>}
                <p className="mt-2 text-xs text-muted-foreground">O maior desafio individual do ano. Mostre sua disciplina.</p>
                <div className="mt-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-yellow-400/70">Prêmio Master atual</div>
                  <div className="mt-1 text-2xl font-black text-yellow-400">{fundoAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-yellow-100/55">O prêmio cresce conforme novos valores são destinados ao fundo da temporada.</p>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-primary bg-primary/20 px-4 py-2 text-xs font-bold text-primary-light">{temporadaAtiva ? "Participar agora" : "Ver regulamento"} <ArrowRight size={14} /></div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-primary/20 pt-3">
                  {temporadaAtiva && masterCountdown ? (
                    masterCountdown.encerrado ? <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Temporada encerrada</span> : <><span className="rounded-full border border-primary bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary-light">Termina em</span><div className="flex gap-4 text-center"><TimeBox v={masterCountdown.dias} l="DIAS" /><TimeBox v={masterCountdown.horas} l="HORAS" /><TimeBox v={masterCountdown.minutos} l="MIN" /></div></>
                  ) : <p className="text-xs font-semibold text-muted-foreground">A próxima temporada está sendo preparada.</p>}
                </div>
              </div>
            </Link>

            <div className="mt-6 mb-3 flex items-center justify-between"><h3 className="text-base font-bold">Em alta</h3><button onClick={() => setTab("em-alta")} className="text-xs font-semibold text-primary-light">Ver todos</button></div>
            <EmAltaGrid posts={(emAlta ?? []).slice(0, 9)} />

            <div className="mt-6 mb-3 flex items-center justify-between"><h3 className="text-base font-bold">Destaques da comunidade</h3><button onClick={() => navigate({ to: "/feed", search: { tab: "destaques" } as any })} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-light">Ver todos <ArrowRight size={12} /></button></div>
            <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2">{(destaques ?? []).length === 0 && <div className="w-full rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">Ainda sem destaques.</div>}{(destaques ?? []).map((d: any) => <Link to="/u/$username" params={{ username: d.username }} key={d.id} className="w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-card"><div className="relative h-40 w-full bg-gradient-to-br from-primary/30 to-background">{d.media_url && d.media_tipo === "video" ? <video src={d.media_url} className="h-full w-full object-cover" playsInline muted autoPlay loop /> : d.media_url ? <img src={d.media_url} className="h-full w-full object-cover" /> : null}{d.media_tipo === "video" && <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">▶ Reel</div>}<div className="absolute inset-x-2 top-2 flex items-center gap-2 rounded-full bg-black/60 px-2 py-1 backdrop-blur">{d.avatar_url ? <img src={d.avatar_url} className="h-5 w-5 rounded-full object-cover" /> : <div className="h-5 w-5 rounded-full bg-primary" />}<span className="text-[11px] font-semibold truncate">@{d.username}</span><span className="ml-auto text-[10px] font-bold text-primary-light">{d.pts} pts</span></div></div><div className="p-3"><p className="text-sm font-semibold leading-snug truncate">{d.nome}</p><div className="mt-1 text-xs text-muted-foreground">@{d.username}</div></div></Link>)}</div>

            <div className="mt-6 mb-3 flex items-center justify-between"><h3 className="text-base font-bold">Equipes públicas em alta</h3><Link to="/equipes" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-light">Ver todas <ArrowRight size={12} /></Link></div>
            <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2">{(comunidades ?? []).length === 0 && <div className="w-full rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">Sem comunidades ainda.</div>}{(comunidades ?? []).map((c: any) => <Link to="/equipes/$id" params={{ id: c.id }} key={c.id} className="w-56 shrink-0 rounded-2xl border border-border bg-card p-3"><div className="flex items-center gap-3">{c.avatar_url ? <img src={c.avatar_url} className="h-12 w-12 rounded-2xl object-cover border border-primary/40" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary-light"><Shield size={22} /></div>}<div className="min-w-0 flex-1"><div className="text-sm font-bold truncate">{c.nome}</div>{c.categoria && <span className="mt-0.5 inline-block rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-bold capitalize text-primary-light">{c.categoria}</span>}</div></div><div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Users size={12} /> {c.membros} membros</span><span>{c.desafios} desafios</span></div></Link>)}</div>

            <Link to="/comunidades" className="mt-6 block rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 to-card p-5"><div className="text-xs font-bold uppercase tracking-wider text-primary-light">Comunidades VRENN</div><h3 className="mt-2 text-xl font-black">Encontre sua tribo</h3><p className="mt-1 text-xs text-muted-foreground">Entre em ecossistemas públicos por interesse, participe do desafio mensal e avance no ranking.</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary-light">Explorar comunidades <ArrowRight size={12}/></span></Link>

            <h3 className="mt-6 mb-3 text-base font-bold">Explorar por categorias</h3>
            <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-2">{CATEGORIAS.map(({ id, label, emoji, color }) => <button key={id} onClick={() => navigate({ to: "/busca", search: { q: id } as any })} className="w-28 shrink-0 rounded-2xl border border-border bg-card p-3 text-center hover:border-primary/50 transition-colors"><div className="mb-1.5 text-3xl leading-none" style={{ color }}>{emoji}</div><div className="text-xs font-bold">{label}</div></button>)}</div>

            <div className="mt-6 mb-3 flex items-center justify-between"><h3 className="text-base font-bold">Pessoas para seguir</h3><button onClick={() => navigate({ to: "/busca" })} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-light">Ver todas <ArrowRight size={12} /></button></div>
            <div className="space-y-3">{(sugestoes ?? []).length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">Nenhuma sugestão no momento</div> : (sugestoes ?? []).map((p: any) => <PessoaRow key={p.id} pessoa={p} userId={user.id} />)}</div>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function EmAltaGrid({ posts }: { posts: any[] }) {
  return <div className="grid grid-cols-3 gap-1">{posts.length === 0 && <div className="col-span-3 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">Nada em alta agora.</div>}{posts.map((p: any) => <Link key={p.id} to="/post/$id" params={{ id: p.id }} className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-card">{p.tipo === "video" ? <video src={p.media_url} className="h-full w-full object-cover" playsInline muted loop /> : <img src={p.media_url} className="h-full w-full object-cover" alt="" />}<span className="absolute right-1.5 top-1.5 text-white/90">{p.tipo === "video" ? <Play size={14} className="fill-white/90" /> : <Images size={14} />}</span><span className="absolute inset-x-1 bottom-1 flex items-center gap-1.5 rounded-full bg-black/60 px-1.5 py-1 backdrop-blur">{p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="h-4 w-4 rounded-full object-cover" alt="" /> : <span className="h-4 w-4 rounded-full bg-primary" />}<span className="truncate text-[9px] font-semibold text-white">{p.profiles?.username ?? "—"}</span></span></Link>)}</div>;
}

function TimeBox({ v, l }: { v: number; l: string }) {
  return <div className="text-center"><div className="text-lg font-black leading-none">{String(v).padStart(2, "0")}</div><div className="mt-0.5 text-[9px] font-semibold text-muted-foreground">{l}</div></div>;
}

function PessoaRow({ pessoa, userId }: { pessoa: any; userId: string }) {
  const [seguindo, setSeguindo] = useState(false);
  const [busy, setBusy] = useState(false);
  async function seguir(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pessoa.id === userId) return;
    setBusy(true);
    const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: pessoa.id, status: "aceito" });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else { setSeguindo(true); toast.success(`Seguindo @${pessoa.username}`); }
    setBusy(false);
  }
  const initial = (pessoa.nome || "?")[0]?.toUpperCase();
  return <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><Link to="/u/$username" params={{ username: pessoa.username }} className="shrink-0">{pessoa.avatar_url ? <img src={pessoa.avatar_url} className="h-11 w-11 rounded-full border-2 border-primary/60 object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold">{initial}</div>}</Link><Link to="/u/$username" params={{ username: pessoa.username }} className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{pessoa.nome}</div><div className="text-xs text-muted-foreground truncate">@{pessoa.username}</div></Link><button onClick={seguir} disabled={busy || seguindo} className={`rounded-2xl px-4 py-2 text-xs font-bold ${seguindo ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground"}`}>{seguindo ? "Seguindo" : "Seguir"}</button><button className="text-muted-foreground"><MoreVertical size={18} /></button></div>;
}
