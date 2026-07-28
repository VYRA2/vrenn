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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Extrair token do header Authorization
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token ausente" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // Usar cliente com anon key + token do usuário para validar sessão
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado: " + (userError?.message ?? "user null") }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // Cliente de serviço para operações no banco
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { code } = body;

    if (!code) {
      return new Response(JSON.stringify({ error: "Código ausente" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    console.log("Trocando code por tokens para user:", user.id);

    // Trocar code por tokens
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
    console.log("Strava token response status:", tokenRes.status, JSON.stringify(tokenData).substring(0, 200));

    if (!tokenData.access_token) {
      throw new Error(tokenData.message ?? tokenData.error ?? "Erro ao obter tokens do Strava");
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
    } catch (e) {
      console.log("Erro ao buscar atividades:", e);
    }

    // Salvar conexão
    const { error: upsertErr } = await supabaseAdmin.from("strava_connections").upsert({
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

    if (upsertErr) throw new Error("DB error: " + upsertErr.message);

    return new Response(
      JSON.stringify({ ok: true, athlete_name: `${athlete.firstname} ${athlete.lastname}` }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("strava-oauth error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
