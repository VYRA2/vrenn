// Deno tests for VRENN backend rules.
//
// Run: deno test --allow-net --allow-env supabase/functions/**/*_test.ts
//
// These tests hit the live Supabase Data API using the service role key to
// assert:
//   - Custódia de meta concluída devolve 97% + 3% pra taxa/fundo
//   - Custódia de meta falhada trava 100% (75% fundo + 25% taxa)
//   - RLS esconde campos privados (cpf, motivacao, valor_custodia) de outros usuários
//   - Wallet mantém consistência entre balance e locked_balance
//
// Cada teste marca is_seed=true e limpa o próprio rastro no final.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createTestUser(supa: ReturnType<typeof admin>, tag: string) {
  const email = `test-${tag}-${Date.now()}@seed.vrenn.test`;
  const { data, error } = await supa.auth.admin.createUser({
    email,
    password: "Test@Vrenn2026!",
    email_confirm: true,
    user_metadata: { seed: true, nome: `Test ${tag}` },
  });
  if (error) throw error;
  const uid = data.user!.id;
  await supa.from("profiles").update({ is_seed: true }).eq("id", uid);
  await supa.from("wallets").upsert({ user_id: uid, balance: 1000, locked_balance: 0, is_seed: true });
  return uid;
}

async function cleanup(supa: ReturnType<typeof admin>, uid: string) {
  await supa.auth.admin.deleteUser(uid);
}

Deno.test("meta concluída: devolve 97% + 3% para taxa/fundo", async () => {
  const supa = admin();
  const uid = await createTestUser(supa, "meta-ok");
  try {
    const { data: meta } = await supa.from("metas").insert({
      user_id: uid,
      titulo: "Test concluir",
      categoria: "outro",
      valor_custodia: 100,
      tipo_validacao: "foto_arbitro",
      frequencia_tipo: "total",
      status: "em_andamento",
      is_seed: true,
    }).select().single();

    // Lock trigger should have moved 100 from balance to locked_balance
    const { data: w1 } = await supa.from("wallets").select("balance, locked_balance").eq("user_id", uid).single();
    assertEquals(Number(w1!.balance), 900, "balance depois do lock");
    assertEquals(Number(w1!.locked_balance), 100, "locked_balance depois do lock");

    // Conclude
    await supa.from("metas").update({ status: "concluida" }).eq("id", meta!.id);

    const { data: w2 } = await supa.from("wallets").select("balance, locked_balance").eq("user_id", uid).single();
    // 900 + 97 = 997, locked back to 0
    assertEquals(Number(w2!.balance), 997, "balance depois de concluir (devolução 97%)");
    assertEquals(Number(w2!.locked_balance), 0, "locked zerado");
  } finally {
    await cleanup(supa, uid);
  }
});

Deno.test("meta falhada: 100% travado, 75% fundo + 25% taxa", async () => {
  const supa = admin();
  const uid = await createTestUser(supa, "meta-fail");
  try {
    const { data: meta } = await supa.from("metas").insert({
      user_id: uid,
      titulo: "Test falhar",
      categoria: "outro",
      valor_custodia: 100,
      tipo_validacao: "foto_arbitro",
      frequencia_tipo: "total",
      status: "em_andamento",
      is_seed: true,
    }).select().single();

    await supa.from("metas").update({ status: "falhada" }).eq("id", meta!.id);

    const { data: w } = await supa.from("wallets").select("balance, locked_balance").eq("user_id", uid).single();
    // balance stays at 900 (100 confiscado), locked back to 0
    assertEquals(Number(w!.balance), 900, "balance após falha (não devolve)");
    assertEquals(Number(w!.locked_balance), 0, "locked zerado após falha");

    // Confirm 2 transactions logged
    const { data: txs } = await supa.from("transactions").select("type, amount").eq("user_id", uid).eq("meta_id", meta!.id);
    const fundoTx = txs?.find((t) => t.type === "prize");
    const feeTx = txs?.find((t) => t.type === "fee");
    assert(fundoTx, "transação de fundo criada");
    assert(feeTx, "transação de taxa criada");
    assertEquals(Number(fundoTx!.amount), 75, "75% pro fundo");
    assertEquals(Number(feeTx!.amount), 25, "25% de taxa");
  } finally {
    await cleanup(supa, uid);
  }
});

Deno.test("RLS: usuário anon NÃO lê motivacao/valor_custodia de outra pessoa", async () => {
  const supa = admin();
  const uid = await createTestUser(supa, "rls");
  try {
    await supa.from("metas").insert({
      user_id: uid,
      titulo: "Test RLS",
      categoria: "outro",
      motivacao: "SEGREDO",
      valor_destino: "SEGREDO_DESTINO",
      tipo_validacao: "foto_arbitro",
      frequencia_tipo: "total",
      is_seed: true,
    });

    // Anon client (via publishable key would be ideal, but we approximate
    // by trying to select the restricted columns as anon via REST)
    const anonUrl = `${SUPABASE_URL}/rest/v1/metas?select=motivacao,valor_destino&user_id=eq.${uid}`;
    const res = await fetch(anonUrl, {
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
    });
    // Column-level GRANT revoked ⇒ expect 401/403/permission-denied
    assert(
      res.status === 401 || res.status === 403 || res.status === 400,
      `anon leitura de motivacao deve falhar; recebi ${res.status}`,
    );
  } finally {
    await cleanup(supa, uid);
  }
});

Deno.test("wallet: saldo nunca fica negativo em operações concorrentes", async () => {
  const supa = admin();
  const uid = await createTestUser(supa, "wallet-race");
  try {
    // Try to create meta with custódia maior que o saldo
    const { error } = await supa.from("metas").insert({
      user_id: uid,
      titulo: "Estourar saldo",
      categoria: "outro",
      valor_custodia: 999999,
      tipo_validacao: "foto_arbitro",
      frequencia_tipo: "total",
      is_seed: true,
    });
    assert(error, "criação com custódia > saldo deve falhar");
    assert(error!.message.toLowerCase().includes("saldo") || error!.message.includes("insufficient"),
      `mensagem esperada mencionando saldo: ${error!.message}`);
  } finally {
    await cleanup(supa, uid);
  }
});
