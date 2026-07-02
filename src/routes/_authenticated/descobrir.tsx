import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import {
  Search, SlidersHorizontal, Users, CheckCircle2, Target, Shield, Bell, ArrowRight,
  Dumbbell, Leaf, BookOpen, Brain, Heart, MessageCircle, Bookmark, MoreVertical,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/descobrir")({
  component: DescobrirPage,
});

type Tab = "voce" | "pessoas" | "habitos" | "metas" | "provas";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "voce", label: "Para você", icon: Users },
  { id: "pessoas", label: "Pessoas", icon: Users },
  { id: "habitos", label: "Hábitos", icon: CheckCircle2 },
  { id: "metas", label: "Metas", icon: Target },
  { id: "provas", label: "Provas", icon: Shield },
];

const DESTAQUES = [
  { user: "@abrielrocha", cat: "Treino", time: "2h", frase: "Disciplina hoje, resultado amanhã.", likes: "1.2K", comments: 86, img: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=60" },
  { user: "@marianacosta", cat: "Corrida", time: "4h", frase: "A mente desiste antes do corpo.", likes: "982", comments: 64, img: "https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=600&q=60" },
  { user: "@lucasmmz", cat: "Estudos", time: "6h", frase: "Pequenas ações constroem grandes sonhos.", likes: "875", comments: 51, img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=60" },
];

const CATEGORIAS = [
  { label: "Treino", pubs: "12.4K", icon: Dumbbell, color: "#A855F7" },
  { label: "Alimentação", pubs: "8.7K", icon: Leaf, color: "#22D3A1" },
  { label: "Estudos", pubs: "9.3K", icon: BookOpen, color: "#A855F7" },
  { label: "Mentalidade", pubs: "6.2K", icon: Brain, color: "#A855F7" },
  { label: "Produtividade", pubs: "5.1K", icon: Target, color: "#A855F7" },
];

const PESSOAS = [
  { nome: "Rafael Santos", user: "@rafaelsantos", tag: "Hábito consistente", avatar: "https://i.pravatar.cc/100?img=15" },
  { nome: "Beatriz Almeida", user: "@beatrizalmeida", tag: "Meta concluída", avatar: "https://i.pravatar.cc/100?img=47" },
  { nome: "Thiago Ferreira", user: "@thiagoferreira", tag: "Compromisso cumprido", avatar: "https://i.pravatar.cc/100?img=33" },
];

function DescobrirPage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<Tab>("voce");
  const [q, setQ] = useState("");
  const [countdown, setCountdown] = useState({ d: 23, h: 14, m: 38 });

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
      // Pessoas (padrão para "voce", "pessoas", "habitos", "provas")
      const { data } = await supabase.from("profiles").select("id, nome, username, avatar_url").or(`nome.ilike.${term},username.ilike.${term}`).neq("id", user.id).limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        let { d, h, m } = c;
        m -= 1;
        if (m < 0) { m = 59; h -= 1; }
        if (h < 0) { h = 23; d -= 1; }
        if (d < 0) return c;
        return { d, h, m };
      });
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2">
        <div className="w-10" />
        <VyraLogo size={32} />
        <Link to="/notificacoes" className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/40 bg-card text-foreground">
          <Bell size={18} />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Link>
      </header>

      <div className="mx-auto max-w-md px-5">
        <h1 className="mt-2 text-3xl font-bold">Descobrir</h1>
        <p className="mt-1 text-sm text-muted-foreground">Encontre pessoas, hábitos e conteúdos que vão te inspirar.</p>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
            <Search size={18} className="text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoas, hábitos, metas, provas..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card text-primary-light"><SlidersHorizontal size={18} /></button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
          {TABS.map(({ id, label, icon: Icon }) => {
            const a = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-1.5 rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${a ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>

        {buscando ? (
          <section className="mt-5">
            <h3 className="mb-3 text-sm font-bold">Resultados para "{q.trim()}"</h3>
            {buscandoAgora && <p className="text-xs text-muted-foreground">Buscando…</p>}
            <div className="space-y-2">
              {!buscandoAgora && (resultados ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum resultado encontrado.</p>
              )}
              {tab === "metas"
                ? (resultados ?? []).map((m: any) => (
                    <Link key={m.id} to="/meta/$id" params={{ id: m.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{m.titulo}</div>
                        <div className="text-xs text-muted-foreground">@{m.profiles?.username ?? "—"} · {m.categoria}</div>
                      </div>
                      <span className="text-xs font-bold text-primary-light">{m.progresso}%</span>
                    </Link>
                  ))
                : (resultados ?? []).map((p: any) => <PessoaRow key={p.id} pessoa={p} userId={user.id} />)}
            </div>
          </section>
        ) : (
        <>
        {/* Banner Desafio */}
        <Link to="/desafio-temporada" className="mt-5 block overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-[#1a0f2e] via-[#2a0f3e] to-[#0F0F17] p-5 shadow-glow">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary-light">Desafio Final da Temporada</p>
              <h2 className="mt-2 text-3xl font-black leading-none">DESAFIO DA</h2>
              <h2 className="text-3xl font-black leading-none bg-gradient-to-r from-primary-light to-primary bg-clip-text text-transparent">MASTER</h2>
              <p className="mt-3 text-xs text-muted-foreground">O maior desafio individual do ano. Mostre sua disciplina.</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-primary bg-primary/20 px-4 py-2 text-xs font-bold text-primary-light">
                Ver valores acumulados <ArrowRight size={14} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full border border-primary bg-primary/15 px-2.5 py-1 text-[10px] font-bold text-primary-light">Termina em</span>
              <div className="flex gap-2 text-center">
                <TimeBox v={countdown.d} l="DIAS" />
                <TimeBox v={countdown.h} l="HORAS" />
                <TimeBox v={countdown.m} l="MIN" />
              </div>
            </div>
          </div>
        </Link>

        {/* Destaques */}
        <div className="mt-6 mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">Destaques da comunidade</h3>
          <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary-light">Ver todos <ArrowRight size={12} /></button>
        </div>
        <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-2">
          {DESTAQUES.map((d) => (
            <div key={d.user} className="w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative h-40 w-full">
                <img src={d.img} className="h-full w-full object-cover" />
                <div className="absolute inset-x-2 top-2 flex items-center gap-2 rounded-full bg-black/60 px-2 py-1 backdrop-blur">
                  <div className="h-5 w-5 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold">{d.user}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{d.time}</span>
                </div>
                <span className="absolute top-10 left-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold">{d.cat}</span>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold leading-snug">{d.frase}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-primary-light"><Heart size={13} /> {d.likes}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {d.comments}</span>
                  <Bookmark size={13} className="ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Categorias */}
        <h3 className="mt-6 mb-3 text-base font-bold">Explorar por categorias</h3>
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-2">
          {CATEGORIAS.map(({ label, pubs, icon: Icon, color }) => (
            <div key={label} className="w-28 shrink-0 rounded-2xl border border-border bg-card p-3 text-center">
              <Icon size={26} className="mx-auto mb-1.5" style={{ color }} />
              <div className="text-xs font-bold">{label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{pubs} publicações</div>
            </div>
          ))}
        </div>

        {/* Pessoas para seguir */}
        <div className="mt-6 mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">Pessoas para seguir</h3>
          <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary-light">Ver todas <ArrowRight size={12} /></button>
        </div>
        <div className="space-y-3">
          {PESSOAS.map((p) => (
            <div key={p.user} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <img src={p.avatar} className="h-12 w-12 rounded-full border-2 border-primary/60 object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold truncate">{p.nome}</span>
                  <CheckCircle2 size={12} className="text-primary-light" />
                </div>
                <div className="text-xs text-muted-foreground">{p.user}</div>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-accent/40 px-2 py-0.5 text-[10px] text-accent">
                  <CheckCircle2 size={9} /> {p.tag}
                </span>
              </div>
              <button className="rounded-2xl border border-primary px-4 py-2 text-xs font-bold text-primary-light">Seguir</button>
            </div>
          ))}
        </div>
        </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function TimeBox({ v, l }: { v: number; l: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-black leading-none">{String(v).padStart(2, "0")}</div>
      <div className="mt-0.5 text-[9px] font-semibold text-muted-foreground">{l}</div>
    </div>
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
  const initial = (pessoa.nome || "?")[0]?.toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      {pessoa.avatar_url ? (
        <img src={pessoa.avatar_url} className="h-11 w-11 rounded-full border-2 border-primary/60 object-cover" />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold">{initial}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">{pessoa.nome}</div>
        <div className="text-xs text-muted-foreground truncate">@{pessoa.username}</div>
      </div>
      <button onClick={seguir} disabled={busy || seguindo} className={`rounded-2xl px-4 py-2 text-xs font-bold ${seguindo ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
        {seguindo ? "Seguindo" : "Seguir"}
      </button>
      <button className="text-muted-foreground"><MoreVertical size={18} /></button>
    </div>
  );
}
