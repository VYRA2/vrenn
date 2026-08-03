import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { VyraLogo } from "@/components/VyraLogo";
import { PublishProofModal } from "@/components/PublishProofModal";
import { CommentsModal } from "@/components/CommentsModal";
import { StoriesBar } from "@/components/StoriesBar";

import { shareToInstagram } from "@/lib/shareToInstagram";

import { Bell, Wallet, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Camera, Plus, CheckCircle2, Clock, X, ExternalLink, Trophy, Swords, Pencil, Trash2, Instagram, Loader2, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { subscribeToPush, isPushSupported } from "@/lib/push";

type Tab = "feed" | "seguindo";

export const Route = createFileRoute("/_authenticated/feed")({
  validateSearch: (s: Record<string, unknown>) => ({
    publish: s.publish ? 1 : undefined,
    tab: (["feed","seguindo"].includes(s.tab as string) ? s.tab : undefined) as Tab | undefined,
  }),
  component: Feed,
});

function Feed() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(search.tab ?? "feed");
  const [showPublish, setShowPublish] = useState(false);

  // Registrar device para push notifications — uma vez por sessão
  useEffect(() => {
    if (!user?.id || !isPushSupported()) return;
    const key = `push_registered_${user.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    subscribeToPush(user.id).then((r) => {
      if (r.ok) console.log("Push registrado ✓");
    }).catch(() => {});
  }, [user?.id]);

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
    queryKey: ["feed-posts", user.id, tab],
    queryFn: async () => {
      let authorIds: string[] | null = null;

      if (tab === "seguindo") {
        // Aba "Seguindo": apenas quem eu sigo + eu
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .eq("status", "aceito");
        const followingIds = (follows ?? []).map((x: any) => x.following_id);
        authorIds = [...followingIds, user.id];
      }
      // Aba padrão "feed" (Comunidade): mostra posts de TODOS os perfis públicos
      // Não filtra por author — RLS da tabela posts já cuida da visibilidade pública.

      let query = supabase
        .from("posts")
        .select("id, user_id, meta_id, media_url, tipo, legenda, hashtags, created_at, auto_gerado, likes_count, comments_count, profiles:user_id (nome, username, avatar_url, perfil_publico), metas:meta_id (titulo, status, progresso)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (authorIds) query = query.in("user_id", authorIds);

      const { data } = await query;
      // No feed público, remove posts de perfis privados que não sigo
      if (!authorIds) {
        return (data ?? []).filter((p: any) => p.profiles?.perfil_publico !== false);
      }
      return data ?? [];
    },
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // atualização a cada 30s
  });

  // Realtime — atualiza feed em qualquer INSERT/UPDATE de posts
  const channelRef = useRef<any>(null);
  useEffect(() => {
    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        refetch();
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, tab]);



  const { data: me } = useQuery({
    queryKey: ["profile-me-mini", user.id],
    queryFn: async () => (await supabase.from("profiles").select("avatar_url, nome").eq("id", user.id).single()).data,
  });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto grid max-w-md grid-cols-3 items-center px-5 pt-4 pb-2">
          <div className="justify-self-start"><VyraLogo size={28} showWordmark={false} /></div>
          <div className="justify-self-center text-base font-bold tracking-widest text-foreground">VRENN</div>
          <div className="justify-self-end flex items-center gap-1">
            <Link to="/mensagens" className="rounded-full p-2 text-foreground/90" aria-label="Mensagens">
              <MessageCircle size={22} />
            </Link>
            <Link to="/notificacoes" aria-label="Notificações" className="relative rounded-full p-2 text-foreground/90">
              <Bell size={22} />
              {!!unread && unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />}
            </Link>

            <Link to="/wallet" className="rounded-full p-2 text-primary-light" aria-label="Carteira">
              <Wallet size={22} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md">
        <StoriesBar userId={user.id} />
        <nav className="flex gap-3 px-4 py-3" aria-label="Filtros do feed">

          {([{ id: "feed", label: "Para você" }, { id: "seguindo", label: "Seguindo" }] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-all duration-200 ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-md py-4">
        <h1 className="sr-only">Feed de evolução</h1>


        {isLoading && <div className="space-y-4 px-4">{[1, 2].map(i => <div key={i} className="h-96 animate-pulse rounded-2xl bg-card" />)}</div>}
        {!isLoading && (!posts || posts.length === 0) && (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <Camera size={48} className="text-muted-foreground" />
            <h2 className="text-lg font-bold">Ninguém publicou ainda.</h2>
            <p className="text-sm text-muted-foreground">Seja o primeiro a mostrar que está na corrida.</p>
            <button
              onClick={() => setShowPublish(true)}
              className="mt-2 rounded-2xl bg-gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow"
            >
              Publicar agora
            </button>
          </div>
        )}
        {posts?.map((p: any) => (
          <div key={p.id} className="px-4 mb-3">
            <PostCard post={p} userId={user.id} onChange={() => qc.invalidateQueries({ queryKey: ["feed-posts"] })} />
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowPublish(true)}
        aria-label="Publicar prova"
        className="fixed bottom-24 right-5 z-40 rounded-full bg-gradient-primary p-4 text-primary-foreground shadow-glow"
      >
        <Camera size={22} />
      </button>


      {showPublish && <PublishProofModal userId={user.id} onClose={() => setShowPublish(false)} onPublished={() => refetch()} />}

      <BottomNav onPublish={() => setShowPublish(true)} />
    </main>
  );
}

function PostCard({ post, userId, onChange }: { post: any; userId: string; onChange: () => void }) {
  const [showComments, setShowComments] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const p = post.profiles;
  const m = post.metas;
  const initial = (p?.nome || p?.username || "?")[0].toUpperCase();
  const isOwner = post.user_id === userId;
  const isConquistaMeta = post.tipo === "conquista_meta" && post.auto_gerado;
  const isConquistaDuelo = post.tipo === "conquista_duelo" && post.auto_gerado;
  const isConquista = isConquistaMeta || isConquistaDuelo;

  const { data: stats, refetch } = useQuery({
    queryKey: ["post-stats", post.id, userId],
    queryFn: async () => {
      // likes e comments vêm dos contadores do post — sem queries extras
      const [{ data: myLike }, { data: mySave }, { data: follow }] = await Promise.all([
        supabase.from("post_likes").select("id").eq("post_id", post.id).eq("user_id", userId).maybeSingle(),
        supabase.from("post_saves").select("id").eq("post_id", post.id).eq("user_id", userId).maybeSingle(),
        post.user_id !== userId ? supabase.from("follows").select("id, status").eq("follower_id", userId).eq("following_id", post.user_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      return { likes: post.likes_count ?? 0, comments: post.comments_count ?? 0, liked: !!myLike, saved: !!mySave, following: follow?.status === "aceito" };
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
  function copyLink() {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) navigator.share({ title: post.legenda ?? "VRENN", url }).catch(() => {});
    else { navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    setShowShare(false);
  }
  async function excluir() {
    setBusy(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Post excluído");
    setShowDelete(false);
    onChange();
  }
  async function salvarLegenda(nova: string) {
    setBusy(true);
    const { error } = await supabase.from("posts").update({ legenda: nova }).eq("id", post.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Legenda atualizada");
    setShowEdit(false);
    onChange();
  }

  const isVideo = post.tipo === "video";
  const cumprido = m?.status === "concluida";

  const cardBorder = isConquista
    ? "border-transparent bg-gradient-to-br from-yellow-500/40 to-primary/40"
    : "border-border bg-card";

  return (
    <article className={`rounded-2xl p-4 ${isConquista ? "" : "border"} ${cardBorder}`}>

      {isConquista && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-500/20 to-primary/20 border border-yellow-500/40 px-3 py-1 text-[11px] font-bold text-yellow-300">
          {isConquistaMeta ? <><Trophy size={12} /> Meta concluída!</> : <><Swords size={12} /> Duelo vencido!</>}
        </div>
      )}
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
          </div>
          <div className="text-xs text-muted-foreground">@{p?.username ?? "—"} · {formatWhen(post.created_at)}</div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu((v) => !v)} aria-label="Opções da publicação" className="text-muted-foreground"><MoreHorizontal size={18} /></button>
          {showMenu && isOwner && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-6 z-40 w-48 rounded-2xl border border-border bg-card p-1 shadow-glow">
                {!post.auto_gerado && (
                  <button onClick={() => { setShowMenu(false); setShowEdit(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"><Pencil size={14} /> Editar legenda</button>
                )}
                <button onClick={() => { setShowMenu(false); setShowDelete(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-400 hover:bg-secondary"><Trash2 size={14} /> Excluir post</button>
              </div>
            </>
          )}
        </div>
      </div>

      {m && (
        <Link to="/meta/$id" params={{ id: post.meta_id }} className="mt-3 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary-light uppercase tracking-wide shrink-0">META</span>
          <span className="font-semibold truncate">{m.titulo}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${cumprido ? "text-accent" : "text-amber-400"}`}>
            {cumprido ? <><CheckCircle2 size={11} /> Cumprido</> : <><Clock size={11} /> Em andamento</>}
          </span>
        </Link>
      )}

      {post.media_url ? (
        <button type="button" onClick={() => setShowMedia(true)} className="relative mt-3 aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black block">
          {isVideo ? (
            <video src={post.media_url} playsInline muted autoPlay loop className="h-full w-full object-cover object-center cursor-pointer" />
          ) : (
            <img src={post.media_url} className="h-full w-full object-cover object-center" alt="" />
          )}
          {m?.progresso != null && (
            <span className="absolute top-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-white">{m.progresso}%</span>
          )}
        </button>
      ) : isConquista ? (
        <button type="button" onClick={() => navigate({ to: "/post/$id", params: { id: post.id } })} className="mt-3 aspect-[4/5] w-full overflow-hidden rounded-2xl block relative bg-gradient-to-br from-[#1a0f2e] via-[#2a0f3e] to-[#0F0F17]">
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <Trophy size={72} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
            <div className="mt-4 text-lg font-black text-white">{m?.titulo ?? post.legenda ?? "Conquista"}</div>
            <div className="mt-2 text-xs text-white/70">{isConquistaMeta ? "Meta concluída" : "Duelo vencido"}</div>
          </div>
        </button>
      ) : null}

      {isConquista && (
        <button onClick={() => navigate({ to: "/post/$id", params: { id: post.id } })} className="mt-3 w-full rounded-xl bg-gradient-to-r from-yellow-500/20 to-primary/20 border border-yellow-500/40 py-2.5 text-xs font-bold text-yellow-200">
          Ver conquista completa
        </button>
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
          <Heart size={24} className={stats?.liked ? "fill-rose-500 text-rose-500" : "text-foreground/80"} />
          <span className="font-semibold">{stats?.likes ?? 0}</span>
        </button>
        <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 text-sm text-foreground/80">
          <MessageCircle size={24} />
          <span className="font-semibold">{stats?.comments ?? 0}</span>
        </button>
        <button onClick={() => setShowShare(true)} className="flex items-center gap-1.5 text-sm text-foreground/80">
          <Send size={24} />
        </button>
        <button onClick={toggleSave} className="ml-auto">
          <Bookmark size={24} className={stats?.saved ? "fill-primary-light text-primary-light" : "text-foreground/80"} />
        </button>
      </div>

      {showComments && <CommentsModal postId={post.id} userId={userId} onClose={() => setShowComments(false)} onCountChange={() => refetch()} />}
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
      {showEdit && (
        <EditLegendaModal initial={post.legenda ?? ""} busy={busy} onClose={() => setShowEdit(false)} onSave={salvarLegenda} />
      )}
      {showDelete && (
        <ConfirmDialog title="Excluir post" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" busy={busy} onClose={() => setShowDelete(false)} onConfirm={excluir} />
      )}
      {showMedia && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black" onClick={() => setShowMedia(false)}>
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => navigate({ to: "/post/$id", params: { id: post.id } })} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <ExternalLink size={14} /> Ver post
            </button>
            <button onClick={() => setShowMedia(false)} className="rounded-full bg-white/10 p-2"><X size={20} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
            {isVideo ? (
              <video src={post.media_url} controls playsInline className="max-h-full max-w-full object-contain rounded-xl" />
            ) : (
              <img src={post.media_url} className="max-h-full max-w-full object-contain" alt="" />
            )}
          </div>
          <div className="px-4 py-4 text-white text-sm space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              {p?.avatar_url ? (
                <img src={p.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold">{initial}</div>
              )}
              <span className="font-bold">{p?.nome ?? "Usuário"}</span>
              <span className="text-white/60 text-xs">@{p?.username ?? "—"}</span>
            </div>
            {post.legenda && <p className="text-sm leading-snug whitespace-pre-line">{post.legenda}</p>}
            <div className="flex items-center gap-4 text-xs text-white/80 pt-1">
              <span className="inline-flex items-center gap-1"><Heart size={14} /> {stats?.likes ?? 0}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle size={14} /> {stats?.comments ?? 0}</span>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export function ShareSheet({ onClose, onCopyLink, onInstagram }: { onClose: () => void; onCopyLink: () => void; onInstagram: () => void | Promise<void> }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
        <h3 className="text-sm font-bold mb-2">Compartilhar</h3>
        <button onClick={onInstagram} className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white"><Instagram size={18} /></div>
          <div className="flex-1">
            <div className="text-sm font-bold">Compartilhar no Instagram</div>
            <div className="text-[11px] text-muted-foreground">Gera um card 1080×1920 pronto pros Stories.</div>
          </div>
        </button>
        <button onClick={onCopyLink} className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary-light"><Link2 size={18} /></div>
          <div className="flex-1">
            <div className="text-sm font-bold">Copiar link</div>
            <div className="text-[11px] text-muted-foreground">Compartilhe o link direto do post.</div>
          </div>
        </button>
        <button onClick={onClose} className="w-full py-2 text-sm font-semibold text-muted-foreground">Fechar</button>
      </div>
    </div>
  );
}

export function EditLegendaModal({ initial, busy, onClose, onSave }: { initial: string; busy: boolean; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Editar legenda</h3>
          <button onClick={onClose} className="text-muted-foreground"><X size={18} /></button>
        </div>
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={5} className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold">Cancelar</button>
          <button onClick={() => onSave(v)} disabled={busy} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, busy, onClose, onConfirm }: { title: string; message: string; confirmLabel: string; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold">Cancelar</button>
          <button onClick={onConfirm} disabled={busy} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
          </button>
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
  if (d <= 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}



