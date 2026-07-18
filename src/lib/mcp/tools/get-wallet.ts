import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForMcpUser } from "../supabase";

export default defineTool({
  name: "get_my_wallet",
  title: "Get my wallet",
  description: "Return the signed-in VRENN user's wallet balance and locked balance (BRL).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForMcpUser(ctx);
    const { data, error } = await sb
      .from("wallets")
      .select("balance, locked_balance, updated_at")
      .eq("user_id", ctx.getUserId()!)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const wallet = data ?? { balance: 0, locked_balance: 0, updated_at: null };
    return {
      content: [
        {
          type: "text",
          text: `Saldo disponível: R$${wallet.balance} — bloqueado: R$${wallet.locked_balance}`,
        },
      ],
      structuredContent: { wallet },
    };
  },
});
