import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
}

/** Confirma o pagamento diretamente na API do Asaas (fonte da verdade). */
async function isPaymentReallyConfirmed(paymentId: string): Promise<boolean> {
  if (!ASAAS_API_KEY) return false;
  try {
    const res = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    if (!res.ok) return false;
    const payment = await res.json();
    return ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment?.status);
  } catch (_e) {
    return false;
  }
}

async function isPaymentReallyOverdue(paymentId: string): Promise<boolean> {
  if (!ASAAS_API_KEY) return false;
  try {
    const res = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    if (!res.ok) return false;
    const payment = await res.json();
    return payment?.status === "OVERDUE";
  } catch (_e) {
    return false;
  }
}

serve(async (req) => {
  try {
    // 1) Autenticação do webhook: token compartilhado configurado no painel do Asaas.
    if (ASAAS_WEBHOOK_TOKEN) {
      const received =
        req.headers.get("asaas-access-token") ??
        req.headers.get("asaas-access-key") ??
        req.headers.get("x-webhook-token") ??
        "";
      if (received !== ASAAS_WEBHOOK_TOKEN) {
        console.warn("[asaas-webhook] token inválido ou ausente");
        return unauthorized();
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();
    const { event, payment } = body ?? {};
    const paymentId: string | undefined = payment?.id;

    if (!event || typeof event !== "string" || !paymentId || typeof paymentId !== "string") {
      return new Response(JSON.stringify({ error: "payload inválido" }), { status: 400 });
    }

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      // 2) Nunca confiar no corpo da requisição: revalidar na API do Asaas.
      const confirmado = await isPaymentReallyConfirmed(paymentId);
      if (!confirmado) {
        console.warn("[asaas-webhook] pagamento não confirmado na API do Asaas");
        return new Response(JSON.stringify({ error: "pagamento não confirmado" }), { status: 409 });
      }

      const { data: transaction } = await supabase
        .from("transactions")
        .select("*")
        .eq("asaas_payment_id", paymentId)
        .maybeSingle();

      if (!transaction) {
        return new Response("Transação não encontrada", { status: 404 });
      }

      if (transaction.status === "confirmed") {
        return new Response(JSON.stringify({ received: true, alreadyConfirmed: true }), {
          status: 200,
        });
      }

      await supabase
        .from("transactions")
        .update({ status: "confirmed" })
        .eq("id", transaction.id);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", transaction.user_id)
        .maybeSingle();

      if (wallet) {
        await supabase
          .from("wallets")
          .update({ balance: Number(wallet.balance) + Number(transaction.amount) })
          .eq("user_id", transaction.user_id);
      } else {
        await supabase.from("wallets").insert({
          user_id: transaction.user_id,
          balance: transaction.amount,
        });
      }
    } else if (event === "PAYMENT_OVERDUE") {
      const overdue = await isPaymentReallyOverdue(paymentId);
      if (!overdue) {
        return new Response(JSON.stringify({ error: "status não confere" }), { status: 409 });
      }
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("asaas_payment_id", paymentId);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error("[asaas-webhook] erro:", error);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500 });
  }
});
