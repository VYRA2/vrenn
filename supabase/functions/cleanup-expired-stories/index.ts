import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const responseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders });

const BATCH = 200;
const TOKEN_HEADER = "x-vrenn-cron-token";

function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);

  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Story cleanup is missing Supabase environment variables");
    return json({ error: "Server misconfigured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const providedToken = req.headers.get(TOKEN_HEADER) ?? "";
  const { data: expectedToken, error: tokenError } = await supabase.rpc(
    "get_story_cleanup_token",
  );

  if (tokenError || typeof expectedToken !== "string" || !expectedToken) {
    console.error("Unable to load story cleanup token", tokenError);
    return json({ error: "Authentication unavailable" }, 500);
  }

  if (!safeEqual(providedToken, expectedToken)) {
    return json({ error: "Forbidden" }, 403);
  }

  const { data: acquired, error: lockError } = await supabase.rpc(
    "try_begin_story_cleanup",
  );

  if (lockError) {
    console.error("Unable to acquire story cleanup lock", lockError);
    return json({ error: "lock_failed" }, 500);
  }

  if (acquired !== true) {
    return json({ skipped: true, reason: "locked_or_too_soon" });
  }

  const summary = {
    stories_deleted: 0,
    files_removed: 0,
    files_failed: 0,
    queue_processed: 0,
    batches: 0,
  };

  try {
    for (let i = 0; i < 25; i++) {
      const { data: expired, error } = await supabase
        .from("stories")
        .select("id, media_url")
        .lte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(BATCH);

      if (error) throw error;
      if (!expired?.length) break;

      summary.batches++;
      const ids = expired.map((story: { id: string }) => story.id);

      const { error: deleteError } = await supabase
        .from("stories")
        .delete()
        .in("id", ids);

      if (deleteError) throw deleteError;
      summary.stories_deleted += ids.length;

      if (expired.length < BATCH) break;
    }

    for (let i = 0; i < 25; i++) {
      const { data: queued, error } = await supabase
        .from("story_storage_cleanup_queue")
        .select("id, path")
        .is("processed_at", null)
        .order("created_at", { ascending: true })
        .limit(BATCH);

      if (error) throw error;
      if (!queued?.length) break;

      const paths = [
        ...new Set(
          queued
            .map((item: { path: string }) => item.path)
            .filter((path: string) => Boolean(path)),
        ),
      ];

      if (paths.length) {
        const { error: removeError } = await supabase.storage
          .from("stories")
          .remove(paths);

        if (removeError) {
          summary.files_failed += paths.length;
          console.error("Unable to remove story files", removeError);
          break;
        }

        summary.files_removed += paths.length;
      }

      const { error: updateError } = await supabase
        .from("story_storage_cleanup_queue")
        .update({ processed_at: new Date().toISOString() })
        .in(
          "id",
          queued.map((item: { id: string }) => item.id),
        );

      if (updateError) throw updateError;
      summary.queue_processed += queued.length;

      if (queued.length < BATCH) break;
    }

    return json({ ok: true, ...summary });
  } catch (error) {
    console.error("Story cleanup failed", error);
    return json({ ok: false, error: "cleanup_failed", ...summary }, 500);
  } finally {
    const { error: unlockError } = await supabase.rpc("end_story_cleanup");
    if (unlockError) console.error("Unable to release story cleanup lock", unlockError);
  }
});
