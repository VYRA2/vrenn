import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { X, Camera, Image as ImageIcon, Loader2, Flag } from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS: Record<string, string[]> = {
  saude: ["#disciplina", "#saude", "#foco"],
  estudos: ["#estudos", "#evolucao", "#mente"],
  fitness: ["#disciplina", "#constancia", "#habitos"],
  leitura: ["#leitura", "#evolucao", "#mente"],
  financas: ["#financas", "#disciplina", "#liberdade"],
  trabalho: ["#foco", "#produtividade", "#disciplina"],
};

export function PublishProofModal({ userId, onClose, onPublished }: { userId: string; onClose: () => void; onPublished?: () => void }) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [metaId, setMetaId] = useState<string>("");
  const [legenda, setLegenda] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [metas, setMetas] = useState<any[]>([]);
  const [loadingMetas, setLoadingMetas] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoadingMetas(true);
      const { data } = await supabase.from("metas").select("id, titulo, categoria, status, progresso").eq("user_id", userId).order("created_at", { ascending: false });
      setMetas(data ?? []);
      setLoadingMetas(false);
    })();
  }, [userId]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const activeMeta = metas.find((m) => m.id === metaId);
  const suggested = activeMeta?.categoria ? SUGGESTIONS[activeMeta.categoria.toLowerCase()] ?? ["#disciplina", "#constancia"] : ["#disciplina", "#constancia"];

  function pick(source: "camera" | "gallery") {
    if (!fileRef.current) return;
    fileRef.current.setAttribute("accept", "image/*,video/*");
    if (source === "camera") fileRef.current.setAttribute("capture", "environment");
    else fileRef.current.removeAttribute("capture");
    fileRef.current.click();
  }

  async function publish() {
    if (!file) return toast.error("Escolha uma foto ou vídeo");
    if (!metaId) return toast.error("Vincule a uma meta");
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("posts").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("posts").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      const tags = (hashtags.trim() ? hashtags : suggested.join(" "))
        .split(/\s+/).map((t) => t.startsWith("#") ? t : `#${t}`).filter((t) => t.length > 1);
      const tipo = file.type.startsWith("video") ? "video" : "foto";
      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        meta_id: metaId,
        media_url: signed?.signedUrl ?? null,
        tipo,
        legenda: legenda || null,
        hashtags: tags,
      });
      if (error) throw error;
      toast.success("Prova publicada!");
      onPublished?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao publicar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Publicar prova</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground"><X size={18} /></button>
        </div>

        <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

        {loadingMetas ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : metas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary-light">
              <Flag size={22} />
            </div>
            <h4 className="text-sm font-bold">Você ainda não tem uma meta ativa</h4>
            <p className="mt-1 text-xs text-muted-foreground">No VYRA, toda prova é vinculada a um compromisso real. Crie sua primeira meta pra poder publicar.</p>
            <button
              onClick={() => { onClose(); navigate({ to: "/nova-meta" }); }}
              className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow"
            >
              Criar minha primeira meta
            </button>
          </div>
        ) : (
        <>
        {preview ? (
          <div className="relative mb-3 overflow-hidden rounded-2xl bg-background">
            {file?.type.startsWith("video") ? (
              <video src={preview} controls className="w-full max-h-72 object-cover" />
            ) : (
              <img src={preview} alt="preview" className="w-full max-h-72 object-cover" />
            )}
            <button onClick={() => setFile(null)} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"><X size={16} /></button>
          </div>
        ) : (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button onClick={() => pick("camera")} className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background py-6 text-sm font-semibold text-foreground hover:border-primary/50">
              <Camera size={22} className="text-primary-light" /> Câmera
            </button>
            <button onClick={() => pick("gallery")} className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-background py-6 text-sm font-semibold text-foreground hover:border-primary/50">
              <ImageIcon size={22} className="text-primary-light" /> Galeria
            </button>
          </div>
        )}

        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Vincular à meta</label>
        <select value={metaId} onChange={(e) => setMetaId(e.target.value)} className="mb-3 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground">
          <option value="">Escolha uma meta ativa…</option>
          {metas.map((m) => (
            <option key={m.id} value={m.id}>{m.titulo} ({m.progresso ?? 0}%)</option>
          ))}
        </select>
        {activeMeta && (
          <div className="mb-3 rounded-xl border border-border bg-background px-3 py-2 text-xs">
            <span className="text-muted-foreground">Compromisso: </span>
            <span className="font-semibold">{activeMeta.titulo}</span>
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${activeMeta.status === "concluida" ? "bg-accent/20 text-accent" : "bg-amber-500/20 text-amber-400"}`}>
              {activeMeta.status === "concluida" ? "✓ Cumprido" : "Em andamento"}
            </span>
          </div>
        )}

        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Legenda</label>
        <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={3} placeholder="Compartilhe a prova…" className="mb-3 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground" />

        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Hashtags</label>
        <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder={suggested.join(" ")} className="mb-2 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground" />
        <div className="mb-4 flex flex-wrap gap-1.5">
          {suggested.map((s) => (
            <button key={s} onClick={() => setHashtags((h) => (h ? `${h} ${s}` : s))} className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary-light">{s}</button>
          ))}
        </div>

        <button onClick={publish} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? "Publicando…" : "Publicar prova"}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
