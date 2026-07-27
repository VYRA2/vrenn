import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: userRes } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    // Buscar token para revogar no Strava
    const { data: conn } = await supabase.from("strava_connections").select("access_token").eq("user_id", user.id).maybeSingle();

    if (conn?.access_token) {
      try {
        await fetch("https://www.strava.com/oauth/deauthorize", {
          method: "POST",
          headers: { Authorization: `Bearer ${conn.access_token}` },
        });
      } catch (_) {}
    }

    // Deletar conexão do banco
    await supabase.from("strava_connections").delete().eq("user_id", user.id);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
