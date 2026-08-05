import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRAVA_CLIENT_ID = "268185";
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";
const RAIO_TRAJETO_METROS = 500;
const JANELA_APOS_TERMINO_MINUTOS = 30;
const TOLERANCIA_RELOGIO_MINUTOS = 5;

type LatLng = [number, number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

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

function distanciaPontoSegmentoMetros(lat: number, lng: number, inicio: LatLng, fim: LatLng): number {
  const metrosPorGrauLat = 111320;
  const metrosPorGrauLng = metrosPorGrauLat * Math.cos(lat * Math.PI / 180);
  const ax = (inicio[1] - lng) * metrosPorGrauLng;
  const ay = (inicio[0] - lat) * metrosPorGrauLat;
  const bx = (fim[1] - lng) * metrosPorGrauLng;
  const by = (fim[0] - lat) * metrosPorGrauLat;
  const dx = bx - ax;
  const dy = by - ay;
  const comprimentoQuadrado = dx * dx + dy * dy;

  if (comprimentoQuadrado === 0) return Math.sqrt(ax * ax + ay * ay);

  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / comprimentoQuadrado));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.sqrt(px * px + py * py);
}

function menorDistanciaAoTrajeto(lat: number, lng: number, pontos: LatLng[]): number | null {
  if (!pontos.length) return null;
  if (pontos.length === 1) return distanciaMetros(lat, lng, pontos[0][0], pontos[0][1]);

  let menor = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pontos.length - 1; i++) {
    menor = Math.min(menor, distanciaPontoSegmentoMetros(lat, lng, pontos[i], pontos[i + 1]));
  }
  return Number.isFinite(menor) ? menor : null;
}

function extrairPontosDoStream(payload: unknown): LatLng[] {
  const data = Array.isArray(payload)
    ? payload.find((stream: any) => stream?.type === "latlng")?.data
    : (payload as any)?.latlng?.data;
  return Array.isArray(data) ? data.filter(isLatLng) : [];
}

