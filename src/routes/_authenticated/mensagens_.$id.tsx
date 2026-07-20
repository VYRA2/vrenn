import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Phone, Video, MoreVertical, SmilePlus, Image as ImageIcon, Mic, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mensagens_/$id")({
  component: Chat,
});

const EMOJIS = ["❤️","🔥","💪","👏","🎉","😂","😍","🙏","⚡","🏆","✅","👊"];

function Chat() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [reacting, setReacting] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: conversa } = useQuery({
    queryKey: ["conversa", id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("conversas").select("id, user1_id, user2_id, tipo, equipe_id, nome").eq("id", id).maybeSingle();
      if (!data) return null;
      const isGrupo = data.tipo === "grupo_equipe";
      if (isGrupo && data.equipe_id) {
        const { data: eq } = await (supabase as any).from("equipes").select("id, nome, avatar_url").eq("id", data.equipe_id).maybeSingle();
        return { ...data, isGrupo: true, displayNome: eq?.nome ?? "Grupo", displayAvatar: eq?.avatar_url, online: null };
      }
      const otherId = data.user1_id === user.id ? data.user2_id : data.user1_id;
      const { data: other } = await supabase.from("profiles").select("id, nome, username, avatar_url, nivel").eq("id", otherId).maybeSingle();
      return { ...data, isGrupo: false, other, displayNome: other?.nome ?? "Usuário", displayAvatar: other?.avatar_url, online: true };
    },
  });

  const { data: metaAtiva } = useQuery({
    queryKey: ["meta-ativa-dm", conversa?.other?.id],
    enabled: !!conversa?.other?.id,
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("id, titulo, prazo").eq("user_id", conversa!.other!.id).eq("status", "em_andamento").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: mensagens } = useQuery({
    queryKey: ["mensagens", id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("mensagens").select("*, sender:profiles!mensagens_sender_id_fkey(nome, avatar_url)").eq("conversa_id", id).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    supabase.from("mensagens").update({ lida: true } as any).eq("conversa_id", id).neq("sender_id", user.id).eq("lida", false).then(() => {});
  }, [id, user.id]);

  useEffect(() => {
    const ch = supabase.channel(`mensagens:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["mensagens", id] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mensagens?.length]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    const { error } = await (supabase as any).from("mensagens").insert({ conversa_id: id, sender_id: user.id, texto: t });
    setEnviando(false);
    if (error) return toast.error(error.message);
    setTexto("");
    qc.invalidateQueries({ queryKey: ["mensagens", id] });
    qc.invalidateQueries({ queryKey: ["conversas", user.id] });
  }

  async function enviarMidia(file: File) {
    const isVideo = file.type.startsWith("video/");
    if (!["image/jpeg","image/png","image/webp","video/mp4","video/quicktime","video/webm"].includes(file.type)) return toast.error("Formato não suportado");
    if (file.size > 100 * 1024 * 1024) return toast.error("Arquivo muito grande (máx 100MB)");
    const path = `dm/${id}/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("checkins").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("checkins").getPublicUrl(path);
    await (supabase as any).from("mensagens").insert({ conversa_id: id, sender_id: user.id, texto: isVideo ? "🎥 Vídeo" : "📷 Foto", media_url: data.publicUrl, tipo: isVideo ? "video" : "imagem" });
    qc.invalidateQueries({ queryKey: ["mensagens", id] });
    qc.invalidateQueries({ queryKey: ["conversas", user.id] });
    toast.success("Enviado!");
  }

  async function reagir(msgId: string, emoji: string) {
    await (supabase as any).from("mensagens").update({ reacao: emoji }).eq("id", msgId);
    qc.invalidateQueries({ queryKey: ["mensagens", id] });
    setReacting(null);
  }

  const diasRestantes = metaAtiva?.prazo
    ? Math.max(0, Math.ceil((new Date(metaAtiva.prazo).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <main className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-3 py-3">
          <Link to="/mensagens" className="rounded-full p-1.5 text-muted-foreground hover:bg-card"><ArrowLeft size={20} /></Link>
          <div className="relative h-10 w-10 shrink-0">
            <div className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-primary/40">
              {conversa?.displayAvatar
                ? <img src={conversa.displayAvatar} className="h-full w-full object-cover" alt="" />
                : <div className="flex h-full w-full items-center justify-center bg-gradient-primary text-sm font-bold">{(conversa?.displayNome ?? "?")[0]?.toUpperCase()}</div>}
            </div>
            {!conversa?.isGrupo && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-accent border-2 border-background" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{conversa?.displayNome ?? "Conversa"}</div>
            <div className="text-[11px] text-accent truncate">{conversa?.isGrupo ? "Grupo da equipe" : "Online agora"}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button className="rounded-full p-2 text-muted-foreground hover:bg-card"><Phone size={18} /></button>
            <button className="rounded-full p-2 text-muted-foreground hover:bg-card"><Video size={18} /></button>
            <button className="rounded-full p-2 text-muted-foreground hover:bg-card"><MoreVertical size={18} /></button>
          </div>
        </div>

        {/* Meta banner */}
        {metaAtiva && (
          <div className="mx-auto max-w-md px-3 pb-3">
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
                  <span className="text-primary-light text-sm">✓</span>
                </div>
                <div>
                  <div className="text-[10px] text-primary-light font-semibold">Meta ativa</div>
                  <div className="text-xs font-bold truncate max-w-[180px]">{metaAtiva.titulo}</div>
                </div>
              </div>
              {diasRestantes !== null && (
                <span className="text-xs font-bold text-primary-light">{diasRestantes} dias restantes →</span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-3 py-4 space-y-1">
          {(mensagens ?? []).length === 0 && (
            <div className="pt-10 text-center text-xs text-muted-foreground">Envie a primeira mensagem 👋</div>
          )}
          {(mensagens ?? []).map((m: any, i: number) => {
            const mine = m.sender_id === user.id;
            const showAvatar = !mine && (i === 0 || (mensagens ?? [])[i - 1]?.sender_id !== m.sender_id);
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <div className="w-7 shrink-0">
                    {showAvatar && (
                      <div className="h-7 w-7 rounded-full overflow-hidden">
                        {m.sender?.avatar_url
                          ? <img src={m.sender.avatar_url} className="h-full w-full object-cover" alt="" />
                          : <div className="flex h-full w-full items-center justify-center bg-gradient-primary text-[10px] font-bold">{(m.sender?.nome ?? "?")[0]}</div>}
                      </div>
                    )}
                  </div>
                )}
                <div className="relative max-w-[72%]">
                  {conversa?.isGrupo && !mine && showAvatar && (
                    <div className="text-[10px] font-semibold text-primary-light mb-0.5 ml-1">{m.sender?.nome}</div>
                  )}
                  <button
                    onDoubleClick={() => setReacting(reacting === m.id ? null : m.id)}
                    className={`relative rounded-2xl px-3.5 py-2 text-sm text-left w-full ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}
                  >
                    {/* Mídia */}
                    {m.media_url && m.tipo === "imagem" && (
                      <img src={m.media_url} className="mb-1 w-full max-h-48 rounded-xl object-cover" alt="" />
                    )}
                    {m.media_url && m.tipo === "video" && (
                      <video src={m.media_url} controls playsInline className="mb-1 w-full max-h-48 rounded-xl object-cover" />
                    )}
                    <div className="whitespace-pre-wrap break-words">{m.texto}</div>
                    <div className={`mt-0.5 text-[9px] ${mine ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {mine && " ✓✓"}
                    </div>
                    {m.reacao && (
                      <span className="absolute -bottom-2.5 right-2 text-sm">{m.reacao}</span>
                    )}
                  </button>
                  {reacting === m.id && (
                    <div className="absolute bottom-full mb-1 left-0 z-20 flex gap-1 rounded-2xl border border-border bg-card p-2 shadow-lg flex-wrap max-w-[220px]">
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => reagir(m.id, e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        {showEmojis && (
          <div className="mx-auto max-w-md px-3 py-2 flex flex-wrap gap-2 border-b border-border">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setTexto(t => t + e)} className="text-xl">{e}</button>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-md items-end gap-2 px-3 py-3">
          <label className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground cursor-pointer hover:text-primary-light">
            <Plus size={20} />
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarMidia(f); }} capture={undefined} />
          </label>
          <div className="flex-1 flex items-end rounded-2xl border border-border bg-card overflow-hidden">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              rows={1}
              maxLength={1000}
              placeholder="Digite sua mensagem..."
              className="flex-1 resize-none bg-transparent px-4 py-2.5 text-sm outline-none max-h-32"
            />
            <button onClick={() => setShowEmojis(v => !v)} className="px-2 py-2.5 text-muted-foreground hover:text-primary-light">
              <SmilePlus size={18} />
            </button>
            <label className="px-2 py-2.5 text-muted-foreground hover:text-primary-light cursor-pointer">
              <ImageIcon size={18} />
              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarMidia(f); }} />
            </label>
          </div>
          <button
            onClick={texto.trim() ? enviar : undefined}
            disabled={enviando}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground disabled:opacity-50"
          >
            {texto.trim() ? <Send size={18} /> : <Mic size={18} />}
          </button>
        </div>
      </div>
    </main>
  );
}
