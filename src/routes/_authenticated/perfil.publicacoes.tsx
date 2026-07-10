import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Heart, MessageCircle, Video } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil/publicacoes")({
  component: MinhasPublicacoes,
});

type Filtro = "todas" | "foto" | "video" | "texto";

function MinhasPublicacoes() {
  const { user } = Route.useRouteContext();
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["perfil-publicacoes", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, media_url, tipo, legenda, titulo, meta_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const list = data ?? [];
      if (!list.length) return [];
      const ids = list.map((p: any) => p.id);
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from("post_likes").select("post_id").in("post_id", ids),
        supabase.from("post_comments").select("post_id").in("post_id", ids),
      ]);
      const likeMap = new Map<string, number>();
      const cmtMap = new Map<string, number>();
      (likes ?? []).forEach((l: any) => likeMap.set(l.post_id, (likeMap.get(l.post_id) ?? 0) + 1));
      (comments ?? []).forEach((c: any) => cmtMap.set(c.post_id, (cmtMap.get(c.post_id) ?? 0) + 1));
      return list.map((p: any) => ({ ...p, likes: likeMap.get(p.id) ?? 0, comments: cmtMap.get(p.id) ?? 0 }));
    },
  });

  const filtradas = (posts ?? []).filter((p: any) => {
    if (filtro === "todas") return true;
    if (filtro === "texto") return !p.media_url;
    return p.tipo === filtro;
  });

  const tabs: { id: Filtro; label: string }[] = [
    { id: "todas", label: "Todas" },
    { id: "foto", label: "Fotos" },
    { id: "video", label: "Vídeos" },
    { id: "texto", label: "Textos" },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/perfil" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="flex-1 text-base font-bold text-center">Minhas publicações</h1>
          <div className="w-8" />
        </div>
        <div className="mx-auto flex max-w-md gap-2 px-4 pb-3 overflow-x-auto">
          {tabs.map((t) => {
            const active = filtro === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFiltro(t.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${active ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-border" />
      </header>

      <div className="mx-auto max-w-md px-3 pt-3">
        {isLoading && <div className="grid grid-cols-3 gap-1">{[...Array(9)].map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-card" />)}</div>}
        {!isLoading && filtradas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma publicação {filtro !== "todas" ? "desse tipo" : "ainda"}.
          </div>
        )}
        {!isLoading && filtradas.length > 0 && (
          <div className="grid grid-cols-3 gap-1">
            {filtradas.map((p: any) => (
              <PostGridItem key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function PostGridItem({ post }: { post: any }) {
  const content = (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-card">
      {post.media_url ? (
        post.tipo === "video" ? (
          <>
            <video src={post.media_url} muted playsInline className="h-full w-full object-cover object-center" />
            <span className="absolute top-1.5 left-1.5 rounded-md bg-black/60 p-1 text-white"><Video size={12} /></span>
          </>
        ) : (
          <img src={post.media_url} alt="" className="h-full w-full object-cover object-center" />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-primary p-2 text-center">
          <p className="text-[11px] font-bold text-primary-foreground line-clamp-4">
            {post.titulo ?? post.legenda?.slice(0, 60) ?? "Publicação"}
          </p>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-[10px] font-semibold text-white">
        <span className="inline-flex items-center gap-0.5"><Heart size={10} /> {post.likes}</span>
        <span className="inline-flex items-center gap-0.5"><MessageCircle size={10} /> {post.comments}</span>
      </div>
    </div>
  );

  if (post.meta_id) {
    return <Link to="/meta/$id" params={{ id: post.meta_id }} className="block">{content}</Link>;
  }
  return <div>{content}</div>;
}
