import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cleanup-source",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "missing_server_configuration" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = new Date().toISOString();

  try {
    // Evita execuções concorrentes e limita chamadas repetidas ao endpoint público.
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_story_cleanup_run",
      { min_interval_seconds: 300 },
    );

    if (claimError) throw claimError;

    if (!claimed) {
      return jsonResponse({ ok: true, skipped: "cleanup_already_running_or_recent" }, 202);
    }

    let expiredStoriesDeleted = 0;
    let batches = 0;

    // Remove registros vencidos em lotes. O trigger do banco coloca os caminhos
    // de mídia na fila antes de cada DELETE.
    while (batches < 10) {
      const { data: expiredStories, error: selectError } = await supabase
        .from("stories")
        .select("id")
        .lte("expires_at", new Date().toISOString())
        .limit(500);

      if (selectError) throw selectError;
      if (!expiredStories?.length) break;

      const ids = expiredStories.map((story) => story.id);
      const { count, error: deleteError } = await supabase
        .from("stories")
        .delete({ count: "exact" })
        .in("id", ids);

      if (deleteError) throw deleteError;

      expiredStoriesDeleted += count ?? ids.length;
      batches += 1;

      if (ids.length < 500) break;
    }

    const { data: queuedFiles, error: queueError } = await supabase
      .from("story_storage_cleanup_queue")
      .select("id, object_path, attempts")
      .is("processed_at", null)
      .lt("attempts", 5)
      .order("queued_at", { ascending: true })
      .limit(500);

    if (queueError) throw queueError;

    const queue = queuedFiles ?? [];
    const uniquePaths = [...new Set(queue.map((item) => item.object_path).filter(Boolean))];
    let storageFilesDeleted = 0;
    let storageErrorMessage: string | null = null;

    if (uniquePaths.length > 0) {
      const { data: removedFiles, error: storageError } = await supabase.storage
        .from("stories")
        .remove(uniquePaths);

      if (storageError) {
        storageErrorMessage = storageError.message;

        await Promise.all(
          queue.map((item) =>
            supabase
              .from("story_storage_cleanup_queue")
              .update({
                attempts: Number(item.attempts ?? 0) + 1,
                last_error: storageError.message.slice(0, 1000),
              })
              .eq("id", item.id),
          ),
        );
      } else {
        storageFilesDeleted = removedFiles?.length ?? uniquePaths.length;
        const processedAt = new Date().toISOString();

        const { error: markError } = await supabase
          .from("story_storage_cleanup_queue")
          .update({
            processed_at: processedAt,
            attempts: 1,
            last_error: null,
          })
          .in(
            "id",
            queue.map((item) => item.id),
          );

        if (markError) throw markError;
      }
    }

    const summary = {
      ok: storageErrorMessage === null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      expired_stories_deleted: expiredStoriesDeleted,
      storage_files_deleted: storageFilesDeleted,
      queued_files_processed: queue.length,
      storage_error: storageErrorMessage,
    };

    await supabase
      .from("system_maintenance_state")
      .update({
        last_finished_at: summary.finished_at,
        last_result: summary,
        updated_at: summary.finished_at,
      })
      .eq("task", "cleanup_expired_stories");

    return jsonResponse(summary, storageErrorMessage ? 207 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_cleanup_error";
    const finishedAt = new Date().toISOString();

    console.error("cleanup-expired-stories error:", message);

    await supabase
      .from("system_maintenance_state")
      .update({
        last_finished_at: finishedAt,
        last_result: {
          ok: false,
          started_at: startedAt,
          finished_at: finishedAt,
          error: message,
        },
        updated_at: finishedAt,
      })
      .eq("task", "cleanup_expired_stories");

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
