import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRAVA_CLIENT_ID = "268185";
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "6ae83310ea696cfce7ec3720a57c1beb4c0b7791";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Admin client — pode fazer tudo
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Extrair e validar JWT manualmente via admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token ausente" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // Usar getUser com o token diretamente — funciona com service role
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("getUser error:", userError?.message ?? "user null");
      return new Response(JSON.stringify({ error: "Sessão inválida: " + (userError?.message ?? "user null") }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    console.log("User autenticado:", user.id);

    const body = await req.json();
    const { code } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: "Código ausente" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // Trocar code por tokens no Strava
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("Strava status:", tokenRes.status, "access_token:", !!tokenData.access_token);

    if (!tokenData.access_token) {
      const msg = tokenData.message ?? tokenData.error_description ?? tokenData.error ?? "Sem access_token";
      throw new Error("Strava error: " + msg);
    }

    const athlete = tokenData.athlete;

    // Buscar última atividade
    let ultimaAtividade: any = null;
    try {
      const actRes = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=1", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const acts = await actRes.json();
      if (Array.isArray(acts) && acts.length > 0) ultimaAtividade = acts[0];
    } catch (_) {}

    // Salvar conexão no banco
    const { error: upsertErr } = await supabase.from("strava_connections").upsert({
      user_id: user.id,
      athlete_id: String(athlete.id),
      athlete_name: `${athlete.firstname} ${athlete.lastname}`,
      athlete_photo: athlete.profile_medium ?? athlete.profile ?? null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      connected_at: new Date().toISOString(),
      ultima_atividade_tipo: ultimaAtividade?.type?.toLowerCase() ?? null,
      ultima_atividade_km: ultimaAtividade ? (ultimaAtividade.distance / 1000) : null,
      ultima_atividade_em: ultimaAtividade?.start_date ?? null,
      total_atividades: 1,
    }, { onConflict: "user_id" });

    if (upsertErr) throw new Error("DB: " + upsertErr.message);

    return new Response(
      JSON.stringify({ ok: true, athlete_name: `${athlete.firstname} ${athlete.lastname}` }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("strava-oauth ERRO:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
