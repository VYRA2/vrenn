import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mensagens/$id")({
  component: Chat,
});

function Chat() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: conversa } = useQuery({
    queryKey: ["conversa", id],
    queryFn: async () => {
      const { data } = await supabase.from("conversas").select("id, user1_id, user2_id").eq("id", id).maybeSingle();
      if (!data) return null;
      const otherId = data.user1_id === user.id ? data.user2_id : data.user1_id;
      const { data: other } = await supabase.from("profiles").select("id, nome, username, avatar_url").eq("id", otherId).maybeSingle();
      return { ...data, other };
    },
  });

  const { data: mensagens } = useQuery({
    queryKey: ["mensagens", id],
    queryFn: async () => {
      const { data } = await supabase.from("mensagens").select("*").eq("conversa_id", id).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // Marcar como lidas ao abrir
  useEffect(() => {
    supabase.from("mensagens").update({ lida: true }).eq("conversa_id", id).neq("sender_id", user.id).eq("lida", false).then(() => {});
  }, [id, user.id]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`mensagens:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["mensagens", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  // Scroll ao final
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mensagens?.length]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    const { error } = await supabase.from("mensagens").insert({ conversa_id: id, sender_id: user.id, texto: t } as any);
    setEnviando(false);
    if (error) return toast.error(error.message);
    setTexto("");
    qc.invalidateQueries({ queryKey: ["mensagens", id] });
    qc.invalidateQueries({ queryKey: ["conversas", user.id] });
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/mensagens" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <div className="h-9 w-9 shrink-0 rounded-full border border-primary/40 overflow-hidden">
            {conversa?.other?.avatar_url ? (
              <img src={conversa.other.avatar_url} className="h-full w-full object-cover" alt="" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-primary text-xs font-bold">{(conversa?.other?.nome ?? "?")[0]?.toUpperCase()}</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{conversa?.other?.nome ?? "Conversa"}</div>
            <div className="text-[11px] text-muted-foreground truncate">@{conversa?.other?.username ?? "—"}</div>
          </div>
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-4 space-y-2">
          {(mensagens ?? []).map((m: any) => {
            const mine = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                  <div className="whitespace-pre-wrap break-words">{m.texto}</div>
                  <div className={`mt-0.5 text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          {(mensagens ?? []).length === 0 && (
            <div className="pt-10 text-center text-xs text-muted-foreground">Envie a primeira mensagem</div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md items-end gap-2 px-3 py-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            rows={1}
            maxLength={1000}
            placeholder="Mensagem..."
            className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary max-h-32"
          />
          <button
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}
