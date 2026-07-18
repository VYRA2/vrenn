import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMetas from "./tools/list-metas";
import createMeta from "./tools/create-meta";
import getWallet from "./tools/get-wallet";
import listNotifications from "./tools/list-notifications";

// Direct Supabase issuer (never the .lovable.cloud proxy) — required by
// mcp-js RFC 8414 issuer verification.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "vrenn-mcp",
  title: "VRENN",
  version: "0.1.0",
  instructions:
    "Ferramentas do VRENN. Use `list_my_metas` para ver as metas do usuário, `create_meta` para criar uma nova, `get_my_wallet` para consultar o saldo da carteira e `list_my_notifications` para ver notificações recentes. Todas operam como o usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMetas, createMeta, getWallet, listNotifications],
});
