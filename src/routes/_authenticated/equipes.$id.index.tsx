import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import {
  ArrowLeft, MoreHorizontal, Users, Calendar, BadgeCheck, Trophy, Coins, Target, TrendingUp,
  Dumbbell, BookOpen, Zap, Brain, ChevronRight, Shield, UserPlus, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipes/$id/")({
  component: EquipeProfile,
});

type Tab = "resumo" | "membros" | "desafios" | "feed" | "estatisticas";

const TABS: { id: Tab; label: string }[] = [
  { id: "resumo", label: "Visão geral" },
  { id: "membros", label: "Membros" },
  { id: "desafios", label: "Feed da equipe" },
  { id: "feed", label: "Estatísticas" },
  { id: "estatisticas", label: "Configurações" },
];

const DESAFIOS = [
  { titulo: "Desafio 30 Dias – Treino Consistente", sub: "Encerrado em 10/06/2024 · 18 participantes", valor: "R$ 4.250,00", status: "Conquistado", icon: Dumbbell, ok: true },
  { titulo: "Desafio Leitura Diária", sub: "Encerrado em 28/05/2024 · 16 participantes", valor: "R$ 2.880,00", status: "Conquistado", icon: BookOpen, ok: true },
  { titulo: "Desafio Corrida – 100km", sub: "Encerrado em 15/05/2024 · 21 participantes", valor: "R$ 6.300,00", status: "Conquistado", icon: Zap, ok: true },
  { titulo: "Desafio Foco Total", sub: "Em andamento · Termina em 22/06/2024", valor: "R$ 3.750,00", status: "Em andamento", icon: Brain, ok: false },
];

const MEMBROS = [
  { nome: "Lucas Menezes", pts: "1.245", tag: "Mais ativo", avatar: "https://i.pravatar.cc/100?img=12" },
  { nome: "Mariana Costa", pts: "1.120", tag: "Mais hábitos", avatar: "https://i.pravatar.cc/100?img=45" },
  { nome: "Gabriel Rocha", pts: "980", tag: "Mais provas", avatar: "https://i.pravatar.cc/100?img=33" },
  { nome: "Juliana Lima", pts: "875", tag: "Mais evolução", avatar: "https://i.pravatar.cc/100?img=48" },
];

