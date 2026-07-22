import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_ID = "52fd9ebb-5d88-4b33-acc3-97b70c62a426";
const SEED_EMAIL_DOMAIN = "seed.vrenn.test";
const SEED_PASSWORD = "Seed@Vrenn2026!";

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Diego", "Elisa", "Fernando", "Gabi", "Hugo", "Isabela", "João",
  "Karina", "Lucas", "Marina", "Nathan", "Olivia", "Pedro", "Quiteria", "Rafael", "Sofia", "Thiago",
  "Ursula", "Vitor", "Wagner", "Yasmin", "Zeca", "Amanda", "Bernardo", "Camila", "Daniel", "Eduarda",
  "Felipe", "Giovana", "Henrique", "Iara", "Julio", "Larissa", "Mateus", "Nicole", "Otavio", "Paula",
];
const LAST_NAMES = [
  "Silva", "Souza", "Costa", "Pereira", "Almeida", "Ribeiro", "Cardoso", "Gomes", "Nunes", "Barbosa",
  "Rocha", "Melo", "Dias", "Teixeira", "Moreira", "Carvalho", "Vieira", "Araujo", "Fernandes", "Freitas",
];
const CATEGORIAS = ["fitness", "saude", "estudos", "financas", "habitos", "outro"];
const META_TITULOS = [
  "Correr 5km em 30 dias", "Ler um livro por mês", "Meditar 10 minutos por dia", "Economizar R$500",
  "Fazer 100 flexões diárias", "Estudar inglês 1h por dia", "Beber 2L de água", "Dormir 8h por noite",
  "Aprender violão", "Cortar açúcar", "Correr uma maratona", "Terminar curso online",
  "Perder 5kg", "Ganhar massa muscular", "Fazer yoga 3x por semana",
];
const POST_LEGENDAS = [
  "Mais um dia, mais um passo. 💪", "Bora! Nada de desculpa hoje.", "Consistência > motivação.",
  "Cumpri o que combinei comigo. ✅", "Sem parar. Foco no processo.", "Hoje foi difícil mas fui.",
  "Semana produtiva. 🔥", "Rotina virando identidade.", "O jogo é longo. Segue.",
];

function randPick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function nivelPorReputacao(pts: number) {
  if (pts >= 4000) return 5;
  if (pts >= 1500) return 4;
  if (pts >= 600) return 3;
  if (pts >= 200) return 2;
  return 1;
}

async function assertAdmin(userId: string) {
  if (userId !== ADMIN_ID) {
    throw new Response("Forbidden: admin only", { status: 403 });
  }
}

