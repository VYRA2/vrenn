import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Client ID público — ok ficar no código
const STRAVA_CLIENT_ID = "268185";
// Client Secret — DEVE vir de env var no Supabase (Settings → Edge Functions → Secrets)
// Nome da secret: STRAVA_CLIENT_SECRET
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!STRAVA_CLIENT_SECRET) {
      throw new Error("STRAVA_CLIENT_SECRET não configurado nas secrets da Edge Function");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Validar JWT do usuário
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token ausente" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida: " + (userError?.message ?? "user null") }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    console.log("User autenticado:", user.id);

    const body = await req.json();
    const { code, redirect_uri } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: "Código ausente" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // redirect_uri DEVE ser enviado pelo cliente — precisa ser idêntico ao usado na autorização.
    // Nunca usar fallback hardcoded aqui, pois o Strava rejeita qualquer divergência.
    if (!redirect_uri) {
      return new Response(JSON.stringify({ error: "redirect_uri ausente no body da requisição" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }
    const finalRedirectUri = redirect_uri;

    console.log("Trocando code por token. redirect_uri:", finalRedirectUri);

    // Trocar code por tokens no Strava
    // IMPORTANTE: redirect_uri deve ser idêntico ao usado na autorização
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: finalRedirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("Strava response status:", tokenRes.status);
    console.log("Strava error:", tokenData.message ?? tokenData.error ?? "none");
    console.log("Has access_token:", !!tokenData.access_token);

    if (!tokenData.access_token) {
      const msg = tokenData.message ?? tokenData.error_description ?? tokenData.error ?? "Sem access_token";
      throw new Error("Strava: " + msg);
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
