import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Heart, MessageCircle, BadgeCheck, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { CommentsModal } from "@/components/CommentsModal";

export const Route = createFileRoute("/_authenticated/post/$id")({
  component: PostDetail,
});

function PostDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["post-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, user_id, meta_id, media_url, tipo, legenda, hashtags, created_at, profiles:user_id (nome, username, avatar_url), metas:meta_id (titulo, status, progresso)")
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

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate({ to: "/feed" })} className="rounded-full bg-white/10 p-2"><ArrowLeft size={20} /></button>
        <span className="text-sm font-semibold">Publicação</span>
        <div className="w-9" />
      </header>

      <div className="flex-1 flex items-center justify-center px-2 bg-black">
        {post.media_url ? (
          isVideo ? (
            <video src={post.media_url} controls autoPlay playsInline className="max-h-[70vh] max-w-full object-contain" />
          ) : (
            <img src={post.media_url} className="max-h-[70vh] max-w-full object-contain" alt="" />
          )
        ) : null}
      </div>

      <div className="px-4 py-4 space-y-3 bg-black">
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
    </main>
  );
}