function EquipeProfile() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("resumo");

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2">
        <button onClick={() => navigate({ to: "/equipes" })} className="flex h-9 w-9 items-center justify-center rounded-full text-primary-light">
          <ArrowLeft size={20} />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary-light"><MoreHorizontal size={16} /></button>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* Hero */}
        <section className="flex items-start gap-4">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/60 bg-gradient-to-br from-primary/30 to-background shadow-glow">
            <Shield size={64} className="text-primary-light drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]" fill="currentColor" fillOpacity={0.25} />
          </div>
          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black">ALPHA</h1>
              <BadgeCheck size={20} className="text-primary-light" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Disciplina hoje, vitória sempre.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users size={13} className="text-primary-light" /> 24 membros</span>
              <span className="inline-flex items-center gap-1"><Calendar size={13} className="text-primary-light" /> Desde 12/04/2024</span>
              <span className="rounded-full border border-primary bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary-light">MASTER</span>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="mt-6 flex gap-4 overflow-x-auto border-b border-border -mx-5 px-5 pb-0.5">
          {TABS.map((t) => {
            const a = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`relative shrink-0 pb-2 text-sm font-semibold ${a ? "text-primary-light" : "text-muted-foreground"}`}>
                {t.label}
                {a && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {/* Card stats */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Desafios da equipe</h3>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <QuickStat icon={<Trophy size={20} />} value="18" label="Desafios realizados" />
            <QuickStat icon={<Coins size={20} />} value="R$ 64.750,00" label="Total em jogo" small />
            <QuickStat icon={<Target size={20} />} value="R$ 51.230,00" label="Total conquistado" small />
            <QuickStat icon={<TrendingUp size={20} />} value="78%" label="Taxa de sucesso" />
          </div>

          {/* Chart mock */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold">Evolução dos valores</span>
              <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">Últimos 6 meses ▾</span>
            </div>
            <ChartMock />
          </div>
        </section>

        {/* Últimos desafios */}
        <div className="mt-6 mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">Últimos desafios</h3>
          <Link to="/desafio-temporada" className="text-xs font-semibold text-primary-light">Ver todos</Link>
        </div>
        <div className="space-y-2">
          {DESAFIOS.map((d) => (
            <div key={d.titulo} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary-light">
                <d.icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{d.titulo}</div>
                <div className="text-[11px] text-muted-foreground truncate">{d.sub}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{d.valor}</div>
                <div className={`inline-flex items-center gap-1 text-[10px] font-semibold ${d.ok ? "text-accent" : "text-primary-light"}`}>
                  {d.status} {d.ok ? <BadgeCheck size={11} /> : <TrendingUp size={11} />}
                </div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </div>
          ))}
        </div>

        {/* Banner */}
        <Link to="/desafio-temporada" className="mt-6 block overflow-hidden rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/5 to-background p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/25 text-primary-light">
              <Trophy size={26} />
            </div>
            <div>
              <h4 className="text-base font-bold">Juntos somos mais fortes</h4>
              <p className="mt-1 text-xs text-muted-foreground">Cada desafio é um passo rumo à nossa melhor versão. Continuem firmes.</p>
            </div>
          </div>
        </Link>

        {/* Membros em destaque */}
        <div className="mt-6 mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">Membros em destaque</h3>
          <button className="text-xs font-semibold text-primary-light">Ver todos</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MEMBROS.map((m) => (
            <div key={m.nome} className="rounded-2xl border border-border bg-card p-2 text-center">
              <div className="relative mx-auto h-14 w-14">
                <img src={m.avatar} className="h-full w-full rounded-full border-2 border-primary/60 object-cover" />
                <BadgeCheck size={13} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-primary text-primary-foreground" />
              </div>
              <div className="mt-2 text-[11px] font-bold truncate">{m.nome}</div>
              <div className="text-[10px] text-muted-foreground">{m.pts} pts</div>
              <div className="mt-1 rounded-full border border-accent/40 px-1.5 py-0.5 text-[9px] text-accent truncate">{m.tag}</div>
            </div>
          ))}
        </div>

        {/* Sobre */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Sobre a equipe</h3>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            A equipe ALPHA reúne pessoas comprometidas em transformar disciplina em resultado. Aqui, cada desafio é uma prova de consistência coletiva.
          </p>
        </section>

        {/* Ações */}
        <div className="mt-5 flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary py-3 text-sm font-bold text-primary-light">
            <UserPlus size={16} /> Convidar membros
          </button>
          <button onClick={() => navigate({ to: "/equipes/$id/desafio/novo", params: { id: "current" } })} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow">
            <Sparkles size={16} /> Criar desafio
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function QuickStat({ icon, value, label, small }: { icon: React.ReactNode; value: string; label: string; small?: boolean }) {
  return (
    <div>
      <div className="mx-auto flex h-8 items-center justify-center text-primary-light">{icon}</div>
      <div className={`mt-1 font-bold ${small ? "text-[13px]" : "text-lg"}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function ChartMock() {
  const points = [30, 45, 55, 60, 85, 70];
  const max = 100;
  const w = 300, h = 90;
  const step = w / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`).join(" ");
  return (
    <div className="relative mt-2">
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full">
        <path d={path} fill="none" stroke="#A855F7" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={i * step} cy={h - (p / max) * h} r="3.5" fill="#A855F7" />
        ))}
        {points.map((_, i) => {
          const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
          return <text key={i} x={i * step} y={h + 15} fontSize="9" fill="#94A3B8" textAnchor="middle">{labels[i]}</text>;
        })}
      </svg>
      <div className="absolute -top-1 right-2 rounded-md bg-primary/20 border border-primary/40 px-2 py-0.5 text-[10px] font-bold text-primary-light">R$ 51.230</div>
    </div>
  );
}
