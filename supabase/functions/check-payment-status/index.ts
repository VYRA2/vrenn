import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { paymentId } = await req.json();
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "paymentId obrigatório" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Buscar status no Asaas
    const asaasRes = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    const payment = await asaasRes.json();

    const confirmed = ["CONFIRMED", "RECEIVED"].includes(payment.status);

    if (confirmed) {
      // Buscar transaction local
      const { data: transaction } = await supabase
        .from("transactions")
        .select("*")
        .eq("asaas_payment_id", paymentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (transaction && transaction.status !== "confirmed") {
        // Confirmar e creditar saldo
        await supabase
          .from("transactions")
          .update({ status: "confirmed" })
          .eq("id", transaction.id);

        const { data: wallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (wallet) {
          await supabase
            .from("wallets")
            .update({ balance: Number(wallet.balance) + Number(transaction.amount) })
            .eq("user_id", user.id);
        } else {
          await supabase.from("wallets").insert({
            user_id: user.id,
            balance: transaction.amount,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: payment.status,
        confirmed,
        value: payment.value,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
