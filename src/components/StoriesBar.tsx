import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Loader2, Type as TypeIcon, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type StoryRow = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_type: "photo" | "video" | "text";
  text_content: string | null;
  bg_gradient: string | null;
  created_at: string;
  expires_at: string;
};

type Group = {
  userId: string;
  nome: string;
  username: string;
  avatar_url: string | null;
  stories: StoryRow[];
  allSeen: boolean;
};

const GRADIENTS = [
  "linear-gradient(135deg,#7C3AED,#C026D3)",
  "linear-gradient(135deg,#0F0F17,#7C3AED)",
  "linear-gradient(135deg,#F59E0B,#EF4444)",
  "linear-gradient(135deg,#0EA5E9,#22D3A1)",
  "linear-gradient(135deg,#111827,#374151)",
];

async function signIfNeeded(url: string | null, expiresAt?: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const remainingMs = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
  if (expiresAt && remainingMs <= 0) return null;
  const maxSeconds = 5 * 60;
  const seconds = expiresAt ? Math.max(30, Math.min(maxSeconds, Math.floor(remainingMs / 1000))) : maxSeconds;
  const { data } = await supabase.storage.from("stories").createSignedUrl(url, seconds);
  return data?.signedUrl ?? null;
}


export function StoriesBar({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<{ groups: Group[]; index: number } | null>(null);

  const { data: me } = useQuery({
    queryKey: ["stories-me", userId],
    queryFn: async () =>
      (await supabase.from("profiles").select("id, nome, username, avatar_url").eq("id", userId).maybeSingle()).data,
  });

  const { data: groups } = useQuery({
    queryKey: ["stories-feed", userId],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Group[]> => {
      const { data: rows } = await (supabase as any)
        .from("stories")
        .select("id, user_id, media_url, media_type, text_content, bg_gradient, created_at, expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });

      const list: StoryRow[] = rows ?? [];
      if (!list.length) return [];

      const userIds = [...new Set(list.map((s) => s.user_id))];
      const [{ data: profs }, { data: views }] = await Promise.all([
        supabase.from("profiles").select("id, nome, username, avatar_url").in("id", userIds),
        (supabase as any).from("story_views").select("story_id").eq("viewer_id", userId),
      ]);
      const seen = new Set((views ?? []).map((v: any) => v.story_id));
      const byUser = new Map<string, StoryRow[]>();
      list.forEach((s) => byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]));

      const built: Group[] = [...byUser.entries()].map(([uid, stories]) => {
        const p = (profs ?? []).find((x: any) => x.id === uid);
        return {
          userId: uid,
          nome: p?.nome ?? "Usuário",
          username: p?.username ?? "—",
          avatar_url: p?.avatar_url ?? null,
          stories,
          allSeen: stories.every((s) => seen.has(s.id)),
        };
      });

      // O meu primeiro, depois não vistos, depois vistos
      return built.sort((a, b) => {
        if (a.userId === userId) return -1;
        if (b.userId === userId) return 1;
        return Number(a.allSeen) - Number(b.allSeen);
      });
    },
  });

  const meGroupIndex = (groups ?? []).findIndex((g) => g.userId === userId);
  const others = (groups ?? []).filter((g) => g.userId !== userId);
  const myGroup = meGroupIndex >= 0 ? (groups ?? [])[meGroupIndex] : null;

  function open(idx: number) {
    if (!groups?.length) return;
    setViewing({ groups, index: idx });
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Seu story */}
        <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
          <button
            onClick={() => (myGroup ? open(0) : setCreating(true))}
            className="relative h-[62px] w-[62px] rounded-full"
            aria-label="Seu story"
          >
            <span
              className="absolute inset-0 rounded-full p-[2px]"
              style={{ background: myGroup && !myGroup.allSeen ? "linear-gradient(135deg,#A855F7,#C026D3)" : "hsl(var(--border))" }}
            >
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background">
                {me?.avatar_url ? (
                  <img src={me.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Plus size={22} className="text-primary-light" />
                )}
              </span>
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); setCreating(true); }}
              className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
            >
              <Plus size={12} strokeWidth={3} />
            </span>
          </button>
          <span className="w-full truncate text-center text-[11px] text-muted-foreground">Seu story</span>
        </div>

        {others.map((g) => {
          const idx = (groups ?? []).indexOf(g);
          return (
            <div key={g.userId} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
              <button onClick={() => open(idx)} className="relative h-[62px] w-[62px] rounded-full" aria-label={`Story de ${g.nome}`}>
                <span
                  className="absolute inset-0 rounded-full p-[2px]"
                  style={{ background: g.allSeen ? "hsl(var(--border))" : "linear-gradient(135deg,#A855F7,#C026D3)" }}
                >
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background">
                    {g.avatar_url ? (
                      <img src={g.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-primary-light">{(g.nome || "?")[0]?.toUpperCase()}</span>
                    )}
                  </span>
                </span>
              </button>
              <span className="w-full truncate text-center text-[11px] text-muted-foreground">{g.username}</span>
            </div>
          );
        })}
      </div>

      {creating && (
        <CreateStoryModal
          userId={userId}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["stories-feed"] }); }}
        />
      )}

      {viewing && (
        <StoryViewer
          groups={viewing.groups}
          startIndex={viewing.index}
          userId={userId}
          onClose={() => { setViewing(null); qc.invalidateQueries({ queryKey: ["stories-feed"] }); }}
        />
      )}
    </>
  );
}

function CreateStoryModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<"media" | "text">("media");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [grad, setGrad] = useState(GRADIENTS[0]);
  const [busy, setBusy] = useState(false);

  function pick(f: File) {
    const ok = ["image/jpeg", "image/png", "image/webp", "video/mp4"];
    if (!ok.includes(f.type)) return toast.error("Use JPG, PNG, WebP ou MP4.");
    if (f.size > 50 * 1024 * 1024) return toast.error("Máximo 50MB.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function publicar() {
    setBusy(true);
    try {
      if (mode === "text") {
        if (!text.trim()) throw new Error("Escreva algo no story.");
        const { error } = await (supabase as any).from("stories").insert({
          user_id: userId, media_type: "text", text_content: text.trim(), bg_gradient: grad, media_url: null,
        });
        if (error) throw error;
      } else {
        if (!file) throw new Error("Escolha uma foto ou vídeo.");
        const ext = file.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("stories").upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error } = await (supabase as any).from("stories").insert({
          user_id: userId,
          media_type: file.type.startsWith("video") ? "video" : "photo",
          media_url: path,
        });
        if (error) throw error;
      }
      toast.success("Story publicado!");
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao publicar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">Novo story</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground"><X size={18} /></button>
        </div>

        <div className="mb-4 flex gap-2">
          <button onClick={() => setMode("media")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${mode === "media" ? "border-primary bg-primary/15 text-primary-light" : "border-border text-muted-foreground"}`}>
            <ImagePlus size={16} /> Foto/Vídeo
          </button>
          <button onClick={() => setMode("text")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${mode === "text" ? "border-primary bg-primary/15 text-primary-light" : "border-border text-muted-foreground"}`}>
            <TypeIcon size={16} /> Texto
          </button>
        </div>

        {mode === "media" ? (
          <label className="flex aspect-[9/13] max-h-72 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-background">
            {preview ? (
              file?.type.startsWith("video") ? (
                <video src={preview} className="h-full w-full object-cover" playsInline muted autoPlay loop />
              ) : (
                <img src={preview} className="h-full w-full object-cover" alt="" />
              )
            ) : (
              <span className="text-xs text-muted-foreground">Toque para escolher (até 50MB)</span>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
          </label>
        ) : (
          <>
            <div className="flex aspect-[9/13] max-h-72 w-full items-center justify-center rounded-2xl p-6 text-center" style={{ background: grad }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={220}
                placeholder="Escreva algo…"
                className="w-full resize-none bg-transparent text-center text-xl font-bold text-white outline-none placeholder:text-white/50"
                rows={4}
              />
            </div>
            <div className="mt-3 flex gap-2">
              {GRADIENTS.map((g) => (
                <button key={g} onClick={() => setGrad(g)} className={`h-8 w-8 rounded-full ring-2 ${grad === g ? "ring-primary" : "ring-transparent"}`} style={{ background: g }} aria-label="Cor de fundo" />
              ))}
            </div>
          </>
        )}

        <button onClick={publicar} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Publicar story
        </button>
      </div>
    </div>
  );
}

function StoryViewer({ groups, startIndex, userId, onClose }: { groups: Group[]; startIndex: number; userId: string; onClose: () => void }) {
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);

  const group = groups[gi];
  const story = group?.stories[si];
  const duration = story?.media_type === "video" ? 15000 : 5000;

  useEffect(() => { setSi(0); }, [gi]);

  useEffect(() => {
    if (!story) return;
    setMediaUrl(null);
    signIfNeeded(story.media_url).then(setMediaUrl);
    (supabase as any).from("story_views").upsert(
      { story_id: story.id, viewer_id: userId },
      { onConflict: "story_id,viewer_id", ignoreDuplicates: true },
    ).then(() => {});
  }, [story?.id]);

  useEffect(() => {
    setProgress(0);
    if (!story) return;
    const started = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / duration);
      setProgress(p);
      if (p >= 1) { clearInterval(t); next(); }
    }, 50);
    return () => clearInterval(t);
  }, [story?.id]);

  function next() {
    if (!group) return onClose();
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) setGi(gi + 1);
    else onClose();
  }
  function prev() {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) setGi(gi - 1);
  }

  async function excluir() {
    if (!story) return;
    await (supabase as any).from("stories").delete().eq("id", story.id);
    toast.success("Story excluído");
    next();
  }

  if (!story) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -40) next();
        else if (dx > 40) prev();
        touchX.current = null;
      }}
    >
      {/* Barras de progresso */}
      <div className="flex gap-1 px-3 pt-3">
        {group.stories.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-white" style={{ width: i < si ? "100%" : i === si ? `${progress * 100}%` : "0%" }} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 text-white">
        {group.avatar_url ? (
          <img src={group.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold">{(group.nome || "?")[0]}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{group.nome}</div>
          <div className="text-[11px] text-white/60">@{group.username}</div>
        </div>
        {group.userId === userId && (
          <button onClick={excluir} aria-label="Excluir story" className="rounded-full bg-white/10 p-2"><Trash2 size={16} /></button>
        )}
        <button onClick={onClose} aria-label="Fechar" className="rounded-full bg-white/10 p-2"><X size={18} /></button>
      </div>

      <div className="relative flex-1">
        {story.media_type === "text" ? (
          <div className="flex h-full w-full items-center justify-center p-10 text-center" style={{ background: story.bg_gradient ?? GRADIENTS[0] }}>
            <p className="text-2xl font-bold leading-snug text-white">{story.text_content}</p>
          </div>
        ) : mediaUrl ? (
          story.media_type === "video" ? (
            <video src={mediaUrl} className="h-full w-full object-contain" playsInline autoPlay />
          ) : (
            <img src={mediaUrl} className="h-full w-full object-contain" alt="" />
          )
        ) : (
          <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-white/60" /></div>
        )}
        <button onClick={prev} aria-label="Anterior" className="absolute inset-y-0 left-0 w-1/3" />
        <button onClick={next} aria-label="Próximo" className="absolute inset-y-0 right-0 w-1/3" />
      </div>
    </div>
  );
}
