import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { ArrowRight, Loader2, Camera, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: OnboardingPage,
});

const CATEGORIAS = [
  { id: "fitness", label: "Corpo e Movimento", emoji: "🏃" },
  { id: "estudos", label: "Estudo e Aprendizado", emoji: "📚" },
  { id: "financas", label: "Dinheiro e Finanças", emoji: "💰" },
  { id: "habitos", label: "Hábitos e Rotina", emoji: "🎯" },
  { id: "saude", label: "Mente e Saúde", emoji: "🧠" },
  { id: "foco", label: "Foco e Produtividade", emoji: "⚡" },
  { id: "esportes", label: "Esportes", emoji: "🏆" },
  { id: "outro", label: "Outro", emoji: "✨" },
];

const NIVEIS = [
  { id: "iniciante", emoji: "🌱", label: "Tô começando agora", desc: "Primeira vez tentando de verdade" },
  { id: "evolucao", emoji: "⚡", label: "Já tô na corrida", desc: "Tenho hábitos, quero ir além" },
  { id: "comprometido", emoji: "🔥", label: "Sou disciplinado de verdade", desc: "Meses de consistência, não paro" },
];

const PRAZOS = [30, 60, 90];

function OnboardingPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [splashPhase, setSplashPhase] = useState(0);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [nivelPerfil, setNivelPerfil] = useState<string | null>(null);
  const [missao, setMissao] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [perfilPublico, setPerfilPublico] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [metaTitulo, setMetaTitulo] = useState("");
  const [metaPrazo, setMetaPrazo] = useState<number>(30);
  const [prazoCustom, setPrazoCustom] = useState(false);
  const [metaPublica, setMetaPublica] = useState(true);
  const [criandoMeta, setCriandoMeta] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashPhase(1), 100);
    const t2 = setTimeout(() => setSplashPhase(2), 900);
    const t3 = setTimeout(() => setStep((s) => (s === 0 ? 1 : s)), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);


  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { navigate({ to: "/auth", replace: true }); return; }
      setUserId(data.user.id);
      const { data: p } = await supabase.from("profiles").select("username, nome, avatar_url").eq("id", data.user.id).maybeSingle();
      if (p?.username) setUsername(p.username);

      const metaNome = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name;
      const metaAvatar = data.user.user_metadata?.avatar_url ?? data.user.user_metadata?.picture;
      setNome(p?.nome && p.nome !== p.username ? p.nome : (metaNome ?? ""));
      setAvatarPreview(p?.avatar_url ?? metaAvatar ?? null);
    })();
  }, []);

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  async function uploadAvatar(file: File) {
    if (!userId) return;
    if (!allowedTypes.includes(file.type)) return toast.error("Formato inválido. Use JPG, PNG ou WebP.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB.");
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setAvatarUploading(false); return toast.error(error.message); }
    const { data: signed, error: sErr } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr || !signed) { setAvatarUploading(false); return toast.error(sErr?.message ?? "Falha ao gerar URL"); }
    setAvatarPreview(signed.signedUrl);
    setAvatarUploading(false);
    toast.success("Foto atualizada!");
  }


  async function gerarSugestoes(base: string): Promise<string[]> {
    const b = base.toLowerCase().replace(/[^a-z0-9]/g, "");
    const candidatos = [b, `${b}2`, `${b}3`, `${b}.vrenn`, `${b}${new Date().getFullYear()}`];
    const sugs: string[] = [];
    for (const c of candidatos) {
      if (sugs.length >= 3) break;
      const { data } = await supabase.from("profiles").select("id").eq("username", c).maybeSingle();
      if (!data) sugs.push(c); // disponível
    }
    return sugs;
  }

  async function verificarUsername(u: string) {
    if (u.length < 3) { setUsernameTaken(false); setSugestoes([]); return; }
    setUsernameChecking(true);
    const { data } = await supabase.from("profiles").select("id").eq("username", u).maybeSingle();
    setUsernameChecking(false);
    if (data) {
      setUsernameTaken(true);
      setSugestoes(await gerarSugestoes(u));
    } else {
      setUsernameTaken(false);
      setSugestoes([]);
    }
  }

  function toggleCat(id: string) {
    setCategorias((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  async function finalizar() {
    if (!userId) return;
    if (!nome.trim()) return toast.error("Digite seu nome");
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        categorias_interesse: categorias,
        missao: missao || null,
        username: username.trim(),
        nome: nome.trim(),
        avatar_url: avatarPreview,
        perfil_publico: perfilPublico,
        onboarding_done: true,
      } as any).eq("id", userId);
      if (error) throw error;
      setStep(4);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function criarPrimeiraMeta() {
    if (!userId) return;
    if (!metaTitulo.trim()) return toast.error("Escreva sua meta");
    setCriandoMeta(true);
    try {
      const prazoData = new Date();
      prazoData.setDate(prazoData.getDate() + metaPrazo);
      const { error } = await supabase.from("metas").insert({
        user_id: userId,
        titulo: metaTitulo.trim(),
        categoria: categorias[0] ?? "outro",
        status: "ativa",
        prazo: prazoData.toISOString().slice(0, 10),
        prazo: prazoData.toISOString().slice(0, 10),

      } as any);
      if (error) throw error;
      toast.success("Meta criada! Agora mostre que você vai cumprir. 💪");
      navigate({ to: "/feed" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar meta");
    } finally {
      setCriandoMeta(false);
    }
  }

  if (step === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-8 text-center text-foreground">
        <h1
          className="text-4xl font-bold leading-tight transition-opacity duration-700"
          style={{ opacity: splashPhase >= 1 ? 1 : 0 }}
        >
          Não diga que vai fazer.
        </h1>
        <p
          className="mt-4 bg-gradient-primary bg-clip-text text-4xl font-bold text-transparent transition-opacity duration-700"
          style={{ opacity: splashPhase >= 2 ? 1 : 0 }}
        >
          Mostre.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-16">
      <header className="mx-auto flex max-w-md items-center justify-center px-5 pt-6 pb-4">
        <VyraLogo size={32} />
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* Stepper */}
        <div className="mb-8 flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-gradient-primary" : "bg-border"}`} />
          ))}
        </div>

        {step === 1 && (
          <section>
            <h1 className="text-2xl font-bold">Tem algo que você disse que ia fazer e ainda não fez?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Escolha onde você quer mostrar que consegue.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {CATEGORIAS.map(({ id, label, emoji }) => {
                const sel = categorias.includes(id);
                const disabled = !sel && categorias.length >= 3;
                return (
                  <button
                    key={id}
                    onClick={() => toggleCat(id)}
                    disabled={disabled}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-5 transition-all ${sel ? "border-primary bg-primary/10 text-primary-light shadow-glow" : "border-border bg-card"} ${disabled ? "opacity-50" : ""}`}
                  >
                    <span className="text-3xl">{emoji}</span>
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
            <h1 className="text-2xl font-bold">Onde você está agora?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sem julgamento. Só pra calibrar seus desafios.</p>

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
            <h1 className="text-2xl font-bold">Agora o mundo vai te conhecer.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Seu histórico no VRENN é permanente. Suas vitórias também.</p>

            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="relative">
                <div className="h-24 w-24 overflow-hidden rounded-full border border-border bg-card">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Sua foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                      {(nome || "?")[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <label
                  htmlFor="onboarding-avatar"
                  className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow"
                  aria-label="Trocar foto de perfil"
                >
                  <Camera size={16} />
                </label>
                <input
                  id="onboarding-avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {avatarUploading && <p className="text-xs text-muted-foreground">Enviando…</p>}
              <div className="w-full">
                <label className="text-xs font-semibold text-muted-foreground">Nome completo</label>
                <div className="relative mt-1.5">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-card py-3 pl-9 pr-3 text-sm outline-none focus:border-primary"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
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
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                  <input
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();
                      setUsername(val);
                      verificarUsername(val);
                    }}
                    className={`w-full rounded-2xl border bg-card py-3 pl-7 pr-10 text-sm outline-none transition-colors ${usernameTaken ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"}`}
                    placeholder="seuusername"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                    {usernameChecking ? <Loader2 size={14} className="animate-spin text-muted-foreground" /> :
                     username.length >= 3 && !usernameTaken ? <span className="text-green-400">✓</span> : null}
                  </span>
                </div>
                {usernameTaken && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs text-destructive">@{username} já está em uso. Sugestões:</p>
                    <div className="flex flex-wrap gap-2">
                      {sugestoes.map((s) => (
                        <button key={s} onClick={() => { setUsername(s); setUsernameTaken(false); setSugestoes([]); }}
                          className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary-light">
                          @{s}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Ou escolha um username diferente acima.</p>
                  </div>
                )}
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
              disabled={saving || avatarUploading || !nome.trim() || !username.trim() || usernameTaken || usernameChecking}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <>Entrar no VRENN <ArrowRight size={16} /></>}
            </button>
          </section>
        )}

        {step === 4 && (
          <section>
            <h1 className="text-2xl font-bold">Agora vem o mais importante.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Crie sua primeira meta. Leva menos de 30 segundos.</p>

            <div className="mt-6 space-y-4">
              <input
                value={metaTitulo}
                maxLength={100}
                onChange={(e) => setMetaTitulo(e.target.value)}
                placeholder="O que você vai mostrar que consegue fazer?"
                className="w-full rounded-2xl border border-border bg-card p-3.5 text-sm outline-none focus:border-primary"
              />

              <div>
                <span className="text-xs font-semibold text-muted-foreground">Prazo</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRAZOS.map((d) => {
                    const sel = !prazoCustom && metaPrazo === d;
                    return (
                      <button
                        key={d}
                        onClick={() => { setPrazoCustom(false); setMetaPrazo(d); }}
                        className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${sel ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground"}`}
                      >
                        {d} dias
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPrazoCustom(true)}
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${prazoCustom ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground"}`}
                  >
                    Personalizado
                  </button>
                </div>
                {prazoCustom && (
                  <input
                    type="number"
                    min={1}
                    value={metaPrazo}
                    onChange={(e) => setMetaPrazo(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-3 w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary"
                    placeholder="Dias"
                  />
                )}
              </div>

              <div className="flex gap-2">
                {[{ v: true, l: "Pública" }, { v: false, l: "Privada" }].map((o) => (
                  <button
                    key={o.l}
                    onClick={() => setMetaPublica(o.v)}
                    className={`flex-1 rounded-2xl border py-3 text-xs font-bold transition-colors ${metaPublica === o.v ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground"}`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={criarPrimeiraMeta}
              disabled={criandoMeta || !metaTitulo.trim()}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {criandoMeta ? <Loader2 size={16} className="animate-spin" /> : <>Criar e começar <ArrowRight size={16} /></>}
            </button>
            <button
              onClick={() => navigate({ to: "/feed" })}
              className="mt-4 w-full text-center text-xs text-muted-foreground"
            >
              Pular por agora →
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

