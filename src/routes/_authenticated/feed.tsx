import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { PublishProofModal } from "@/components/PublishProofModal";
import { CommentsModal } from "@/components/CommentsModal";

import { Bell, Wallet, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, BadgeCheck, Camera, Plus, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Tab = "feed" | "seguindo" | "destaques" | "comunidades";

export const Route = createFileRoute("/_authenticated/feed")({
  validateSearch: (s: Record<string, unknown>) => ({ publish: s.publish ? 1 : undefined }),
  component: Feed,
});

function Feed() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("feed");
  const [showPublish, setShowPublish] = useState(false);

  useEffect(() => {
    if (search.publish) { setShowPublish(true); navigate({ to: "/feed", search: {} as any, replace: true }); }
  }, [search.publish]);

  const { data: unread } = useQuery({
    queryKey: ["notif-unread", user.id],
    queryFn: async () => {
      const { count } = await supabase.from("notificacoes").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("lida", false);
      return count ?? 0;
    },
  });

  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ["feed-posts", tab, user.id],
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select("id, user_id, meta_id, media_url, tipo, legenda, hashtags, created_at, profiles:user_id (nome, username, avatar_url), metas:meta_id (titulo, status, progresso)")
        .order("created_at", { ascending: false })
        .limit(30);

      if (tab === "seguindo") {
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", user.id).eq("status", "aceito");
        const ids = (f ?? []).map((x: any) => x.following_id);
        if (!ids.length) return [];
        query = query.in("user_id", ids);
      } else if (tab === "destaques") {
        const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
        query = query.gte("created_at", since);
      } else if (tab === "comunidades") {
        const { data: eq } = await supabase.from("equipe_membros").select("equipe_id").eq("user_id", user.id);
        const eqIds = (eq ?? []).map((x: any) => x.equipe_id);
        if (!eqIds.length) return [];
        const { data: mem } = await supabase.from("equipe_membros").select("user_id").in("equipe_id", eqIds);
        const uids = Array.from(new Set((mem ?? []).map((x: any) => x.user_id)));
        query = query.in("user_id", uids);
      }
      const { data } = await query;
      const list = data ?? [];
      if (tab === "destaques" && list.length) {
        const ids = list.map((p: any) => p.id);
        const [{ data: likes }, { data: comments }] = await Promise.all([
          supabase.from("post_likes").select("post_id").in("post_id", ids),
          supabase.from("post_comments").select("post_id").in("post_id", ids),
        ]);
        const score = new Map<string, number>();
        (likes ?? []).forEach((l: any) => score.set(l.post_id, (score.get(l.post_id) ?? 0) + 1));
        (comments ?? []).forEach((c: any) => score.set(c.post_id, (score.get(c.post_id) ?? 0) + 1));
        return list.sort((a: any, b: any) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0));
      }
      return list;
    },
  });

  const { data: me } = useQuery({
    queryKey: ["profile-me-mini", user.id],
    queryFn: async () => (await supabase.from("profiles").select("avatar_url, nome").eq("id", user.id).single()).data,
  });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto grid max-w-md grid-cols-3 items-center px-5 pt-4 pb-2">
          <div className="justify-self-start"><VyraLogo size={28} showWordmark={false} /></div>
          <div className="justify-self-center"><VyraLogo size={22} showWordmark={true} className="[&>img]:hidden" /></div>
          <div className="justify-self-end flex items-center gap-1">
            <Link to="/notificacoes" className="relative rounded-full p-2 text-foreground/90">
              <Bell size={22} />
              {!!unread && unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />}
            </Link>
            <Link to="/wallet" className="rounded-full p-2 text-primary-light" aria-label="Carteira">
              <Wallet size={22} />
            </Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-md px-3">
          {([["feed", "Feed"], ["seguindo", "Seguindo"], ["destaques", "Destaques"], ["comunidades", "Comunidades"]] as const).map(([k, l]) => {
            const active = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} className={`relative flex-1 py-3 text-xs font-semibold transition-colors ${active ? "text-primary-light" : "text-muted-foreground"}`}>
                {l}
                {active && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-border" />
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <button onClick={() => setShowPublish(true)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left">
          <div className="relative shrink-0">
            {me?.avatar_url ? (
              <img src={me.avatar_url} alt="" className="h-11 w-11 rounded-full border-2 border-primary/60 object-cover" />
            ) : (
              <div className="h-11 w-11 rounded-full border-2 border-primary/60 bg-gradient-primary" />
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card"><Plus size={12} strokeWidth={3} /></span>
          </div>
          <span className="flex-1 text-sm text-muted-foreground">Compartilhe uma prova. Inspire credibilidade.</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><Camera size={18} /></div>
        </button>

        {isLoading && [1, 2].map(i => <div key={i} className="h-96 animate-pulse rounded-2xl bg-card" />)}
        {!isLoading && (!posts || posts.length === 0) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {tab === "seguindo" ? "Você ainda não segue ninguém." : tab === "comunidades" ? "Entre em uma equipe para ver publicações." : "Nenhuma publicação ainda. Compartilhe sua primeira prova!"}
            </p>
          </div>
        )}
        {posts?.map((p: any) => <PostCard key={p.id} post={p} userId={user.id} onChange={() => qc.invalidateQueries({ queryKey: ["feed-posts"] })} />)}
      </div>

      {showPublish && <PublishProofModal userId={user.id} onClose={() => setShowPublish(false)} onPublished={() => refetch()} />}

      <BottomNav onPublish={() => setShowPublish(true)} />
    </main>
  );
}

function PostCard({ post, userId, onChange }: { post: any; userId: string; onChange: () => void }) {
  const [showComments, setShowComments] = useState(false);

  const p = post.profiles;
  const m = post.metas;
  const initial = (p?.nome || p?.username || "?")[0].toUpperCase();

  const { data: stats, refetch } = useQuery({
    queryKey: ["post-stats", post.id, userId],
    queryFn: async () => {
      const [{ count: likes }, { count: comments }, { data: myLike }, { data: mySave }, { data: follow }] = await Promise.all([
        supabase.from("post_likes").select("*", { count: "exact", head: true }).eq("post_id", post.id),
        supabase.from("post_comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
        supabase.from("post_likes").select("id").eq("post_id", post.id).eq("user_id", userId).maybeSingle(),
        supabase.from("post_saves").select("id").eq("post_id", post.id).eq("user_id", userId).maybeSingle(),
        post.user_id !== userId ? supabase.from("follows").select("id, status").eq("follower_id", userId).eq("following_id", post.user_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      return { likes: likes ?? 0, comments: comments ?? 0, liked: !!myLike, saved: !!mySave, following: follow?.status === "aceito" };
    },
  });

  async function toggleLike() {
    if (stats?.liked) await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
    else await supabase.from("post_likes").insert({ post_id: post.id, user_id: userId });
    refetch();
  }
  async function toggleSave() {
    if (stats?.saved) await supabase.from("post_saves").delete().eq("post_id", post.id).eq("user_id", userId);
    else await supabase.from("post_saves").insert({ post_id: post.id, user_id: userId });
    refetch();
  }
  async function toggleFollow() {
    if (post.user_id === userId) return;
    if (stats?.following) await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", post.user_id);
    else await supabase.from("follows").insert({ follower_id: userId, following_id: post.user_id, status: "aceito" });
    refetch();
    onChange();
  }
  function share() {
    const url = `${window.location.origin}/meta/${post.meta_id ?? ""}`;
    if (navigator.share) navigator.share({ title: post.legenda ?? "VRENN", url }).catch(() => {});
    else { navigator.clipboard.writeText(url); toast.success("Link copiado"); }
  }

  const isVideo = post.tipo === "video";
  const cumprido = m?.status === "concluida";

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        {p?.username ? (
          <Link to="/u/$username" params={{ username: p.username }} className="shrink-0">
            {p.avatar_url ? (
              <img src={p.avatar_url} className="h-11 w-11 rounded-full border-2 border-primary/60 object-cover" alt="" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold text-primary-foreground">{initial}</div>
            )}
          </Link>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/60 bg-gradient-primary text-sm font-bold text-primary-foreground">{initial}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {p?.username ? (
              <Link to="/u/$username" params={{ username: p.username }} className="text-sm font-bold truncate hover:underline">{p?.nome ?? "Usuário"}</Link>
            ) : (
              <span className="text-sm font-bold truncate">{p?.nome ?? "Usuário"}</span>
            )}
            <BadgeCheck size={14} className="text-primary-light" />
          </div>
          <div className="text-xs text-muted-foreground">@{p?.username ?? "—"} · {formatWhen(post.created_at)}</div>
        </div>
        {post.user_id !== userId && (
          <button onClick={toggleFollow} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${stats?.following ? "border-primary bg-primary text-primary-foreground" : "border-primary text-primary-light"}`}>
            {stats?.following ? "Seguindo" : "Seguir"}
          </button>
        )}
        <button className="text-muted-foreground"><MoreHorizontal size={18} /></button>
      </div>

      {m && (
        <Link to="/meta/$id" params={{ id: post.meta_id }} className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">🔒 Compromisso:</span>
          <span className="font-semibold truncate">{m.titulo}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cumprido ? "text-accent" : "text-amber-400"}`}>
            {cumprido ? <><CheckCircle2 size={11} /> Cumprido</> : <><Clock size={11} /> Em andamento</>}
          </span>
        </Link>
      )}

      {post.media_url && (
        <div className="relative mt-3 aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black">
          {isVideo ? (
            <video src={post.media_url} controls playsInline className="h-full w-full object-cover object-center" />
          ) : (
            <img src={post.media_url} className="h-full w-full object-cover object-center" alt="" />
          )}
          {m?.progresso != null && (
            <span className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-white">{m.progresso}%</span>
          )}
        </div>
      )}

      {post.legenda && (
        <div className="mt-3">
          <p className="text-sm leading-snug">
            <span className="font-bold">{post.legenda.split("\n")[0]}</span>
            {post.legenda.includes("\n") && <><br /><span className="text-muted-foreground">{post.legenda.split("\n").slice(1).join("\n")}</span></>}
          </p>
        </div>
      )}

      {post.hashtags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium text-primary-light">
          {post.hashtags.map((h: string, i: number) => <span key={i}>{h}</span>)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-5 border-t border-border pt-3">
        <button onClick={toggleLike} className="flex items-center gap-1.5 text-sm">
          <Heart size={20} className={stats?.liked ? "fill-rose-500 text-rose-500" : "text-foreground"} />
          <span className="font-semibold">{stats?.likes ?? 0}</span>
        </button>
        <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 text-sm text-foreground">
          <MessageCircle size={20} />
          <span className="font-semibold">{stats?.comments ?? 0}</span>
        </button>
        <button onClick={share} className="flex items-center gap-1.5 text-sm text-foreground">
          <Send size={20} />
        </button>
        <button onClick={toggleSave} className="ml-auto">
          <Bookmark size={20} className={stats?.saved ? "fill-primary-light text-primary-light" : "text-foreground"} />
        </button>
      </div>
      {showComments && <CommentsModal postId={post.id} userId={userId} onClose={() => setShowComments(false)} onCountChange={() => refetch()} />}
    </article>
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
