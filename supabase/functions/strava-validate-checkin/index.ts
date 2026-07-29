import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRAVA_CLIENT_ID = "268185";
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";

// Raio de tolerância em metros para validar GPS
const RAIO_METROS = 500;

// Janela de tempo: atividade deve ter começado dentro de X minutos do check-in
const JANELA_MINUTOS = 30;

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

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

    const { meta_id, duelo_id, desafio_id, lat_checkin, lng_checkin, strava_activity_id } = await req.json();

    if (!meta_id && !duelo_id && !desafio_id) {
      return new Response(JSON.stringify({ error: "meta_id, duelo_id ou desafio_id obrigatório" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Buscar conexão Strava do usuário
    const { data: conexao } = await supabase
      .from("strava_connections")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!conexao) {
      return new Response(JSON.stringify({ error: "Strava não conectado", code: "not_connected" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Renovar token se expirado
    let accessToken = conexao.access_token;
    if (new Date(conexao.expires_at * 1000) < new Date()) {
      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: conexao.refresh_token,
        }),
      });
      const refreshData = await refreshRes.json();
      if (!refreshData.access_token) throw new Error("Falha ao renovar token Strava");
      accessToken = refreshData.access_token;
      await supabase.from("strava_connections").update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: refreshData.expires_at,
      }).eq("user_id", user.id);
    }

    // Buscar atividade específica ou a mais recente
    let atividade: any;
    if (strava_activity_id) {
      const res = await fetch(`https://www.strava.com/api/v3/activities/${strava_activity_id}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      atividade = await res.json();
    } else {
      // Buscar atividades das últimas 2 horas
      const after = Math.floor((Date.now() - 2 * 3600 * 1000) / 1000);
      const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=5`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      const atividades = await res.json();
      if (!atividades.length) {
        return new Response(JSON.stringify({
          valido: false,
          motivo: "Nenhuma atividade encontrada nas últimas 2 horas no Strava",
          code: "no_activity"
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      atividade = atividades[0];
    }

    if (!atividade || atividade.errors) {
      return new Response(JSON.stringify({ valido: false, motivo: "Atividade não encontrada", code: "not_found" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const erros: string[] = [];

    // Validar 1: Janela de tempo — atividade iniciada dentro de JANELA_MINUTOS do check-in
    const inicioAtividade = new Date(atividade.start_date);
    const agora = new Date();
    const diffMinutos = (agora.getTime() - inicioAtividade.getTime()) / 60000;
    if (diffMinutos > JANELA_MINUTOS) {
      erros.push(`Atividade iniciada há ${Math.round(diffMinutos)} minutos (máximo ${JANELA_MINUTOS} min)`);
    }

    // Validar 2: GPS — ponto de início da atividade próximo ao check-in
    let distancia: number | null = null;
    if (lat_checkin && lng_checkin && atividade.start_latlng?.length === 2) {
      const [latAtiv, lngAtiv] = atividade.start_latlng;
      distancia = distanciaMetros(lat_checkin, lng_checkin, latAtiv, lngAtiv);
      if (distancia > RAIO_METROS) {
        erros.push(`Início da atividade a ${Math.round(distancia)}m do local de check-in (máximo ${RAIO_METROS}m)`);
      }
    } else if (lat_checkin && lng_checkin) {
      // Strava não retornou GPS — aceitar mas avisar
      erros.push("Atividade sem dados de GPS no Strava — validação de localização não possível");
    }

    const valido = erros.length === 0;

    // Se válido, registrar o check-in validado na tabela adequada
    if (valido) {
      const msg = `Atividade Strava: ${atividade.name} (${(atividade.distance / 1000).toFixed(1)}km, ${Math.round(atividade.moving_time / 60)}min)`;
      if (desafio_id) {
        await supabase.from("checkins_desafio_equipe").insert({
          desafio_id,
          user_id: user.id,
          mensagem: msg,
          foto_url: null,
        });
      } else {
        await supabase.from("checkins").insert({
          user_id: user.id,
          meta_id: meta_id ?? null,
          duelo_id: duelo_id ?? null,
          wearable_activity_id: String(atividade.id),
          validado: true,
          mensagem: msg,
        });
      }
    }


    // Ritmo médio (min/km) — pace = moving_time / distance
    const dstKm = atividade.distance / 1000;
    const paceSecPerKm = dstKm > 0 ? (atividade.moving_time / dstKm) : 0;
    const paceMin = Math.floor(paceSecPerKm / 60);
    const paceSec = Math.round(paceSecPerKm % 60);
    const ritmo = dstKm > 0 ? `${paceMin}'${String(paceSec).padStart(2, "0")}"` : null;

    return new Response(JSON.stringify({
      valido,
      motivo: erros.join("; "),
      atividade: {
        id: atividade.id,
        nome: atividade.name,
        tipo: atividade.type,
        distancia_km: dstKm.toFixed(2),
        distancia_km_num: dstKm,
        duracao_min: Math.round(atividade.moving_time / 60),
        tempo_seg: atividade.moving_time,
        ritmo,
        calorias: atividade.calories ?? null,
        elevacao_m: atividade.total_elevation_gain != null ? Math.round(atividade.total_elevation_gain) : null,
        fc_media: atividade.average_heartrate != null ? Math.round(atividade.average_heartrate) : null,
        polyline: atividade.map?.summary_polyline ?? atividade.map?.polyline ?? null,
        inicio: atividade.start_date,
        distancia_checkin_metros: distancia ? Math.round(distancia) : null,
      }
    }), { headers: { ...cors, "Content-Type": "application/json" } });


  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
