import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { Dumbbell, Leaf, BookOpen, Brain, Target, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: OnboardingPage,
});

const CATEGORIAS = [
  { id: "treino", label: "Treino", icon: Dumbbell, color: "#A855F7" },
  { id: "alimentacao", label: "Alimentação", icon: Leaf, color: "#22D3A1" },
  { id: "estudos", label: "Estudos", icon: BookOpen, color: "#A855F7" },
  { id: "mentalidade", label: "Mentalidade", icon: Brain, color: "#A855F7" },
  { id: "produtividade", label: "Produtividade", icon: Target, color: "#A855F7" },
  { id: "habitos", label: "Hábitos", icon: Calendar, color: "#A855F7" },
];

const NIVEIS = [
  { id: "iniciante", emoji: "🌱", label: "Iniciante", desc: "Estou começando agora" },
  { id: "evolucao", emoji: "⚡", label: "Em evolução", desc: "Já tenho hábitos, quero ir além" },
  { id: "comprometido", emoji: "🔥", label: "Comprometido", desc: "Treino/estudo com disciplina há meses" },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [nivelPerfil, setNivelPerfil] = useState<string | null>(null);
  const [missao, setMissao] = useState("");
  const [username, setUsername] = useState("");
  const [perfilPublico, setPerfilPublico] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { navigate({ to: "/auth", replace: true }); return; }
      setUserId(data.user.id);
      const { data: p } = await supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
      if (p?.username) setUsername(p.username);
    })();
  }, []);

  function toggleCat(id: string) {
    setCategorias((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  async function finalizar() {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        categorias_interesse: categorias,
        missao: missao || null,
        username: username.trim(),
        perfil_publico: perfilPublico,
        onboarding_done: true,
      } as any).eq("id", userId);
      if (error) throw error;
      navigate({ to: "/feed" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-16">
      <header className="mx-auto flex max-w-md items-center justify-center px-5 pt-6 pb-4">
        <VyraLogo size={32} />
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* Stepper */}
        <div className="mb-8 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-gradient-primary" : "bg-border"}`} />
          ))}
        </div>

        {step === 1 && (
          <section>
            <h1 className="text-2xl font-bold">Quais são seus objetivos?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Escolha até 3 categorias que você quer acompanhar no VRENN.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {CATEGORIAS.map(({ id, label, icon: Icon, color }) => {
                const sel = categorias.includes(id);
                const disabled = !sel && categorias.length >= 3;
                return (
                  <button
                    key={id}
                    onClick={() => toggleCat(id)}
                    disabled={disabled}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-5 transition-all ${sel ? "border-primary bg-primary/10 text-primary-light shadow-glow" : "border-border bg-card"} ${disabled ? "opacity-50" : ""}`}
                  >
                    <Icon size={28} style={{ color: sel ? undefined : color }} />
                    <span className="text-sm font-bold">{label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={categorias.length === 0}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              Continuar <ArrowRight size={16} />
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-2xl font-bold">Como você se descreve?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Isso ajuda a calibrar seus desafios.</p>
            <div className="mt-6 space-y-3">
              {NIVEIS.map((n) => {
                const sel = nivelPerfil === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setNivelPerfil(n.id)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${sel ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card"}`}
                  >
                    <span className="text-3xl">{n.emoji}</span>
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${sel ? "text-primary-light" : ""}`}>{n.label}</div>
                      <div className="text-xs text-muted-foreground">{n.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={!nivelPerfil}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              Continuar <ArrowRight size={16} />
            </button>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-2xl font-bold">Personalize seu perfil</h1>
            <p className="mt-1 text-sm text-muted-foreground">Últimos ajustes antes de começar.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Sua missão</label>
                <textarea
                  value={missao}
                  onChange={(e) => setMissao(e.target.value)}
                  placeholder="Ex: Perder 10kg, passar no concurso, ganhar massa..."
                  rows={3}
                  className="mt-1.5 w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                  className="mt-1.5 w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perfilPublico}
                  onChange={(e) => setPerfilPublico(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold">Perfil público</div>
                  <div className="text-xs text-muted-foreground">Qualquer pessoa pode ver seus posts e progresso.</div>
                </div>
              </label>
            </div>

            <button
              onClick={finalizar}
              disabled={saving || !username.trim()}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <>Entrar no VRENN <ArrowRight size={16} /></>}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