async function buscarJsonStrava(url: string, accessToken: string): Promise<any> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json();
  if (!response.ok || data?.errors) {
    throw new Error(data?.message ?? `Strava respondeu com status ${response.status}`);
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
    if (!user) return json({ error: "Não autorizado" }, 401);

    const {
      meta_id,
      duelo_id,
      desafio_id,
      lat_checkin,
      lng_checkin,
      strava_activity_id,
    } = await req.json();

    if (!meta_id && !duelo_id && !desafio_id) {
      return json({ error: "meta_id, duelo_id ou desafio_id obrigatório" }, 400);
    }

    const entityType = meta_id ? "meta" : duelo_id ? "duelo" : "desafio_equipe";
    const entityId = meta_id ?? duelo_id ?? desafio_id;
    let entity: any = null;

    if (entityType === "meta") {
      const { data } = await supabase.from("metas")
        .select("id,user_id,status,tipo_validacao,subcategoria,modalidade,objetivo_km")
        .eq("id", entityId).eq("user_id", user.id).maybeSingle();
      entity = data;
      if (!entity || entity.status !== "em_andamento") return json({ error: "Meta não encontrada ou inativa" }, 403);
    } else if (entityType === "duelo") {
      const { data } = await supabase.from("duelos")
        .select("id,challenger_id,opponent_id,status,tipo_validacao,subcategoria,modalidade,objetivo_km,challenger_eliminado,opponent_eliminado")
        .eq("id", entityId).maybeSingle();
      entity = data;
      const participant = entity && [entity.challenger_id, entity.opponent_id].includes(user.id);
      const eliminated = entity && (user.id === entity.challenger_id ? entity.challenger_eliminado : entity.opponent_eliminado);
      if (!participant || eliminated || !["ativo", "em_andamento"].includes(entity?.status)) return json({ error: "Duelo não encontrado, inativo ou usuário eliminado" }, 403);
    } else {
      const [{ data: challenge }, { data: participation }] = await Promise.all([
        supabase.from("desafios_equipe")
          .select("id,status,tipo_validacao,subcategoria,modalidade,objetivo_km")
          .eq("id", entityId).maybeSingle(),
        supabase.from("desafio_equipe_participantes")
          .select("id,eliminado")
          .eq("desafio_id", entityId).eq("user_id", user.id).maybeSingle(),
      ]);
      entity = challenge;
      if (!entity || entity.status !== "ativo" || !participation || participation.eliminado) return json({ error: "Desafio não encontrado, inativo ou usuário eliminado" }, 403);
    }

    if (entity.tipo_validacao !== "strava") return json({ error: "Este compromisso não usa validação Strava" }, 403);

    const { data: conexao } = await supabase
      .from("strava_connections")
      .select("access_token, expires_at, refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!conexao) return json({ error: "Strava não conectado", code: "not_connected" }, 400);

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
      if (!refreshRes.ok || !refreshData.access_token) throw new Error("Falha ao renovar token Strava");

      accessToken = refreshData.access_token;
      const { error: tokenError } = await supabase.from("strava_connections").update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: refreshData.expires_at,
      }).eq("user_id", user.id);
      if (tokenError) console.error("Falha ao salvar token renovado do Strava", tokenError);
    }

    let activityId = strava_activity_id;
    if (!activityId) {
      const atividades = await buscarJsonStrava(
        "https://www.strava.com/api/v3/athlete/activities?per_page=10",
        accessToken,
      );
      if (!Array.isArray(atividades) || !atividades.length) {
        return json({
          valido: false,
          motivo: "Nenhuma atividade recente encontrada no Strava",
          code: "no_activity",
        });
      }
      activityId = atividades[0].id;
    }

    const atividade = await buscarJsonStrava(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      accessToken,
    );

    const erros: string[] = [];
    const inicioAtividade = new Date(atividade.start_date);

    const modality = String(entity.subcategoria ?? entity.modalidade ?? "").toLowerCase();
    const activityType = String(atividade.sport_type ?? atividade.type ?? "").toLowerCase();
    const allowedByModality: Record<string, string[]> = {
      corrida: ["run", "trailrun", "virtualrun"], running: ["run", "trailrun", "virtualrun"],
      caminhada: ["walk", "hike"], caminhada_corrida: ["walk", "hike", "run", "trailrun"],
      ciclismo: ["ride", "virtualride", "ebikeride", "mountainbikeride"], bike: ["ride", "virtualride", "ebikeride", "mountainbikeride"],
      natacao: ["swim"], swimming: ["swim"],
    };
    const allowedTypes = allowedByModality[modality];
    if (allowedTypes && !allowedTypes.includes(activityType)) {
      erros.push(`A atividade ${atividade.type ?? atividade.sport_type} não corresponde à modalidade ${entity.subcategoria ?? entity.modalidade}`);
    }
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
    let checkinId: string | null = null;

    let entityResult: any = null;
    if (valido) {
      const dstKmValidated = Number(atividade.distance ?? 0) / 1000;
      const msg = `Atividade Strava: ${atividade.name} (${dstKmValidated.toFixed(2)}km, ${Math.round(Number(atividade.moving_time ?? 0) / 60)}min)`;
      const { data: registration, error: registrationError } = await supabase.rpc("registrar_checkin_strava", {
        _user_id: user.id,
        _entidade: entityType,
        _entidade_id: entityId,
        _activity_id: String(atividade.id),
        _activity_started_at: atividade.start_date,
        _km: dstKmValidated,
        _mensagem: msg,
      });
      if (registrationError) {
        const duplicate = registrationError.code === "23505" || /duplicate|unique/i.test(registrationError.message ?? "");
        return json({
          error: duplicate ? "Esta atividade do Strava já foi usada em um check-in." : "A atividade foi validada, mas o check-in não pôde ser registrado.",
          code: duplicate ? "activity_already_used" : "checkin_insert_failed",
          details: registrationError.message,
        }, duplicate ? 409 : 500);
      }
      checkinId = registration?.checkin_id ?? null;
      entityResult = registration?.resultado ?? null;
    }

    const dstKm = atividade.distance / 1000;
    const paceSecPerKm = dstKm > 0 ? atividade.moving_time / dstKm : 0;
    const paceMin = Math.floor(paceSecPerKm / 60);
    const paceSec = Math.round(paceSecPerKm % 60);
    const ritmo = dstKm > 0 ? `${paceMin}'${String(paceSec).padStart(2, "0")}"` : null;

    return json({
      valido,
      motivo: erros.join("; "),
      checkin_id: checkinId,
      resultado: entityResult,
      entidade_concluida: Boolean(entityResult?.concluida || entityResult?.status === "concluido"),
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
    });
  } catch (e: any) {
    console.error("Erro na validação do check-in Strava:", e);
    return json({ error: e.message }, 500);
  }
});
