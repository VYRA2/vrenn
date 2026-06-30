import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Camera, Target, BookOpen, Heart, Dumbbell, MoreHorizontal, Shield, Info, Loader2, ChevronDown, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/equipes/nova")({
  component: NovaEquipe,
});

const STEPS = [
  { id: 1, label: "Informações" },
  { id: 2, label: "Membros" },
  { id: 3, label: "Missão" },
  { id: 4, label: "Concluir" },
];

const CATEGORIAS = [
  { id: "foco", label: "Foco", icon: Target },
  { id: "estudos", label: "Estudos", icon: BookOpen },
  { id: "saude", label: "Saúde", icon: Heart },
  { id: "esportes", label: "Esportes", icon: Dumbbell },
  { id: "outro", label: "Outro", icon: MoreHorizontal },
];

function NovaEquipe() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("foco");
  const [publica, setPublica] = useState(true);
  const [regras, setRegras] = useState("");
  const [missao, setMissao] = useState("");
  const [valores, setValores] = useState("");
  const [convites, setConvites] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function onAvatar(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Use JPG, PNG ou WebP");
    if (file.size > 10 * 1024 * 1024) return toast.error("Máximo 10MB");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadAvatar(equipeId: string): Promise<string | null> {
    if (!avatarFile) return null;
    const ext = avatarFile.name.split(".").pop();
    const path = `equipes/${equipeId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
    if (error) { toast.error(error.message); return null; }
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return data?.signedUrl ?? null;
  }

  async function publicar() {
    if (!nome.trim()) return toast.error("Defina o nome da equipe");
    setLoading(true);
    const { data, error } = await (supabase as any).from("equipes").insert({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      categoria,
      publica,
      regras: regras.trim() || null,
      criador_id: user.id,
    }).select().single();
    if (error) { setLoading(false); return toast.error(error.message); }
    const url = await uploadAvatar(data.id);
    if (url) await (supabase as any).from("equipes").update({ avatar_url: url }).eq("id", data.id);
    setLoading(false);
    toast.success("Equipe criada!");
    navigate({ to: "/equipes/$id", params: { id: data.id } });
  }

  function next() {
    if (step === 1 && !nome.trim()) return toast.error("Defina o nome da equipe");
    setStep((s) => Math.min(4, s + 1));
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-12">
      <header className="relative mx-auto flex max-w-md items-center justify-center px-5 pt-5 pb-3">
        <button onClick={() => (step > 1 ? setStep(step - 1) : navigate({ to: "/equipes" }))} className="absolute left-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold">Criar Equipe</h1>
        <button className="absolute right-5 flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary-light"><Info size={16}/></button>
      </header>

      <div className="mx-auto max-w-md px-5 pt-4">
        <Stepper current={step} />
      </div>

      <div className="mx-auto max-w-md px-5 pt-8">
        {step === 1 && (
          <div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 overflow-hidden">
                  {avatarPreview ? <img src={avatarPreview} className="h-full w-full object-cover" /> : <Users size={42} className="text-primary-light" />}
                </div>
                <button onClick={() => fileInput.current?.click()} className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow"><Camera size={18}/></button>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])} />
              </div>
            </div>

            <div className="mt-7 space-y-4">
              <Field label="Nome da equipe">
                <Input value={nome} onChange={setNome} placeholder="Ex: Imparáveis" max={30} />
              </Field>
              <Field label="Descrição">
                <Textarea value={descricao} onChange={setDescricao} placeholder="Conte um pouco sobre sua equipe, seus objetivos e o que te motiva." max={150} rows={3} />
              </Field>

              <div>
                <div className="text-sm font-bold mb-2">Categoria</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {CATEGORIAS.map((c) => {
                    const active = categoria === c.id;
                    const I = c.icon;
                    return (
                      <button key={c.id} onClick={() => setCategoria(c.id)} className={`flex min-w-[78px] flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-[11px] transition-colors ${active ? "border-primary text-primary-light bg-primary/10" : "border-border text-muted-foreground"}`}>
                        <I size={20} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary-light"><Shield size={18}/></div>
                  <div className="flex-1">
                    <div className="text-sm font-bold">Equipe pública ou privada?</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Equipes públicas podem ser encontradas por outros usuários na busca.</div>
                  </div>
                  <div className="flex shrink-0 overflow-hidden rounded-xl border border-border text-xs font-semibold">
                    <button onClick={() => setPublica(true)} className={`px-3 py-1.5 ${publica ? "bg-primary/15 text-primary-light border border-primary" : "text-muted-foreground"}`}>Pública</button>
                    <button onClick={() => setPublica(false)} className={`px-3 py-1.5 ${!publica ? "bg-primary/15 text-primary-light border border-primary" : "text-muted-foreground"}`}>Privada</button>
                  </div>
                </div>
              </div>

              <details className="group rounded-2xl border border-border bg-card">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3.5">
                  <span className="text-sm font-bold">Regras da equipe <span className="text-muted-foreground font-normal">(opcional)</span></span>
                  <ChevronDown size={16} className="text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border p-3">
                  <textarea value={regras} onChange={(e) => setRegras(e.target.value.slice(0, 300))} placeholder="Defina regras, combinados e valores da sua equipe" className="w-full resize-none rounded-xl bg-background p-3 text-sm outline-none" rows={3} />
                </div>
              </details>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary-light"><Users size={26}/></div>
              <h3 className="text-base font-bold">Convide pessoas</h3>
              <p className="mt-1 text-xs text-muted-foreground">Cole @usernames ou emails separados por vírgula. Você pode convidar depois também.</p>
            </div>
            <Field label="Convidar (opcional)">
              <Textarea value={convites} onChange={setConvites} placeholder="@matheus, @fernanda, lucas@email.com" max={500} rows={3} />
            </Field>
            <div className="text-[11px] text-muted-foreground">Os convites serão enviados após a criação da equipe.</div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary-light"><Sparkles size={26}/></div>
              <h3 className="text-base font-bold">Missão da equipe</h3>
              <p className="mt-1 text-xs text-muted-foreground">Por que essa equipe existe? Qual o impacto esperado?</p>
            </div>
            <Field label="Missão">
              <Textarea value={missao} onChange={setMissao} placeholder="Ex: Evoluir 1% todos os dias com disciplina e foco." max={150} rows={3} />
            </Field>
            <Field label="Valores (opcional)">
              <Textarea value={valores} onChange={setValores} placeholder="Foco · Disciplina · Constância" max={120} rows={2} />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <Row label="Nome" value={nome || "—"} />
            <Row label="Categoria" value={CATEGORIAS.find((c) => c.id === categoria)?.label ?? categoria} />
            <Row label="Visibilidade" value={publica ? "Pública" : "Privada"} />
            <Row label="Descrição" value={descricao || "—"} />
            <Row label="Missão" value={missao || "—"} />
            {regras && <Row label="Regras" value={regras} />}
          </div>
        )}

        {step < 4 ? (
          <button onClick={next} className="mt-7 w-full rounded-2xl bg-gradient-primary py-4 text-base font-bold text-primary-foreground shadow-glow inline-flex items-center justify-center gap-2">
            Continuar →
          </button>
        ) : (
          <button onClick={publicar} disabled={loading} className="mt-7 w-full rounded-2xl bg-gradient-primary py-4 text-base font-bold text-primary-foreground shadow-glow inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 size={18} className="animate-spin" />}
            Publicar equipe 🚀
          </button>
        )}
      </div>
    </main>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((s, i) => {
        const active = current === s.id;
        const done = current > s.id;
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && <div className={`h-px flex-1 ${done || active ? "bg-primary" : "bg-border"}`} />}
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary-light" : "bg-card text-muted-foreground border border-border"}`}>
                {s.id}
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />}
            </div>
            <span className={`mt-2 text-[10px] font-semibold ${active ? "text-primary-light" : "text-muted-foreground"}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-bold">{label}</div>
      {children}
    </label>
  );
}
function Input({ value, onChange, placeholder, max }: { value: string; onChange: (v: string) => void; placeholder?: string; max: number }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card px-4 py-3.5">
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none pr-10" />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{value.length}/{max}</span>
    </div>
  );
}
function Textarea({ value, onChange, placeholder, max, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; max: number; rows?: number }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card px-4 py-3.5">
      <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} placeholder={placeholder} rows={rows} className="w-full resize-none bg-transparent text-sm outline-none" />
      <span className="absolute right-4 bottom-2 text-[10px] text-muted-foreground">{value.length}/{max}</span>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold whitespace-pre-wrap">{value}</div>
    </div>
  );
}
