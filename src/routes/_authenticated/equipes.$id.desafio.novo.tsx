import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, HelpCircle, Target, FileText, Shield, Flag, Heart, DollarSign, Trophy, Users, ChevronRight, ChevronDown, Lock, Loader2, MessageCircle, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipes/$id/desafio/novo")({
  component: NovoDesafio,
});

const STEPS = [
  { id: 1, label: "Desafio" },
  { id: 2, label: "Detalhes" },
  { id: 3, label: "Regras" },
  { id: 4, label: "Resumo" },
];

const CATEGORIAS = ["foco", "estudos", "saude", "esportes", "outro"];
const DURACOES = [7, 14, 21, 30, 60, 90];

function NovoDesafio() {
  const { id: equipeId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("saude");
  const [duracao, setDuracao] = useState(30);
  const [valor, setValor] = useState("50,00");
  const [premiacao, setPremiacao] = useState("");
  const [regras, setRegras] = useState({ foco_total: true, comprovacao: true, etica: true, conclusao: true });
  const [consequencias, setConsequencias] = useState("");
  const [aceito, setAceito] = useState(false);

  const inicio = new Date();
  const fim = new Date(); fim.setDate(fim.getDate() + duracao);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR");

  function next() {
    if (step === 1 && (!titulo.trim() || !descricao.trim())) return toast.error("Preencha título e descrição");
    setStep((s) => Math.min(4, s + 1));
  }

  async function publicar() {
    if (!aceito) return toast.error("Você precisa aceitar as regras");
    setLoading(true);
    const valorNum = parseFloat(valor.replace(/[^0-9,.]/g, "").replace(",", ".")) || 0;
    const { data, error } = await (supabase as any).from("desafios_equipe").insert({
      equipe_id: equipeId,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      categoria,
      duracao_dias: duracao,
      data_inicio: inicio.toISOString().slice(0, 10),
      data_fim: fim.toISOString().slice(0, 10),
      valor_entrada: valorNum,
      premiacao: premiacao.trim() || null,
      regras: { ...regras, consequencias, personalizadas: [] },
      criador_id: user.id,
    }).select().single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Desafio publicado!");
    navigate({ to: "/equipes/$id", params: { id: equipeId } });
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-12">
      <header className="relative mx-auto flex max-w-md flex-col items-center px-5 pt-5 pb-3">
        <div className="flex w-full items-center justify-between">
          <button onClick={() => (step > 1 ? setStep(step - 1) : navigate({ to: "/equipes/$id", params: { id: equipeId } }))} className="flex h-9 w-9 items-center justify-center"><ArrowLeft size={20}/></button>
          <div className="text-center">
            <h1 className="text-lg font-bold">Criar Desafio</h1>
            <p className="text-[11px] text-muted-foreground">Equipe Foco Total 🚀</p>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary-light"><HelpCircle size={16}/></button>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 pt-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && <div className={`h-px flex-1 ${done || active ? "bg-primary" : "bg-border"}`}/>}
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary-light" : "bg-card text-muted-foreground border border-border"}`}>{s.id}</div>
                  {i < STEPS.length - 1 && <div className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`}/>}
                </div>
                <span className={`mt-2 text-[10px] font-semibold ${active ? "text-primary-light" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-md px-5 pt-6 space-y-4">
        {(step === 1 || step === 2) && (
          <>
            <HeroCard
              icon={step === 1 ? <Target size={26}/> : <FileText size={26}/>}
              title={step === 1 ? "Crie um desafio para sua equipe" : "Detalhes do desafio"}
              desc={step === 1 ? "Motivação, disciplina e evolução juntos." : "Preencha as informações principais do seu desafio."}
              color="primary"
            />

            <Field label="Título do desafio">
              <Input value={titulo} onChange={setTitulo} placeholder="Ex: 30 dias sem doces" max={40} />
            </Field>
            <Field label="Descrição">
              <Textarea value={descricao} onChange={setDescricao} placeholder="Explique o objetivo do desafio, como vai funcionar e qual o impacto esperado." max={150} rows={4}/>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <Select value={categoria} onChange={setCategoria} options={CATEGORIAS.map(c => ({ value: c, label: c[0].toUpperCase()+c.slice(1) }))} />
              </Field>
              <Field label="Duração">
                <Select value={String(duracao)} onChange={(v) => setDuracao(Number(v))} options={DURACOES.map(d => ({ value: String(d), label: `${d} dias` }))} sub={`${fmt(inicio)} até ${fmt(fim)}`} />
              </Field>
            </div>

            <div className="rounded-2xl border border-border bg-card">
              <div className="p-4 flex items-start gap-3 border-b border-border">
                <IconBox color="#7B3FF2"><DollarSign size={18}/></IconBox>
                <div className="flex-1">
                  <div className="text-sm font-bold">Valor do desafio</div>
                  <div className="text-[11px] text-muted-foreground">Este é o valor que cada participante pagará para entrar.</div>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-primary px-3 py-1.5 text-sm font-bold text-primary-light">
                  <span className="text-[11px]">R$</span>
                  <input value={valor} onChange={(e) => setValor(e.target.value)} className="w-20 bg-transparent text-right outline-none" />
                </div>
              </div>
              <div className="p-4 flex items-start gap-3">
                <IconBox color="#7B3FF2"><Trophy size={18}/></IconBox>
                <div className="flex-1">
                  <div className="text-sm font-bold">Premiação <span className="text-[11px] text-muted-foreground font-normal">(opcional)</span></div>
                  <div className="text-[11px] text-muted-foreground">Defina como o valor arrecadado será repartido ou o prêmio para o vencedor.</div>
                  <input value={premiacao} onChange={(e) => setPremiacao(e.target.value)} placeholder="Ex: 100% para o vencedor" className="mt-1.5 w-full rounded-xl bg-background px-3 py-2 text-xs outline-none"/>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-accent/40 bg-card p-4 flex items-start gap-3">
              <IconBox color="#22D3A1"><Shield size={18}/></IconBox>
              <div className="flex-1">
                <div className="text-sm font-bold">Como funciona?</div>
                <div className="text-[11px] text-muted-foreground">Explique as regras, dinâmica e condições para participação.</div>
              </div>
              <button className="rounded-xl border border-primary px-3 py-1.5 text-[11px] font-semibold text-primary-light inline-flex items-center gap-1">Ver explicação <ChevronRight size={12}/></button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <HeroCard icon={<Shield size={26}/>} title="Defina as regras do desafio" desc="Estabeleça as regras e condições para participação e conclusão do desafio." color="primary" />
            <div className="text-sm font-bold mt-2">Regras principais</div>
            <ToggleCard icon={<Target size={18}/>} title="Foco total" desc="Os participantes devem cumprir o objetivo do desafio durante todo o período." value={regras.foco_total} onChange={(v) => setRegras({...regras, foco_total: v})} />
            <ToggleCard icon={<FileText size={18}/>} title="Comprovação" desc="Envie comprovantes ou registros conforme as regras definidas para validar o progresso." value={regras.comprovacao} onChange={(v) => setRegras({...regras, comprovacao: v})} />
            <ToggleCard icon={<Users size={18}/>} title="Respeito e ética" desc="Trate todos com respeito e jogue limpo. Sem trapaças!" value={regras.etica} onChange={(v) => setRegras({...regras, etica: v})} />
            <ToggleCard icon={<Flag size={18}/>} title="Conclusão" desc="O desafio só é concluído ao final do período ou quando as regras forem cumpridas." value={regras.conclusao} onChange={(v) => setRegras({...regras, conclusao: v})} />
            <button className="w-full rounded-2xl border-2 border-dashed border-primary py-3.5 text-sm font-semibold text-primary-light inline-flex items-center justify-center gap-2">+ Adicionar regra personalizada</button>
            <div className="mt-2">
              <div className="text-sm font-bold">Consequências <span className="text-[11px] text-muted-foreground font-normal">(opcional)</span></div>
              <p className="mt-1 text-xs text-muted-foreground">Defina o que acontece em caso de descumprimento das regras.</p>
              <div className="mt-2"><Textarea value={consequencias} onChange={setConsequencias} placeholder="Ex: Advertência, remoção do desafio, perda do direito à premiação, etc." max={120} rows={3}/></div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <HeroCard icon={<Flag size={26}/>} title="Resumo do desafio" desc="Revise todas as informações antes de publicar seu desafio." color="primary" />
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              <SummaryRow icon={<FileText size={18}/>} label="Título" value={titulo || "—"} />
              <SummaryRow icon={<MessageCircle size={18}/>} label="Descrição" value={descricao || "—"} />
              <SummaryRow icon={<Heart size={18}/>} label="Categoria" value={categoria[0].toUpperCase()+categoria.slice(1)} />
              <SummaryRow icon={<Calendar size={18}/>} label="Duração" value={`${duracao} dias`} sub={`${fmt(inicio)} até ${fmt(fim)}`} />
              <SummaryRow icon={<DollarSign size={18}/>} label="Valor do desafio" value={`R$ ${valor}`} sub="Por participante" />
              <SummaryRow icon={<Trophy size={18}/>} label="Premiação" value={premiacao || "A definir"} sub={premiacao ? undefined : "Premiação em aberto"} />
              <SummaryRow icon={<Users size={18}/>} label="Participação" value="Aberta" sub="Qualquer membro pode entrar" />
              <SummaryRow icon={<Shield size={18}/>} label="Regras" value={`${Object.values(regras).filter(Boolean).length} regras definidas`} sub="Toque para ver" />
            </div>
            <button onClick={() => setAceito(!aceito)} className={`w-full rounded-2xl border-2 p-4 flex items-start gap-3 text-left transition ${aceito ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${aceito ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{aceito && "✓"}</div>
              <div className="flex-1">
                <div className="text-sm font-bold">Li e concordo com as regras do desafio</div>
                <div className="text-[11px] text-muted-foreground">É obrigatório aceitar para criar o desafio.</div>
              </div>
            </button>
          </>
        )}

        {step < 4 ? (
          <button onClick={next} className="mt-2 w-full rounded-2xl bg-gradient-primary py-4 text-base font-bold text-primary-foreground shadow-glow">Continuar →</button>
        ) : (
          <>
            <button onClick={publicar} disabled={loading || !aceito} className="mt-2 w-full rounded-2xl bg-gradient-primary py-4 text-base font-bold text-primary-foreground shadow-glow inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <Loader2 size={18} className="animate-spin"/>} Publicar desafio 🚀
            </button>
            <button onClick={() => setStep(1)} className="w-full py-2 text-sm font-semibold text-primary-light">Voltar e editar</button>
          </>
        )}

        <div className="pt-2 pb-4 text-center text-[11px] text-muted-foreground inline-flex items-center justify-center gap-1 w-full"><Lock size={11}/> Pagamento seguro via VRENN Wallet</div>
      </div>
    </main>
  );
}

function HeroCard({ icon, title, desc, color }: any) {
  return (
    <div className={`rounded-2xl border border-primary/40 bg-card p-4 flex items-center gap-3`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 text-primary-light">{icon}</div>
      <div className="flex-1">
        <div className="text-base font-bold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
function Field({ label, children }: any) {
  return <label className="block"><div className="mb-1.5 text-sm font-bold">{label}</div>{children}</label>;
}
function Input({ value, onChange, placeholder, max }: any) {
  return (
    <div className="relative rounded-2xl border border-border bg-card px-4 py-3.5">
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none pr-10"/>
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{value.length}/{max}</span>
    </div>
  );
}
function Textarea({ value, onChange, placeholder, max, rows }: any) {
  return (
    <div className="relative rounded-2xl border border-border bg-card px-4 py-3.5">
      <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} placeholder={placeholder} rows={rows} className="w-full resize-none bg-transparent text-sm outline-none"/>
      <span className="absolute right-4 bottom-2 text-[10px] text-muted-foreground">{value.length}/{max}</span>
    </div>
  );
}
function Select({ value, onChange, options, sub }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; sub?: string }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card px-4 py-3">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none bg-transparent text-sm font-semibold capitalize outline-none pr-6">
        {options.map((o: any) => <option key={o.value} value={o.value} className="bg-card">{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-4 top-4 text-muted-foreground pointer-events-none"/>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
function IconBox({ color, children }: any) {
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}20`, color }}>{children}</div>;
}
function ToggleCard({ icon, title, desc, value, onChange }: { icon: React.ReactNode; title: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
      <IconBox color="#7B3FF2">{icon}</IconBox>
      <div className="flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <button onClick={() => onChange(!value)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${value ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`}/>
      </button>
    </div>
  );
}
function SummaryRow({ icon, label, value, sub }: any) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="text-primary-light mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold whitespace-pre-wrap">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      <ChevronRight size={16} className="text-muted-foreground mt-1"/>
    </div>
  );
}
