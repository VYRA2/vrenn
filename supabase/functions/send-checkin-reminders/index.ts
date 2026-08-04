import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = "BMDw8Frw-C-qbo2PNosbg2kIYy-Eh04MDPZlc2o0DV7u-OtOh2C9CZFt6wWDxG8EAA17JSzjxQQ9zfooD347qoc";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CHECKIN_REMINDER_CRON_SECRET") ?? "";

webpush.setVapidDetails("mailto:contato@vrenn.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-cron-secret",
};

type Commitment = {
  type: "meta" | "duelo" | "desafio_equipe";
  id: string;
  title: string;
  url: string;
};

function localParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function isDue(now: Date, timezone: string, time: string) {
  const local = localParts(now, timezone);
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  const current = local.hour * 60 + local.minute;
  const target = hour * 60 + minute;
  return local.date && current >= target && current < target + 10;
}

function happenedOnLocalDate(iso: string, timezone: string, localDate: string) {
  return localParts(new Date(iso), timezone).date === localDate;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    if (!VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const now = new Date();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, nome, checkin_reminder_enabled, checkin_reminder_time, timezone")
      .eq("checkin_reminder_enabled", true);
    if (profilesError) throw profilesError;

    let usersChecked = 0;
    let remindersCreated = 0;
    let pushesSent = 0;

    for (const profile of profiles ?? []) {
      const timezone = profile.timezone || "America/Sao_Paulo";
      const reminderTime = profile.checkin_reminder_time || "21:00:00";
      if (!isDue(now, timezone, reminderTime)) continue;
      usersChecked++;

      const localDate = localParts(now, timezone).date;
      const [metasRes, duelosRes, participacoesRes, recentCheckinsRes, recentTeamCheckinsRes] = await Promise.all([
        supabase.from("metas").select("id, titulo, status, prazo").eq("user_id", profile.id).or("status.eq.em_andamento,status.is.null"),
        supabase.from("duelos").select("id, titulo, status, prazo, challenger_id, opponent_id").or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`),
        supabase.from("desafio_equipe_participantes").select("desafio_id, desafios_equipe:desafio_id(id, titulo, status, data_fim)").eq("user_id", profile.id),
        supabase.from("checkins").select("meta_id, duelo_id, created_at").eq("user_id", profile.id).gte("created_at", new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString()),
        supabase.from("checkins_desafio_equipe").select("desafio_id, created_at").eq("user_id", profile.id).gte("created_at", new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString()),
      ]);

      const didMeta = new Set<string>();
      const didDuelo = new Set<string>();
      for (const c of recentCheckinsRes.data ?? []) {
        if (!happenedOnLocalDate(c.created_at, timezone, localDate)) continue;
        if (c.meta_id) didMeta.add(c.meta_id);
        if (c.duelo_id) didDuelo.add(c.duelo_id);
      }
      const didTeam = new Set<string>();
      for (const c of recentTeamCheckinsRes.data ?? []) {
        if (happenedOnLocalDate(c.created_at, timezone, localDate) && c.desafio_id) didTeam.add(c.desafio_id);
      }

      const commitments: Commitment[] = [];
      for (const meta of metasRes.data ?? []) {
        if (meta.prazo && meta.prazo < localDate) continue;
        if (!didMeta.has(meta.id)) commitments.push({ type: "meta", id: meta.id, title: meta.titulo, url: `/meta/${meta.id}` });
      }
      for (const duelo of duelosRes.data ?? []) {
        if (!["ativo", "em_andamento", "aceito"].includes(duelo.status ?? "")) continue;
        if (duelo.prazo && duelo.prazo < localDate) continue;
        if (!didDuelo.has(duelo.id)) commitments.push({ type: "duelo", id: duelo.id, title: duelo.titulo, url: `/duelo/${duelo.id}` });
      }
      for (const row of participacoesRes.data ?? []) {
        const desafio = Array.isArray(row.desafios_equipe) ? row.desafios_equipe[0] : row.desafios_equipe;
        if (!desafio || ["finalizado", "cancelado"].includes(desafio.status ?? "")) continue;
        if (desafio.data_fim && desafio.data_fim < localDate) continue;
        if (!didTeam.has(desafio.id)) commitments.push({ type: "desafio_equipe", id: desafio.id, title: desafio.titulo, url: `/equipes` });
      }

      if (!commitments.length) continue;

      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", profile.id);

      for (const commitment of commitments) {
        const { data: delivery, error: deliveryError } = await supabase
          .from("checkin_reminder_deliveries")
          .insert({
            user_id: profile.id,
            commitment_type: commitment.type,
            commitment_id: commitment.id,
            local_date: localDate,
          })
          .select("id")
          .maybeSingle();

        if (deliveryError) {
          if (deliveryError.code === "23505") continue;
          console.error("Falha ao reservar lembrete", deliveryError);
          continue;
        }

        const message = `Seu check-in de hoje ainda está pendente: ${commitment.title}.`;
        const { data: notification, error: notificationError } = await supabase
          .from("notificacoes")
          .insert({ user_id: profile.id, tipo: "checkin_pendente", mensagem: message, link_id: commitment.id, lida: false })
          .select("id")
          .single();

        if (notificationError) console.error("Falha ao criar notificação interna", notificationError);
        remindersCreated++;

        const payload = JSON.stringify({
          title: "Check-in pendente",
          body: message,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          url: commitment.url,
          tag: `checkin-${commitment.type}-${commitment.id}-${localDate}`,
        });

        let sent = false;
        await Promise.allSettled((subscriptions ?? []).map(async (subscription) => {
          try {
            await webpush.sendNotification(
              { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
              payload,
            );
            sent = true;
          } catch (error: any) {
            if (error?.statusCode === 404 || error?.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
            }
          }
        }));
        if (sent) pushesSent++;

        await supabase
          .from("checkin_reminder_deliveries")
          .update({ push_sent: sent, notification_id: notification?.id ?? null })
          .eq("id", delivery.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, users_checked: usersChecked, reminders_created: remindersCreated, pushes_sent: pushesSent }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-checkin-reminders error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
