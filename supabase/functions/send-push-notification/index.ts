import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = "BQgOQfgjs0wwEWBHCoXUQA14v-D40pwEbkxjBW27CAU";
const VAPID_PUBLIC_KEY = "BMDw8Frw-C-qbo2PNosbg2kIYy-Eh04MDPZlc2o0DV7u-OtOh2C9CZFt6wWDxG8EAA17JSzjxQQ9zfooD347qoc";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

webpush.setVapidDetails("mailto:contato@vrenn.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }
    if (!VAPID_PRIVATE_KEY) {
      throw new Error("VAPID_PRIVATE_KEY não configurada nas secrets da edge function");
    }

    const { conversa_id, sender_id, texto, tipo } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Descobre quem deve receber a notificação
    const { data: conversa } = await supabase
      .from("conversas")
      .select("id, user1_id, user2_id, tipo, equipe_id, nome")
      .eq("id", conversa_id)
      .maybeSingle();

    if (!conversa) return new Response(JSON.stringify({ ok: true, skipped: "conversa não encontrada" }), { headers: cors });

    let recipientIds: string[] = [];
    if (conversa.tipo === "grupo_equipe" && conversa.equipe_id) {
      const { data: membros } = await supabase
        .from("equipe_membros")
        .select("user_id")
        .eq("equipe_id", conversa.equipe_id)
        .neq("user_id", sender_id);
      recipientIds = (membros ?? []).map((m: any) => m.user_id);
    } else {
      const other = conversa.user1_id === sender_id ? conversa.user2_id : conversa.user1_id;
      if (other && other !== sender_id) recipientIds = [other];
    }

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: cors });
    }

    const { data: sender } = await supabase.from("profiles").select("nome, avatar_url").eq("id", sender_id).maybeSingle();

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);

    const title = conversa.tipo === "grupo_equipe" ? (conversa.nome ?? "Grupo") : (sender?.nome ?? "Nova mensagem");
    const body = tipo === "imagem" ? "📷 Enviou uma foto" : tipo === "video" ? "🎥 Enviou um vídeo" : (texto?.slice(0, 120) ?? "Nova mensagem");

    const payload = JSON.stringify({
      title,
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      image: sender?.avatar_url ?? undefined,
      url: `/mensagens/${conversa_id}`,
      tag: `mensagem-${conversa_id}`,
    });

    let sent = 0;
    await Promise.allSettled(
      (subs ?? []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          // Subscription expirada/inválida (410 Gone ou 404) — remove do banco
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
    );

    return new Response(JSON.stringify({ ok: true, sent, total: (subs ?? []).length }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("send-push-notification ERRO:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: cors });
  }
});
