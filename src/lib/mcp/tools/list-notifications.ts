import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForMcpUser } from "../supabase";

export default defineTool({
  name: "list_my_notifications",
  title: "List my notifications",
  description: "List the signed-in VRENN user's recent notifications.",
  inputSchema: {
    only_unread: z.boolean().optional().describe("If true, return only unread notifications."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_unread, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForMcpUser(ctx);
    let q = sb
      .from("notificacoes")
      .select("id, tipo, mensagem, lida, link_id, created_at")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (only_unread) q = q.eq("lida", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { notifications: data ?? [] },
    };
  },
});
