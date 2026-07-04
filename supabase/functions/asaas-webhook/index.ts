import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();
    const { event, payment } = body;

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      const { data: transaction } = await supabase
        .from("transactions")
        .select("*")
        .eq("asaas_payment_id", payment.id)
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
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("asaas_payment_id", payment.id);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