// PHASE 1: Create a batch of fake users (auth.users + profiles + wallets).
export const seedUsersBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { startIndex: number; count: number }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created: string[] = [];
    for (let i = 0; i < data.count; i++) {
      const idx = data.startIndex + i;
      const first = randPick(FIRST_NAMES);
      const last = randPick(LAST_NAMES);
      const nome = `${first} ${last}`;
      const username = `seed_${first.toLowerCase()}_${idx}`;
      const email = `seed-${idx}@${SEED_EMAIL_DOMAIN}`;

      const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { nome, username, seed: true },
      });
      if (error || !user?.user) {
        // Skip conflicts (email/username already exists), continue
        continue;
      }
      const uid = user.user.id;
      const reputacao = randInt(0, 5000);
      const nivel = nivelPorReputacao(reputacao);
      const streak = randInt(0, 120);
      const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}`;

      await supabaseAdmin.from("profiles").update({
        nome,
        username,
        avatar_url: avatarUrl,
        bio: `Meta: ${randPick(META_TITULOS)}`,
        nivel,
        streak_dias: streak,
        reputacao_pts: reputacao,
        creditos: randInt(0, 100),
        perfil_publico: true,
        onboarding_done: true,
        is_seed: true,
      }).eq("id", uid);

      await supabaseAdmin.from("wallets").upsert({
        user_id: uid,
        balance: randInt(0, 500),
        locked_balance: 0,
        is_seed: true,
      });

      created.push(uid);
    }

    return { created, createdCount: created.length };
  });

// PHASE 2: Given the list of seeded user ids, create metas + posts + follows + duelos.
export const seedContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const uids = data.userIds;
    if (uids.length === 0) return { metas: 0, posts: 0, duelos: 0, follows: 0 };

    // Metas: ~2.5 per user
    const metasRows: any[] = [];
    for (const uid of uids) {
      const n = randInt(1, 4);
      for (let i = 0; i < n; i++) {
        const status = randPick(["em_andamento", "em_andamento", "concluida", "falhada"]);
        metasRows.push({
          user_id: uid,
          titulo: randPick(META_TITULOS),
          categoria: randPick(CATEGORIAS),
          descricao: "Meta gerada automaticamente para testes.",
          prazo: new Date(Date.now() + randInt(-30, 60) * 86400000).toISOString(),
          progresso: status === "concluida" ? 100 : status === "falhada" ? randInt(0, 60) : randInt(10, 90),
          status,
          tipo_validacao: "foto_arbitro",
          valor_custodia: 0,
          frequencia_tipo: "total",
          frequencia_quantidade: randInt(1, 10),
          is_seed: true,
        });
      }
    }
    const { data: metasCreated } = await supabaseAdmin.from("metas").insert(metasRows).select("id, user_id");

    // Posts: ~4 per user
    const postsRows: any[] = [];
    for (const uid of uids) {
      const n = randInt(2, 6);
      for (let i = 0; i < n; i++) {
        postsRows.push({
          user_id: uid,
          tipo: randPick(["checkin", "conquista_meta", "reflexao"]),
          legenda: randPick(POST_LEGENDAS),
          auto_gerado: false,
          hashtags: ["VRENN", randPick(CATEGORIAS)],
          is_seed: true,
        });
      }
    }
    const { data: postsCreated } = await supabaseAdmin.from("posts").insert(postsRows).select("id, user_id");

    // Follows: each seeded user follows 5-15 other seeded users + follows admin
    const followRows: any[] = [];
    for (const uid of uids) {
      const targets = new Set<string>();
      const nFollows = randInt(5, 15);
      while (targets.size < nFollows && targets.size < uids.length - 1) {
        const t = randPick(uids);
        if (t !== uid) targets.add(t);
      }
      // Also follow admin so admin's feed is populated
      targets.add(ADMIN_ID);
      for (const t of targets) {
        followRows.push({ follower_id: uid, following_id: t, status: "aceito", is_seed: true });
      }
    }
    // Chunk inserts to keep payloads small
    let followsInserted = 0;
    for (let i = 0; i < followRows.length; i += 500) {
      const chunk = followRows.slice(i, i + 500);
      const { data: ins } = await supabaseAdmin.from("follows").upsert(chunk, { onConflict: "follower_id,following_id", ignoreDuplicates: true }).select("id");
      followsInserted += ins?.length ?? 0;
    }

    // Duelos: ~1 per 4 users, between random seeded pairs
    const duelosRows: any[] = [];
    const nDuelos = Math.floor(uids.length / 4);
    for (let i = 0; i < nDuelos; i++) {
      const a = randPick(uids); const b = randPick(uids);
      if (a === b) continue;
      const status = randPick(["pendente", "em_andamento", "concluido"]);
      duelosRows.push({
        challenger_id: a,
        opponent_id: b,
        titulo: randPick(META_TITULOS),
        categoria: randPick(CATEGORIAS),
        prazo: new Date(Date.now() + 14 * 86400000).toISOString(),
        valor_custodia: 0,
        status,
        progresso_challenger: status === "concluido" ? 100 : randInt(0, 80),
        progresso_opponent: status === "concluido" ? 100 : randInt(0, 80),
        winner_id: status === "concluido" ? a : null,
        frequencia_tipo: "total",
        is_seed: true,
      });
    }
    const { data: duelosCreated } = duelosRows.length
      ? await supabaseAdmin.from("duelos").insert(duelosRows).select("id")
      : { data: [] as any[] };

    // Likes: random 3-8 posts each seeded user likes
    if (postsCreated && postsCreated.length > 0) {
      const likeRows: any[] = [];
      for (const uid of uids) {
        const n = randInt(3, 8);
        const targets = new Set<string>();
        while (targets.size < n && targets.size < postsCreated.length) {
          targets.add(randPick(postsCreated).id);
        }
        for (const pid of targets) {
          likeRows.push({ user_id: uid, post_id: pid, is_seed: true });
        }
      }
      for (let i = 0; i < likeRows.length; i += 500) {
        await supabaseAdmin.from("post_likes").upsert(likeRows.slice(i, i + 500), { onConflict: "user_id,post_id", ignoreDuplicates: true });
      }
    }

    return {
      metas: metasCreated?.length ?? 0,
      posts: postsCreated?.length ?? 0,
      duelos: duelosCreated?.length ?? 0,
      follows: followsInserted,
    };
  });

// Cleanup: delete ALL seeded data (is_seed=true). Cascade handles children where possible;
// otherwise, delete in reverse dependency order.
export const seedCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const counts: Record<string, number> = {};

    // Delete children first
    const childTables = [
      "post_likes", "post_comments", "checkins", "notificacoes", "follows",
      "transactions", "duelos", "posts", "metas", "equipe_membros", "desafios_equipe", "equipes",
    ] as const;
    for (const t of childTables) {
      const { data } = await supabaseAdmin.from(t).delete().eq("is_seed", true).select("id");
      counts[t] = data?.length ?? 0;
    }
    // Wallets are FK'd to auth.users; delete before deleting users
    {
      const { data } = await supabaseAdmin.from("wallets").delete().eq("is_seed", true).select("user_id");
      counts.wallets = data?.length ?? 0;
    }

    // Delete seed auth users -> cascades to profiles (id FK ON DELETE CASCADE)
    const { data: seedProfiles } = await supabaseAdmin.from("profiles").select("id").eq("is_seed", true);
    let usersDeleted = 0;
    for (const p of seedProfiles ?? []) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(p.id);
      if (!error) usersDeleted++;
    }
    counts.users = usersDeleted;

    return { ok: true, deleted: counts };
  });

// Status: how many seeded records exist right now.
export const seedStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = ["profiles", "metas", "posts", "duelos", "follows", "wallets"] as const;
    const result: Record<string, number> = {};
    for (const t of tables) {
      const { count } = await supabaseAdmin.from(t).select("*", { count: "exact", head: true }).eq("is_seed", true);
      result[t] = count ?? 0;
    }
    return result;
  });
