import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForMcpUser } from "../supabase";

export default defineTool({
  name: "create_meta",
  title: "Create goal",
  description: "Create a new goal (meta) for the signed-in VRENN user.",
  inputSchema: {
    titulo: z.string().trim().min(1).describe("Goal title."),
    categoria: z.string().trim().min(1).describe("Category slug, e.g. fitness, estudo, financeiro."),
    descricao: z.string().trim().optional().describe("Optional description."),
    prazo: z
      .string()
      .optional()
      .describe("Optional deadline as ISO date (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async ({ titulo, categoria, descricao, prazo }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForMcpUser(ctx);
    const { data, error } = await sb
      .from("metas")
      .insert({
        user_id: ctx.getUserId(),
        titulo,
        categoria,
        descricao: descricao ?? null,
        prazo: prazo ?? null,
      })
      .select("id, titulo, categoria, status, prazo")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Meta criada: ${data.titulo} (${data.id})` }],
      structuredContent: { meta: data },
    };
  },
});
