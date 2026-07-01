import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VyraLogo } from "@/components/VyraLogo";
import { toast } from "sonner";
import { ArrowLeft, Camera, User as UserIcon, AtSign, Pencil, Target, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil/editar")({
  component: EditarPerfil,
});

function EditarPerfil() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile-edit", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [missao, setMissao] = useState("");
  const [publico, setPublico] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
      setMissao(profile.missao ?? "");
      setPublico(profile.perfil_publico ?? true);
    }
  }, [profile]);

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  async function uploadAvatar(file: File) {
    if (!allowed.includes(file.type)) return toast.error("Formato inválido. Use JPG, PNG ou WebP.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB.");
    // Preview imediato
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: signed, error: sErr } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr || !signed) { setUploading(false); return toast.error(sErr?.message ?? "Falha ao gerar URL"); }
    await supabase.from("profiles").update({ avatar_url: signed.signedUrl }).eq("id", user.id);
    setAvatarPreview(signed.signedUrl);
    setUploading(false);
    toast.success("Foto atualizada!");
    refetch();
  }

  async function salvar() {
    const clean = username.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(clean)) return toast.error("Username: 3-20 caracteres, letras/números/_/.");
    if (bio.length > 150) return toast.error("Bio máx 150 caracteres");
    if (missao.length > 150) return toast.error("Missão máx 150 caracteres");
    const { data: exists } = await supabase.from("profiles").select("id").eq("username", clean).neq("id", user.id).maybeSingle();
    if (exists) return toast.error("Username já em uso");
    const { error } = await supabase.from("profiles").update({
      nome, username: clean, bio, missao, perfil_publico: publico,
    }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    navigate({ to: "/perfil" });
  }

  const avatarUrl = avatarPreview ?? profile?.avatar_url;
  const initial = (nome || "?")[0]?.toUpperCase();

  return (
    <main className="min-h-screen bg-background text-foreground pb-12">
      <header className="relative mx-auto flex max-w-md items-center justify-center px-5 pt-5 pb-2">
        <button onClick={() => navigate({ to: "/perfil" })} className="absolute left-5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"><ArrowLeft size={18}/></button>
        <VyraLogo size={32} />
      </header>

      <div className="mx-auto max-w-md px-5">
        <h1 className="text-center text-2xl font-bold">Editar perfil</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">Atualize suas informações e foto de perfil</p>

        <div className="mt-6 flex justify-center">
          <div className="relative">
            <div className="h-32 w-32 rounded-full border-2 border-primary p-0.5">
              {avatarUrl ? (
                <img src={avatarUrl} className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-primary text-3xl font-bold">{initial}</div>
              )}
            </div>
            <label
              htmlFor="avatar-file-input"
              aria-label="Trocar foto de perfil"
              className={`absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow ${uploading ? "opacity-60 pointer-events-none" : ""}`}
            >
              <Camera size={18} />
            </label>
            <input
              id="avatar-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", border: 0 }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        {uploading && <p className="mt-2 text-center text-xs text-muted-foreground">Enviando…</p>}

        <div className="mt-6 space-y-3">
          <IconField icon={<UserIcon size={18}/>} label="Nome completo" value={nome} onChange={setNome} />
          <IconField icon={<AtSign size={18}/>} label="Username" value={username} onChange={setUsername} prefix="@" />
          <IconTextarea icon={<Pencil size={18}/>} label="Bio" value={bio} onChange={setBio} max={150} />
          <IconTextarea icon={<Target size={18}/>} label="Missão pessoal" value={missao} onChange={setMissao} max={150} />

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Tipo de perfil</div>
                <div className="mt-0.5 text-base font-bold">{publico ? "Perfil Público" : "Perfil Privado"}</div>
              </div>
              <button onClick={() => setPublico(!publico)} className={`relative h-7 w-12 rounded-full transition-colors ${publico ? "bg-primary" : "bg-border"}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${publico ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{publico ? "Seu perfil ficará visível para todos os usuários." : "Apenas seguidores aprovados verão seu conteúdo."}</p>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background p-3">
              <Shield size={16} className="text-primary-light shrink-0 mt-0.5"/>
              <p className="text-xs text-muted-foreground">Perfis privados têm conteúdo e progresso visíveis apenas para você.</p>
            </div>
          </div>
        </div>

        <button onClick={salvar} className="mt-6 w-full rounded-2xl bg-gradient-primary py-4 text-base font-bold text-primary-foreground shadow-glow">
          Salvar alterações
        </button>
      </div>
    </main>
  );
}

function IconField({ icon, label, value, onChange, prefix }: any) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="text-primary-light">{icon}</span>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="flex items-center">
          {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
          <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none" />
        </div>
      </div>
    </label>
  );
}
function IconTextarea({ icon, label, value, onChange, max }: any) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="mt-1 text-primary-light">{icon}</span>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} rows={2} className="mt-0.5 w-full resize-none bg-transparent text-sm outline-none" />
        <div className="text-right text-[10px] text-muted-foreground">{value.length}/{max}</div>
      </div>
    </label>
  );
}
