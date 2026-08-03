import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vrenn-cron",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const BATCH = 200;
const CRON_HEADER = "x-vrenn-cron";
const CRON_VALUE = "story-cleanup";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (req.headers.get(CRON_HEADER) !== CRON_VALUE) {
    return json({ error: "Forbidden" }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Trava de concorrência + rate limit de 5 minutos (controlado no banco)
  const { data: acquired, error: lockErr } = await supabase.rpc("try_begin_story_cleanup");
  if (lockErr) return json({ error: "lock_failed" }, 500);
  if (acquired !== true) return json({ skipped: true, reason: "locked_or_too_soon" }, 200);

  const summary = {
    stories_deleted: 0,
    files_removed: 0,
    files_failed: 0,
    queue_processed: 0,
    batches: 0,
  };

  try {
    // 1) Stories expirados, em lotes
    for (let i = 0; i < 25; i++) {
      const { data: expired, error } = await supabase
        .from("stories")
        .select("id, media_url")
        .lte("expires_at", new Date().toISOString())
        .limit(BATCH);
      if (error) throw error;
      if (!expired || expired.length === 0) break;

      summary.batches++;
      const ids = expired.map((s: { id: string }) => s.id);

      // Deleta os registros: o trigger BEFORE DELETE enfileira os media_url
      const { error: delErr } = await supabase.from("stories").delete().in("id", ids);
      if (delErr) throw delErr;
      summary.stories_deleted += ids.length;

      if (expired.length < BATCH) break;
    }

    // 2) Fila de arquivos (inclui exclusões manuais anteriores)
    for (let i = 0; i < 25; i++) {
      const { data: queued, error } = await supabase
        .from("story_storage_cleanup_queue")
        .select("id, path")
        .is("processed_at", null)
        .limit(BATCH);
      if (error) throw error;
      if (!queued || queued.length === 0) break;

      const paths = [...new Set(queued.map((q: { path: string }) => q.path).filter(Boolean))];
      let ok = true;
      if (paths.length) {
        const { error: rmErr } = await supabase.storage.from("stories").remove(paths);
        if (rmErr) {
          ok = false;
          summary.files_failed += paths.length;
        } else {
          summary.files_removed += paths.length;
        }
      }

      if (ok) {
        const { error: updErr } = await supabase
          .from("story_storage_cleanup_queue")
          .update({ processed_at: new Date().toISOString() })
          .in("id", queued.map((q: { id: string }) => q.id));
        if (updErr) throw updErr;
        summary.queue_processed += queued.length;
      } else {
        break; // tenta novamente na próxima execução (idempotente)
      }

      if (queued.length < BATCH) break;
    }

    return json({ ok: true, ...summary });
  } catch (_e) {
    return json({ ok: false, error: "cleanup_failed", ...summary }, 500);
  } finally {
    await supabase.rpc("end_story_cleanup");
  }
});
