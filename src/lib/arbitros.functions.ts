import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const findUserForInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { identifier: string }) => {
    if (!data?.identifier || typeof data.identifier !== "string") throw new Error("identifier obrigatório");
    return { identifier: data.identifier.trim() };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.identifier.replace(/^@/, "");
    const isEmail = id.includes("@");

    if (!isEmail) {
      const { data: prof, error } = await context.supabase
        .from("profiles")
        .select("id, nome, username, avatar_url")
        .ilike("username", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!prof) throw new Error("Usuário não encontrado");
      return prof;
    }

    // Email lookup via admin API
    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    const match = usersList.users.find((u) => u.email?.toLowerCase() === id.toLowerCase());
    if (!match) throw new Error("Usuário não encontrado por email");
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("id, nome, username, avatar_url")
      .eq("id", match.id)
      .maybeSingle();
    return prof ?? { id: match.id, nome: match.email ?? "Usuário", username: "", avatar_url: null };
  });
