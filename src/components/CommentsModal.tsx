import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { X, Send } from "lucide-react";

export function CommentsModal({ postId, userId, onClose, onCountChange }: { postId: string; userId: string; onClose: () => void; onCountChange?: (n: number) => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);

  const { data: comments, refetch } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("id, texto, created_at, user_id, profiles:user_id(nome, username, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) toast.error(error.message);
      return data ?? [];
    },
  });

  async function send() {
    const t = texto.trim();
    if (!t) return;
    setSending(true);
    const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: userId, texto: t });
    setSending(false);
    if (error) return toast.error(error.message);
    setTexto("");
    const { data } = await refetch();
    onCountChange?.((data ?? []).length);
    qc.invalidateQueries({ queryKey: ["post-stats", postId] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-card sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-bold">Comentários</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!comments && <p className="text-xs text-muted-foreground">Carregando…</p>}
          {comments && comments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Seja o primeiro a comentar</p>
          )}
          {(comments ?? []).map((c: any) => {
            const p = c.profiles;
            const initial = (p?.nome || "?")[0]?.toUpperCase();
            return (
              <div key={c.id} className="flex gap-3">
                {p?.avatar_url ? (
                  <img src={p.avatar_url} className="h-9 w-9 shrink-0 rounded-full border border-primary/40 object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-gradient-primary text-xs font-bold">{initial}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold truncate">{p?.nome ?? "Usuário"}</span>
                    <span className="text-[10px] text-muted-foreground">{formatWhen(c.created_at)}</span>
                  </div>
                  <p className="text-sm leading-snug whitespace-pre-wrap break-words">{c.texto}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Adicione um comentário..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button onClick={send} disabled={sending || !texto.trim()} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatWhen(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
