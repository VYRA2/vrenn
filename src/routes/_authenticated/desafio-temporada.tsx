import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { ArrowLeft, Info, Users, ClipboardCheck, Shield, Flag, Trophy, ArrowRight, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/desafio-temporada")({
  component: DesafioTemporada,
});

const STATS = [
  { icon: Users, v: "1.247", l: "participantes" },
  { icon: ClipboardCheck, v: "2.836", l: "compromissos" },
  { icon: Shield, v: "18.642", l: "provas verificadas" },
  { icon: Trophy, v: "245", l: "desafios criados" },
];

const STEPS = [
  { n: 1, icon: Flag, title: "Participe", desc: "Entre no desafio e crie compromissos que realmente importam." },
  { n: 2, icon: Shield, title: "Cumpra e prove", desc: "Registre suas ações e envie provas. Consistência é o que conta." },
  { n: 3, icon: Trophy, title: "Seja recompensado", desc: "Ao final da temporada, o valor do fundo será distribuído entre os melhores." },
];

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DesafioTemporada() {
  const navigate = useNavigate();

  const { data: fundo } = useQuery({
    queryKey: ["fundo_temporada"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fundo_temporada")
        .select("valor_acumulado, meta_valor")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const valorAcumulado = fundo?.valor_acumulado ?? 0;
  const metaValor = fundo?.meta_valor ?? 300000;
  const progresso = metaValor > 0 ? Math.min(100, Math.round((valorAcumulado / metaValor) * 100)) : 0;

  return (
    <main className="min-h-screen bg-background text-foreground pb-32">
      <header className="relative mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2">
        <button onClick={() => navigate({ to: "/descobrir" })} className="flex h-9 w-9 items-center justify-center rounded-full text-primary-light">
          <ArrowLeft size={20} />
        </button>
        <VyraLogo size={32} />
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary-light"><Info size={16} /></button>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* Hero */}
        <section className="relative overflow-hidden pt-4">
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-light">DESAFIO DA</p>
            <h1 className="mt-1 text-5xl font-black leading-none">MASTER</h1>
            <p className="mt-1 text-xl font-bold text-primary-light">DA TEMPORADA</p>
            <p className="mt-4 text-sm text-muted-foreground leading-snug">
              A temporada tá acabando.<br />O compromisso continua.
            </p>
          </div>
          <div className="pointer-events-none absolute -top-4 right-0 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute top-6 right-4 flex h-40 w-40 items-center justify-center rounded-full border border-primary/30 bg-primary/10 backdrop-blur">
            <Shield size={80} className="text-primary-light drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]" fill="currentColor" fillOpacity={0.2} />
          </div>
        </section>

        {/* Fundo acumulado */}
        <section className="mt-8 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-primary-light">Fundo acumulado</span>
            <Info size={12} className="text-muted-foreground" />
          </div>
          <div className="mt-2 text-3xl font-black">{formatBRL(valorAcumulado)}</div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>0</span><span className="font-bold text-primary-light">{progresso}%</span><span>{formatBRL(metaValor)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light" style={{ width: `${progresso}%` }} />
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Meta da temporada</p>
        </section>

        {/* Stats grid */}
        <section className="mt-4 grid grid-cols-4 gap-2">
          {STATS.map(({ icon: Icon, v, l }) => (
            <div key={l} className="rounded-2xl border border-border bg-card p-3 text-center">
              <Icon size={22} className="mx-auto text-primary-light" />
              <div className="mt-2 text-base font-bold">{v}</div>
              <div className="text-[9px] text-muted-foreground leading-tight">{l}</div>
            </div>
          ))}
        </section>

        {/* Como funciona */}
        <section className="mt-6 rounded-3xl border border-border bg-card p-5">
          <h2 className="text-base font-bold">Como funciona</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {STEPS.map(({ n, icon: Icon, title, desc }, i) => (
              <div key={n} className="relative">
                <div className="flex flex-col items-start gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</div>
                  <Icon size={26} className="text-primary-light" />
                  <div className="text-sm font-bold">{title}</div>
                  <p className="text-[10px] text-muted-foreground leading-snug">{desc}</p>
                </div>
                {i < 2 && <ChevronRight size={16} className="absolute -right-2 top-9 text-primary-light/50" />}
              </div>
            ))}
          </div>
        </section>

        {/* Premiação */}
        <section className="mt-4 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Premiação</h2>
            <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary-light">Ver detalhes <ArrowRight size={12} /></button>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 items-end">
            <Medal place="2º lugar" value="R$ 25.000,00" tone="silver" />
            <Medal place="1º lugar" value="R$ 40.000,00" tone="gold" big />
            <Medal place="3º lugar" value="R$ 15.000,00" tone="bronze" />
            <div className="col-span-2 space-y-2">
              <div className="rounded-2xl border border-border bg-background p-2.5">
                <div className="flex items-center gap-1.5"><Shield size={12} className="text-primary-light" /><span className="text-xs font-bold">Top 10</span></div>
                <div className="text-sm font-bold">R$ 8.000,00</div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-2.5">
                <div className="flex items-center gap-1.5"><Shield size={12} className="text-primary-light" /><span className="text-xs font-bold">Top 50</span></div>
                <div className="text-sm font-bold">R$ 3.000,00</div>
              </div>
            </div>
          </div>
        </section>

        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-3xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow">
          Quero participar do desafio <ArrowRight size={16} />
        </button>
        <button className="mt-3 block w-full text-center text-sm font-semibold text-primary-light">Ver regulamento</button>

        <Link to="/descobrir" className="mt-6 block text-center text-xs text-muted-foreground">← Voltar para Descobrir</Link>
      </div>

      <BottomNav />
    </main>
  );
}

function Medal({ place, value, tone, big }: { place: string; value: string; tone: "gold" | "silver" | "bronze"; big?: boolean }) {
  const colors = {
    gold: { bg: "from-yellow-500/40 to-yellow-700/10", border: "border-yellow-500/60", text: "text-yellow-400" },
    silver: { bg: "from-slate-300/30 to-slate-500/10", border: "border-slate-400/60", text: "text-slate-200" },
    bronze: { bg: "from-orange-500/30 to-orange-800/10", border: "border-orange-500/60", text: "text-orange-400" },
  }[tone];
  return (
    <div className="text-center">
      <div className={`mx-auto flex items-center justify-center rounded-full bg-gradient-to-b ${colors.bg} border-2 ${colors.border} ${big ? "h-16 w-16" : "h-12 w-12"}`}>
        <Shield size={big ? 28 : 20} className={colors.text} fill="currentColor" fillOpacity={0.3} />
      </div>
      <div className="mt-2 text-[10px] font-semibold text-muted-foreground">{place}</div>
      <div className={`text-[11px] font-bold ${colors.text}`}>{value}</div>
    </div>
  );
}
