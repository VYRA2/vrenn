import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { ArrowLeft, Info, Users, ClipboardCheck, Shield, Flag, Trophy, ArrowRight, ChevronRight, Pencil, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ADMIN_ID = "52fd9ebb-5d88-4b33-acc3-97b70c62a426";

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
  const { user } = Route.useRouteContext();
  const isAdmin = user.id === ADMIN_ID;

  const { data: fundo, refetch } = useQuery({
    queryKey: ["fundo_temporada"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fundo_temporada")
        .select("id, valor_acumulado, meta_valor")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const valorAcumulado = fundo?.valor_acumulado ?? 0;
  const metaValor = fundo?.meta_valor ?? 300000;
  const progresso = metaValor > 0 ? Math.min(100, Math.round((valorAcumulado / metaValor) * 100)) : 0;

  const [premios, setPremios] = useState({ p1: 40000, p2: 25000, p3: 15000, top10: 8000, top50: 3000 });
  const [showRegulamento, setShowRegulamento] = useState(false);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showParticipar, setShowParticipar] = useState(false);

  return (
    <main className="min-h-screen bg-background text-foreground pb-32">
      <header className="relative mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2">
        <button onClick={() => navigate({ to: "/descobrir" })} className="flex h-9 w-9 items-center justify-center rounded-full text-primary-light">
          <ArrowLeft size={20} />
        </button>
        <VyraLogo size={32} />
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button onClick={() => setShowEdit(true)} aria-label="Editar" className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary-light">
              <Pencil size={14} />
            </button>
          )}
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary-light"><Info size={16} /></button>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5">
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

        <section className="mt-4 grid grid-cols-4 gap-2">
          {STATS.map(({ icon: Icon, v, l }) => (
            <div key={l} className="rounded-2xl border border-border bg-card p-3 text-center">
              <Icon size={22} className="mx-auto text-primary-light" />
              <div className="mt-2 text-base font-bold">{v}</div>
              <div className="text-[9px] text-muted-foreground leading-tight">{l}</div>
            </div>
          ))}
        </section>

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

        <section className="mt-4 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Premiação</h2>
            <button onClick={() => setShowDetalhes(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-light">Ver detalhes <ArrowRight size={12} /></button>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 items-end">
            <Medal place="2º lugar" value={formatBRL(premios.p2)} tone="silver" />
            <Medal place="1º lugar" value={formatBRL(premios.p1)} tone="gold" big />
            <Medal place="3º lugar" value={formatBRL(premios.p3)} tone="bronze" />
            <div className="col-span-2 space-y-2">
              <div className="rounded-2xl border border-border bg-background p-2.5">
                <div className="flex items-center gap-1.5"><Shield size={12} className="text-primary-light" /><span className="text-xs font-bold">Top 10</span></div>
                <div className="text-sm font-bold">{formatBRL(premios.top10)}</div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-2.5">
                <div className="flex items-center gap-1.5"><Shield size={12} className="text-primary-light" /><span className="text-xs font-bold">Top 50</span></div>
                <div className="text-sm font-bold">{formatBRL(premios.top50)}</div>
              </div>
            </div>
          </div>
        </section>

        <button
          onClick={() => setShowParticipar(true)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-3xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-glow"
        >
          Quero participar do desafio <ArrowRight size={16} />
        </button>
        <button onClick={() => setShowRegulamento(true)} className="mt-3 block w-full text-center text-sm font-semibold text-primary-light">Ver regulamento</button>

        <Link to="/descobrir" className="mt-6 block text-center text-xs text-muted-foreground">← Voltar para Descobrir</Link>
      </div>

      {showParticipar && (
        <ParticiparDesafioModal
          onClose={() => setShowParticipar(false)}
          userId={user.id}
          premios={premios}
          fundo={fundo}
        />
      )}

      {showRegulamento && (
        <Modal onClose={() => setShowRegulamento(false)} title="Regulamento">
          <p className="text-sm text-muted-foreground">Regulamento em breve.</p>
        </Modal>
      )}

      {showDetalhes && (
        <Modal onClose={() => setShowDetalhes(false)} title="Detalhes da premiação">
          <ul className="space-y-2 text-sm">
            <PrizeRow label="1º lugar" value={formatBRL(premios.p1)} />
            <PrizeRow label="2º lugar" value={formatBRL(premios.p2)} />
            <PrizeRow label="3º lugar" value={formatBRL(premios.p3)} />
            <PrizeRow label="Top 10" value={formatBRL(premios.top10)} />
            <PrizeRow label="Top 50" value={formatBRL(premios.top50)} />
          </ul>
        </Modal>
      )}

      {showEdit && isAdmin && (
        <AdminEditModal
          fundoId={fundo?.id}
          metaValor={metaValor}
          premios={premios}
          onClose={() => setShowEdit(false)}
          onSaved={(np) => { setPremios(np); refetch(); }}
        />
      )}

      <BottomNav />
    </main>
  );
}

function ParticiparDesafioModal({ onClose, userId, premios, fundo }: {
  onClose: () => void;
  userId: string;
  premios: any;
  fundo: any;
}) {
  const [step, setStep] = useState<"info" | "confirmar" | "sucesso">("info");
  const [loading, setLoading] = useState(false);
  const [jaParticipa, setJaParticipa] = useState(false);

  // Check if already participating
  useEffect(() => {
    supabase.from("metas").select("id").eq("user_id", userId).eq("valor_destino", "desafio_master").eq("status", "em_andamento").maybeSingle()
      .then(({ data }) => { if (data) setJaParticipa(true); });
  }, [userId]);

  async function confirmarParticipacao() {
    setLoading(true);
    try {
      // Inscrever: criar meta vinculada ao Desafio Master
      const { error } = await supabase.from("metas").insert({
        user_id: userId,
        titulo: "Meu Desafio Master",
        categoria: "habitos",
        tipo_validacao: "foto_arbitro",
        valor_destino: "desafio_master",
        status: "em_andamento",
        progresso: 0,
      } as any);
      if (error) throw error;
      setStep("sucesso");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao participar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Como funciona o Desafio Master">
      <div className="space-y-4">
        {step === "info" && (
          <>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flag size={16} className="text-primary-light" />
                <span className="text-sm font-bold">O que é</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O Desafio Master é o maior desafio de accountability do VRENN. Você publica provas diárias, acumula pontos e concorre ao fundo de premiação da temporada.
              </p>
            </div>
            <div className="space-y-2">
              {STEPS.map(({ n, icon: Icon, title, desc }) => (
                <div key={n} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">{n}</div>
                  <div>
                    <div className="text-sm font-bold">{title}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
              <div className="text-xs font-bold text-accent mb-1">🏆 Premiação</div>
              <p className="text-xs text-muted-foreground">
                Os melhores ao final da temporada dividem o fundo acumulado. 1º lugar recebe {formatBRL(premios.p1)}, 2º recebe {formatBRL(premios.p2)}, 3º recebe {formatBRL(premios.p3)}.
              </p>
            </div>
            {jaParticipa ? (
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-center">
                <div className="text-sm font-bold text-accent">✅ Você já está participando!</div>
                <p className="mt-1 text-xs text-muted-foreground">Continue publicando provas no feed para acumular pontos.</p>
              </div>
            ) : (
              <button
                onClick={() => setStep("confirmar")}
                className="w-full rounded-3xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow"
              >
                Participar do Desafio Master →
              </button>
            )}
          </>
        )}

        {step === "confirmar" && (
          <>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center space-y-2">
              <div className="text-3xl">🏆</div>
              <div className="text-base font-bold">Confirmar participação</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ao participar, você se compromete a publicar provas diárias no feed. Seu desempenho será avaliado ao final da temporada e os melhores receberão parte do fundo de <span className="font-bold text-foreground">{formatBRL(fundo?.valor_acumulado ?? 0)}</span>.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
              ⚠️ Você pode sair do desafio a qualquer momento sem penalidade financeira, porém perderá os pontos acumulados.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("info")}
                className="flex-1 rounded-3xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground"
              >
                Voltar
              </button>
              <button
                onClick={confirmarParticipacao}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                Confirmar
              </button>
            </div>
          </>
        )}

        {step === "sucesso" && (
          <div className="py-4 text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-5xl">
              🎉
            </div>
            <div>
              <div className="text-lg font-bold">Você está dentro!</div>
              <p className="mt-1 text-xs text-muted-foreground">Agora publique provas diárias no feed para acumular pontos e subir no ranking da temporada.</p>
            </div>
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3">
              <div className="text-xs font-bold text-accent">Fundo atual da temporada</div>
              <div className="text-2xl font-bold mt-1">{formatBRL(fundo?.valor_acumulado ?? 0)}</div>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-3xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow"
            >
              Ir para o feed e publicar →
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PrizeRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
      <span className="font-semibold">{label}</span>
      <span className="text-primary-light font-bold">{value}</span>
    </li>
  );
}

function AdminEditModal({ fundoId, metaValor, premios, onClose, onSaved }: {
  fundoId?: string;
  metaValor: number;
  premios: { p1: number; p2: number; p3: number; top10: number; top50: number };
  onClose: () => void;
  onSaved: (p: typeof premios) => void;
}) {
  const [meta, setMeta] = useState(metaValor);
  const [p, setP] = useState(premios);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    if (fundoId) {
      const { error } = await supabase.from("fundo_temporada").update({ meta_valor: meta }).eq("id", fundoId);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    setSaving(false);
    onSaved(p);
    toast.success("Atualizado");
    onClose();
  }

  return (
    <Modal onClose={onClose} title="Editar desafio">
      <div className="space-y-3">
        <NumField label="Meta da temporada (R$)" value={meta} onChange={setMeta} />
        <NumField label="1º lugar (R$)" value={p.p1} onChange={(v) => setP({ ...p, p1: v })} />
        <NumField label="2º lugar (R$)" value={p.p2} onChange={(v) => setP({ ...p, p2: v })} />
        <NumField label="3º lugar (R$)" value={p.p3} onChange={(v) => setP({ ...p, p3: v })} />
        <NumField label="Top 10 (R$)" value={p.top10} onChange={(v) => setP({ ...p, top10: v })} />
        <NumField label="Top 50 (R$)" value={p.top50} onChange={(v) => setP({ ...p, top50: v })} />
        <button onClick={salvar} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
          {saving && <Loader2 size={16} className="animate-spin" />} Salvar
        </button>
      </div>
    </Modal>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
    </label>
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
