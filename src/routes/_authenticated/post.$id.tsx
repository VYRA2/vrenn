import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Heart, MessageCircle, BadgeCheck, CheckCircle2, Clock, MoreHorizontal, Send, Pencil, Trash2, Trophy, Swords } from "lucide-react";
import { useState } from "react";
import { CommentsModal } from "@/components/CommentsModal";
import { toast } from "sonner";
import { shareToInstagram } from "@/lib/shareToInstagram";
import { ShareSheet, EditLegendaModal, ConfirmDialog } from "./feed";

export const Route = createFileRoute("/_authenticated/post/$id")({
  component: PostDetail,
});

function PostDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: post, isLoading, refetch } = useQuery({
    queryKey: ["post-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, user_id, meta_id, media_url, tipo, legenda, hashtags, created_at, auto_gerado, profiles:user_id (nome, username, avatar_url), metas:meta_id (titulo, status, progresso)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["post-detail-stats", id],
    queryFn: async () => {
      const [{ count: likes }, { count: comments }] = await Promise.all([
        supabase.from("post_likes").select("*", { count: "exact", head: true }).eq("post_id", id),
        supabase.from("post_comments").select("*", { count: "exact", head: true }).eq("post_id", id),
      ]);
      return { likes: likes ?? 0, comments: comments ?? 0 };
    },
  });

  if (isLoading) return <main className="min-h-screen bg-background" />;
  if (!post) return <main className="min-h-screen bg-background text-foreground flex items-center justify-center">Publicação não encontrada.</main>;

  const p: any = post.profiles;
  const m: any = post.metas;
  const isVideo = post.tipo === "video";
  const initial = (p?.nome || p?.username || "?")[0].toUpperCase();
  const cumprido = m?.status === "concluida";
  const isOwner = post.user_id === user.id;
  const isConquistaMeta = post.tipo === "conquista_meta" && post.auto_gerado;
  const isConquistaDuelo = post.tipo === "conquista_duelo" && post.auto_gerado;
  const isConquista = isConquistaMeta || isConquistaDuelo;

  function copyLink() {
    const url = `${window.location.origin}/post/${post!.id}`;
    if (navigator.share) navigator.share({ title: post!.legenda ?? "VRENN", url }).catch(() => {});
    else { navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    setShowShare(false);
  }
  async function excluir() {
    setBusy(true);
    const { error } = await supabase.from("posts").delete().eq("id", post!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Post excluído");
    navigate({ to: "/feed" });
  }
  async function salvarLegenda(nova: string) {
    setBusy(true);
    const { error } = await supabase.from("posts").update({ legenda: nova }).eq("id", post!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Legenda atualizada");
    setShowEdit(false);
    refetch();
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate({ to: "/feed" })} className="rounded-full bg-white/10 p-2"><ArrowLeft size={20} /></button>
        <span className="text-sm font-semibold">Publicação</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowShare(true)} className="rounded-full bg-white/10 p-2"><Send size={18} /></button>
          {isOwner && (
            <div className="relative">
              <button onClick={() => setShowMenu((v) => !v)} className="rounded-full bg-white/10 p-2"><MoreHorizontal size={18} /></button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-11 z-40 w-48 rounded-2xl border border-border bg-card p-1 shadow-glow text-foreground">
                    {!post.auto_gerado && (
                      <button onClick={() => { setShowMenu(false); setShowEdit(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"><Pencil size={14} /> Editar legenda</button>
                    )}
                    <button onClick={() => { setShowMenu(false); setShowDelete(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-400 hover:bg-secondary"><Trash2 size={14} /> Excluir post</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-2 bg-black">
        {post.media_url ? (
          isVideo ? (
            <video src={post.media_url} controls autoPlay playsInline className="max-h-[70vh] max-w-full object-contain" />
          ) : (
            <img src={post.media_url} className="max-h-[70vh] max-w-full object-contain" alt="" />
          )
        ) : isConquista ? (
          <div className="w-full max-w-md aspect-[4/5] rounded-2xl bg-gradient-to-br from-[#1a0f2e] via-[#2a0f3e] to-[#0F0F17] flex flex-col items-center justify-center text-center px-6">
            <Trophy size={96} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
            <div className="mt-4 text-2xl font-black">{m?.titulo ?? post.legenda ?? "Conquista"}</div>
            <div className="mt-2 text-sm text-white/70 inline-flex items-center gap-1">
              {isConquistaMeta ? <><Trophy size={14} /> Meta concluída</> : <><Swords size={14} /> Duelo vencido</>}
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-4 py-4 space-y-3 bg-black">
        {isConquista && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-primary/20 border border-yellow-500/40 px-3 py-1 text-[11px] font-bold text-yellow-300">
            {isConquistaMeta ? <><Trophy size={12} /> Meta concluída!</> : <><Swords size={12} /> Duelo vencido!</>}
          </div>
        )}
        <div className="flex items-center gap-3">
          {p?.username ? (
            <Link to="/u/$username" params={{ username: p.username }} className="shrink-0">
              {p.avatar_url ? (
                <img src={p.avatar_url} className="h-10 w-10 rounded-full border border-primary/60 object-cover" alt="" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold">{initial}</div>
              )}
            </Link>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold">{initial}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold truncate">{p?.nome ?? "Usuário"}</span>
              <BadgeCheck size={14} className="text-primary-light" />
            </div>
            <div className="text-xs text-white/60">@{p?.username ?? "—"}</div>
          </div>
        </div>

        {m && post.meta_id && (
          <Link to="/meta/$id" params={{ id: post.meta_id }} className="flex items-center gap-2 text-xs">
            <span className="text-white/60">🔒 Compromisso:</span>
            <span className="font-semibold truncate">{m.titulo}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cumprido ? "text-accent" : "text-amber-400"}`}>
              {cumprido ? <><CheckCircle2 size={11} /> Cumprido</> : <><Clock size={11} /> Em andamento</>}
            </span>
          </Link>
        )}

        {post.legenda && <p className="text-sm leading-snug whitespace-pre-line">{post.legenda}</p>}

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium text-primary-light">
            {post.hashtags.map((h: string, i: number) => <span key={i}>{h}</span>)}
          </div>
        )}

        <div className="flex items-center gap-5 border-t border-white/10 pt-3 text-sm">
          <span className="inline-flex items-center gap-1.5"><Heart size={18} /> {stats?.likes ?? 0}</span>
          <button onClick={() => setShowComments(true)} className="inline-flex items-center gap-1.5"><MessageCircle size={18} /> {stats?.comments ?? 0}</button>
        </div>
      </div>

      {showComments && <CommentsModal postId={post.id} userId={user.id} onClose={() => setShowComments(false)} onCountChange={() => {}} />}
      {showShare && (
        <ShareSheet
          onClose={() => setShowShare(false)}
          onCopyLink={copyLink}
          onInstagram={async () => {
            setShowShare(false);
            await shareToInstagram({ mediaUrl: post.media_url, userName: p?.nome ?? p?.username ?? "Usuário", legenda: post.legenda, metaTitulo: m?.titulo });
          }}
        />
      )}
      {showEdit && <EditLegendaModal initial={post.legenda ?? ""} busy={busy} onClose={() => setShowEdit(false)} onSave={salvarLegenda} />}
      {showDelete && <ConfirmDialog title="Excluir post" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" busy={busy} onClose={() => setShowDelete(false)} onConfirm={excluir} />}
    </main>
  );
}
