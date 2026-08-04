import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = "BMDw8Frw-C-qbo2PNosbg2kIYy-Eh04MDPZlc2o0DV7u-OtOh2C9CZFt6wWDxG8EAA17JSzjxQQ9zfooD347qoc";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CHECKIN_REMINDER_CRON_SECRET") ?? "";

webpush.setVapidDetails("mailto:contato@vrenn.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

type Commitment = {
  type: "meta" | "duelo" | "desafio_equipe";
  id: string;
  title: string;
  url: string;
};

type Profile = {
  id: string;
  nome: string | null;
  checkin_reminder_enabled: boolean | null;
  checkin_reminder_time: string | null;
  timezone: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

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
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
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
  return Boolean(local.date) && current >= target && current < target + 10;
}

function happenedOnLocalDate(iso: string, timezone: string, localDate: string) {
  return localParts(new Date(iso), timezone).date === localDate;
}

function isExpired(value: string | null | undefined, localDate: string) {
  if (!value) return false;
  return value.slice(0, 10) < localDate;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY não configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date();

    const suppliedSecret = req.headers.get("x-cron-secret") ?? "";
    const isCron = Boolean(CRON_SECRET) && suppliedSecret === CRON_SECRET;
    let selfTestUserId: string | null = null;

    if (!isCron) {
      const authorization = req.headers.get("Authorization") ?? "";
      const token = authorization.replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "unauthorized" }, 401);

      const { data: authData, error: authError } = await admin.auth.getUser(token);
      if (authError || !authData.user) return json({ error: "unauthorized" }, 401);

      const body = await req.json().catch(() => ({}));
      if (body?.mode !== "self_test") return json({ error: "forbidden" }, 403);
      selfTestUserId = authData.user.id;
    }

    let profilesQuery = admin
      .from("profiles")
      .select("id, nome, checkin_reminder_enabled, checkin_reminder_time, timezone");

    profilesQuery = selfTestUserId
      ? profilesQuery.eq("id", selfTestUserId)
      : profilesQuery.eq("checkin_reminder_enabled", true);

    const { data: profiles, error: profilesError } = await profilesQuery;
    if (profilesError) throw profilesError;

    let usersChecked = 0;
    let remindersCreated = 0;
    let pushesSent = 0;
    let skippedDuplicates = 0;

    for (const profile of (profiles ?? []) as Profile[]) {
      const timezone = profile.timezone || "America/Sao_Paulo";
      const reminderTime = profile.checkin_reminder_time || "21:00:00";
      const selfTest = selfTestUserId === profile.id;

      if (!selfTest && !isDue(now, timezone, reminderTime)) continue;
      usersChecked++;

      const localDate = localParts(now, timezone).date;
      const since = new Date(now.getTime() - 40 * 60 * 60 * 1000).toISOString();

      const [metasRes, duelosRes, participacoesRes, recentCheckinsRes, recentTeamCheckinsRes] = await Promise.all([
        admin
          .from("metas")
          .select("id, titulo, status, prazo")
          .eq("user_id", profile.id)
          .or("status.eq.em_andamento,status.is.null"),
        admin
          .from("duelos")
          .select("id, titulo, status, prazo, challenger_id, opponent_id, challenger_eliminado, opponent_eliminado")
          .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`),
        admin
          .from("desafio_equipe_participantes")
          .select("desafio_id, status, eliminado, desafios_equipe:desafio_id(id, equipe_id, titulo, status, data_inicio, data_fim)")
          .eq("user_id", profile.id),
        admin
          .from("checkins")
          .select("meta_id, duelo_id, desafio_id, created_at")
          .eq("user_id", profile.id)
          .gte("created_at", since),
        admin
          .from("checkins_desafio_equipe")
          .select("desafio_id, created_at")
          .eq("user_id", profile.id)
          .gte("created_at", since),
      ]);

      for (const result of [metasRes, duelosRes, participacoesRes, recentCheckinsRes, recentTeamCheckinsRes]) {
        if (result.error) console.error("Falha ao consultar compromisso", result.error);
      }

      const didMeta = new Set<string>();
      const didDuelo = new Set<string>();
      const didTeam = new Set<string>();

      for (const checkin of recentCheckinsRes.data ?? []) {
        if (!happenedOnLocalDate(checkin.created_at, timezone, localDate)) continue;
        if (checkin.meta_id) didMeta.add(checkin.meta_id);
        if (checkin.duelo_id) didDuelo.add(checkin.duelo_id);
        if (checkin.desafio_id) didTeam.add(checkin.desafio_id);
      }
      for (const checkin of recentTeamCheckinsRes.data ?? []) {
        if (happenedOnLocalDate(checkin.created_at, timezone, localDate) && checkin.desafio_id) {
          didTeam.add(checkin.desafio_id);
        }
      }

      const commitments: Commitment[] = [];

      for (const meta of metasRes.data ?? []) {
        if (isExpired(meta.prazo, localDate) || didMeta.has(meta.id)) continue;
        commitments.push({ type: "meta", id: meta.id, title: meta.titulo, url: `/meta/${meta.id}` });
      }

      for (const duelo of duelosRes.data ?? []) {
        if (!["ativo", "em_andamento", "aceito"].includes(duelo.status ?? "")) continue;
        if (isExpired(duelo.prazo, localDate) || didDuelo.has(duelo.id)) continue;

        const userEliminated = duelo.challenger_id === profile.id
          ? Boolean(duelo.challenger_eliminado)
          : Boolean(duelo.opponent_eliminado);
        if (userEliminated) continue;

        commitments.push({ type: "duelo", id: duelo.id, title: duelo.titulo, url: `/duelo/${duelo.id}` });
      }

      for (const participation of participacoesRes.data ?? []) {
        if (participation.eliminado || ["recusado", "cancelado", "saiu"].includes(participation.status ?? "")) continue;
        const challenge = Array.isArray(participation.desafios_equipe)
          ? participation.desafios_equipe[0]
          : participation.desafios_equipe;
        if (!challenge) continue;
        if (["finalizado", "cancelado"].includes(challenge.status ?? "")) continue;
        if (challenge.data_inicio && challenge.data_inicio > localDate) continue;
        if (isExpired(challenge.data_fim, localDate) || didTeam.has(challenge.id)) continue;

        commitments.push({
          type: "desafio_equipe",
          id: challenge.id,
          title: challenge.titulo,
          url: `/equipes/${challenge.equipe_id}`,
        });
      }

      if (!commitments.length) continue;

      const { data: subscriptions, error: subscriptionsError } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", profile.id);
      if (subscriptionsError) console.error("Falha ao buscar inscrições push", subscriptionsError);

      for (const commitment of commitments) {
        const { data: delivery, error: deliveryError } = await admin
          .from("checkin_reminder_deliveries")
          .insert({
            user_id: profile.id,
            commitment_type: commitment.type,
            commitment_id: commitment.id,
            local_date: localDate,
          })
          .select("id")
          .single();

        if (deliveryError) {
          if (deliveryError.code === "23505") {
            skippedDuplicates++;
            continue;
          }
          console.error("Falha ao reservar lembrete", deliveryError);
          continue;
        }

        const message = `Seu check-in de hoje ainda está pendente: ${commitment.title}.`;
        const { data: notification, error: notificationError } = await admin
          .from("notificacoes")
          .insert({
            user_id: profile.id,
            tipo: "checkin_pendente",
            mensagem: message,
            link_id: commitment.id,
            lida: false,
          })
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
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              payload,
            );
            sent = true;
          } catch (error: any) {
            console.error("Falha ao enviar push", error?.statusCode ?? error?.message ?? error);
            if (error?.statusCode === 404 || error?.statusCode === 410) {
              await admin.from("push_subscriptions").delete().eq("id", subscription.id);
            }
          }
        }));

        if (sent) pushesSent++;

        await admin
          .from("checkin_reminder_deliveries")
          .update({ push_sent: sent, notification_id: notification?.id ?? null })
          .eq("id", delivery.id);
      }
    }

    return json({
      ok: true,
      mode: selfTestUserId ? "self_test" : "cron",
      users_checked: usersChecked,
      reminders_created: remindersCreated,
      pushes_sent: pushesSent,
      skipped_duplicates: skippedDuplicates,
    });
  } catch (error) {
    console.error("send-checkin-reminders error", error);
    return json({ error: (error as Error).message }, 500);
  }
});
