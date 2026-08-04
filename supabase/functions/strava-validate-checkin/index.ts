import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRAVA_CLIENT_ID = "268185";
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";

// A localização atual precisa estar próxima de qualquer ponto do trajeto registrado.
const RAIO_TRAJETO_METROS = 500;

// A atividade pode ser validada até X minutos depois de terminar.
const JANELA_APOS_TERMINO_MINUTOS = 30;
const TOLERANCIA_RELOGIO_MINUTOS = 5;

type LatLng = [number, number];

function isLatLng(value: unknown): value is LatLng {
  return Array.isArray(value)
    && value.length === 2
    && Number.isFinite(value[0])
    && Number.isFinite(value[1]);
}

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180)
    * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanciaPontoSegmentoMetros(
  lat: number,
  lng: number,
  inicio: LatLng,
  fim: LatLng,
): number {
  const metrosPorGrauLat = 111320;
  const metrosPorGrauLng = metrosPorGrauLat * Math.cos(lat * Math.PI / 180);

  const ax = (inicio[1] - lng) * metrosPorGrauLng;
  const ay = (inicio[0] - lat) * metrosPorGrauLat;
  const bx = (fim[1] - lng) * metrosPorGrauLng;
  const by = (fim[0] - lat) * metrosPorGrauLat;
  const dx = bx - ax;
  const dy = by - ay;
  const comprimentoQuadrado = dx * dx + dy * dy;

  if (comprimentoQuadrado === 0) {
    return Math.sqrt(ax * ax + ay * ay);
  }

  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / comprimentoQuadrado));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.sqrt(px * px + py * py);
}

function menorDistanciaAoTrajeto(lat: number, lng: number, pontos: LatLng[]): number | null {
  if (!pontos.length) return null;
  if (pontos.length === 1) {
    return distanciaMetros(lat, lng, pontos[0][0], pontos[0][1]);
  }

  let menor = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pontos.length - 1; i++) {
    menor = Math.min(
      menor,
      distanciaPontoSegmentoMetros(lat, lng, pontos[i], pontos[i + 1]),
    );
  }
  return Number.isFinite(menor) ? menor : null;
}

function extrairPontosDoStream(payload: unknown): LatLng[] {
  const data = Array.isArray(payload)
    ? payload.find((stream: any) => stream?.type === "latlng")?.data
    : (payload as any)?.latlng?.data;

  if (!Array.isArray(data)) return [];
  return data.filter(isLatLng);
}

async function buscarJsonStrava(url: string, accessToken: string): Promise<any> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (!response.ok || data?.errors) {
    const message = data?.message ?? `Strava respondeu com status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function buscarPontosDoTrajeto(atividade: any, accessToken: string): Promise<LatLng[]> {
  let pontos: LatLng[] = [];

  try {
    const streams = await buscarJsonStrava(
      `https://www.strava.com/api/v3/activities/${atividade.id}/streams?keys=latlng&key_by_type=true`,
      accessToken,
    );
    pontos = extrairPontosDoStream(streams);
  } catch (error) {
    console.warn("Não foi possível carregar o stream GPS da atividade", error);
  }

  // Fallback para atividades em que o stream não está disponível.
  if (!pontos.length) {
    if (isLatLng(atividade.start_latlng)) pontos.push(atividade.start_latlng);
    if (isLatLng(atividade.end_latlng)) pontos.push(atividade.end_latlng);
  }

  return pontos;
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
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const {
      meta_id,
      duelo_id,
      desafio_id,
      lat_checkin,
      lng_checkin,
      strava_activity_id,
    } = await req.json();

    if (!meta_id && !duelo_id && !desafio_id) {
      return new Response(JSON.stringify({ error: "meta_id, duelo_id ou desafio_id obrigatório" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: conexao } = await supabase
      .from("strava_connections")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!conexao) {
      return new Response(JSON.stringify({ error: "Strava não conectado", code: "not_connected" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

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
      if (!refreshRes.ok || !refreshData.access_token) {
        throw new Error("Falha ao renovar token Strava");
      }

      accessToken = refreshData.access_token;
      await supabase.from("strava_connections").update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: refreshData.expires_at,
      }).eq("user_id", user.id);
    }

    let activityId = strava_activity_id;
    if (!activityId) {
      // Não limitar pela hora de início: uma atividade longa pode ter começado há várias horas.
      const atividades = await buscarJsonStrava(
        "https://www.strava.com/api/v3/athlete/activities?per_page=10",
        accessToken,
      );

      if (!Array.isArray(atividades) || !atividades.length) {
        return new Response(JSON.stringify({
          valido: false,
          motivo: "Nenhuma atividade recente encontrada no Strava",
          code: "no_activity",
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      activityId = atividades[0].id;
    }

    // Sempre buscar a representação detalhada para obter fim e mapa da atividade.
    const atividade = await buscarJsonStrava(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      accessToken,
    );

    const erros: string[] = [];

    // Validar 1: atividade concluída recentemente, não apenas iniciada recentemente.
    const inicioAtividade = new Date(atividade.start_date);
    const duracaoTotalSegundos = Number(atividade.elapsed_time ?? atividade.moving_time ?? 0);
    const fimAtividade = new Date(inicioAtividade.getTime() + duracaoTotalSegundos * 1000);
    const minutosDesdeFim = (Date.now() - fimAtividade.getTime()) / 60000;

    if (minutosDesdeFim > JANELA_APOS_TERMINO_MINUTOS) {
      erros.push(
        `Atividade encerrada há ${Math.round(minutosDesdeFim)} minutos `
        + `(máximo ${JANELA_APOS_TERMINO_MINUTOS} min)`,
      );
    } else if (minutosDesdeFim < -TOLERANCIA_RELOGIO_MINUTOS) {
      erros.push("Horário da atividade no Strava está à frente do horário atual");
    }

    // Validar 2: localização atual próxima de qualquer ponto do trajeto registrado.
    let distancia: number | null = null;
    const possuiLocalizacaoCheckin = Number.isFinite(lat_checkin) && Number.isFinite(lng_checkin);

    if (possuiLocalizacaoCheckin) {
      const pontosTrajeto = await buscarPontosDoTrajeto(atividade, accessToken);
      distancia = menorDistanciaAoTrajeto(lat_checkin, lng_checkin, pontosTrajeto);

      if (distancia === null) {
        erros.push("Atividade sem trajeto GPS no Strava — validação de localização não possível");
      } else if (distancia > RAIO_TRAJETO_METROS) {
        erros.push(
          `Localização atual a ${Math.round(distancia)}m do trajeto registrado `
          + `(máximo ${RAIO_TRAJETO_METROS}m)`,
        );
      }
    }

    const valido = erros.length === 0;

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

    const dstKm = atividade.distance / 1000;
    const paceSecPerKm = dstKm > 0 ? atividade.moving_time / dstKm : 0;
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
        elevacao_m: atividade.total_elevation_gain != null
          ? Math.round(atividade.total_elevation_gain)
          : null,
        fc_media: atividade.average_heartrate != null
          ? Math.round(atividade.average_heartrate)
          : null,
        polyline: atividade.map?.summary_polyline ?? atividade.map?.polyline ?? null,
        inicio: atividade.start_date,
        fim: fimAtividade.toISOString(),
        distancia_checkin_metros: distancia !== null ? Math.round(distancia) : null,
        localizacao_referencia: "trajeto",
      },
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
