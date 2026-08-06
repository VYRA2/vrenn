/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/stories/$id")({
  component: StoryViewer,
});

function StoryViewer() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const { data: story, isLoading } = useQuery({
    queryKey: ["story", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stories")
        .select(
          "id, user_id, media_url, media_type, text_content, bg_gradient, created_at, expires_at, profiles:user_id(nome, username, avatar_url)",
        )
        .eq("id", id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!story) return;
    (supabase as any)
      .from("story_views")
      .upsert(
        { story_id: story.id, viewer_id: user.id },
        { onConflict: "story_id,viewer_id", ignoreDuplicates: true },
      );

    if (!story.media_url) {
      setMediaUrl(null);
      return;
    }
    if (story.media_url.startsWith("http")) {
      setMediaUrl(story.media_url);
      return;
    }
    const seconds = Math.max(
      30,
      Math.min(300, Math.floor((new Date(story.expires_at).getTime() - Date.now()) / 1000)),
    );
    supabase.storage
      .from("stories")
      .createSignedUrl(story.media_url, seconds)
      .then(({ data }) => setMediaUrl(data?.signedUrl ?? null));
  }, [story, user.id]);

  if (isLoading)
    return (
      <main className="grid min-h-screen place-items-center bg-black">
        <Loader2 className="animate-spin text-white" />
      </main>
    );
  if (!story)
    return (
      <main className="grid min-h-screen place-items-center bg-black px-6 text-center text-white">
        <div>
          <Clock className="mx-auto mb-4" />
          <h1 className="text-xl font-bold">Story indisponível</h1>
          <p className="mt-2 text-sm text-white/60">Ele expirou ou você não tem acesso.</p>
          <Link
            to="/feed"
            search={{}}
            className="mt-6 inline-block rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
          >
            Voltar ao feed
          </Link>
        </div>
      </main>
    );

  const profile = Array.isArray(story.profiles) ? story.profiles[0] : story.profiles;
  return (
    <main className="relative mx-auto flex min-h-screen max-w-lg flex-col overflow-hidden bg-black text-white">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent p-4 pt-6">
        <Link to="/feed" search={{}} aria-label="Voltar" className="rounded-full bg-black/30 p-2">
          <ArrowLeft size={20} />
        </Link>
        <img
          src={profile?.avatar_url || "/placeholder.svg"}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
        />
        <div>
          <p className="text-sm font-semibold">{profile?.nome || "Usuário"}</p>
          <p className="text-xs text-white/65">@{profile?.username || "vrenn"}</p>
        </div>
      </header>
      {story.media_type === "text" ? (
        <section
          className="flex min-h-screen items-center justify-center p-10 text-center"
          style={{ background: story.bg_gradient || "linear-gradient(135deg,#7C3AED,#C026D3)" }}
        >
          <p className="text-3xl font-bold leading-snug">{story.text_content}</p>
        </section>
      ) : story.media_type === "video" ? (
        mediaUrl ? (
          <video
            src={mediaUrl}
            autoPlay
            controls
            playsInline
            className="h-screen w-full object-contain"
          />
        ) : null
      ) : mediaUrl ? (
        <img src={mediaUrl} alt="Story" className="h-screen w-full object-contain" />
      ) : null}
    </main>
  );
}
