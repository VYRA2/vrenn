import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, cpf } = await req.json();
    if (!amount || amount < 10) {
      return new Response(JSON.stringify({ error: "Valor mínimo: R$10,00" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanCpf = (cpf ?? "").replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: "CPF inválido. Informe os 11 dígitos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salva o CPF no perfil, se ainda não tiver
    await supabase.from("profiles").update({ cpf: cleanCpf }).eq("id", user.id).is("cpf", null);

    // Find or create Asaas customer
    const customerRes = await fetch(
      `${ASAAS_API_URL}/customers?email=${encodeURIComponent(user.email ?? "")}`,
      { headers: { access_token: ASAAS_API_KEY } },
    );
    const customerData = await customerRes.json();

    let customerId: string;
    if (customerData?.data?.length > 0) {
      customerId = customerData.data[0].id;
    } else {
      const newCustomer = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ name: user.email, email: user.email, cpfCnpj: cleanCpf }),
      });
      const nc = await newCustomer.json();
      if (!nc?.id) {
        return new Response(JSON.stringify({ error: "Falha ao criar cliente na Asaas", details: nc }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerId = nc.id;
    }

    // Create PIX payment
    const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: "POST",
      headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: amount,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        description: "Depósito VRENN — custódia de desafio",
      }),
    });
    const payment = await paymentRes.json();

    if (!payment?.id) {
      return new Response(JSON.stringify({ error: "Falha ao gerar pagamento", details: payment }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qrRes = await fetch(`${ASAAS_API_URL}/payments/${payment.id}/pixQrCode`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    const qrData = await qrRes.json();

    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount,
      status: "pending",
      asaas_payment_id: payment.id,
      description: `Depósito via PIX — R$${amount}`,
    });

    return new Response(
      JSON.stringify({
        paymentId: payment.id,
        pixCode: qrData.payload,
        pixQrCodeImage: qrData.encodedImage,
        expiresAt: qrData.expirationDate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
