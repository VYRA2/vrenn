import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const findUserForInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { identifier: string }) => {
    if (!data?.identifier || typeof data.identifier !== "string") throw new Error("identifier obrigatório");
    return { identifier: data.identifier.trim() };
  })
  .handler(async ({ data, context }) => {
    const id = data.identifier.replace(/^@/, "");
    if (id.includes("@")) throw new Error("Use apenas o @username público");
    const { data: prof, error } = await context.supabase
      .from("profiles")
      .select("id, nome, username, avatar_url")
      .ilike("username", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prof) throw new Error("Usuário não encontrado");
    return prof;
  });
