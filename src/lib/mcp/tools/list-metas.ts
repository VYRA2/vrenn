import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForMcpUser } from "../supabase";

export default defineTool({
  name: "list_my_metas",
  title: "List my goals",
  description: "List the signed-in VRENN user's own goals (metas), optionally filtered by status.",
  inputSchema: {
    status: z
      .enum(["ativa", "concluida", "abandonada", "falhada"])
      .optional()
      .describe("Filter by goal status. Omit to return all statuses."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForMcpUser(ctx);
    let q = sb
      .from("metas")
      .select("id, titulo, categoria, status, progresso, prazo, created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { metas: data ?? [] },
    };
  },
});
