import { supabase } from "@/integrations/supabase/client";

/**
 * Busca o token do QR Code de um local.
 * Só retorna valor para quem pode exibir o QR (criador do local,
 * dono da meta ou criador do desafio) — validado no servidor.
 */
export async function fetchQrToken(localId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_local_qrcode_token", { _local_id: localId });
  if (error) return null;
  return (data as string | null) ?? null;
}

/**
 * Valida um token lido pela câmera sem nunca expor o token real ao cliente.
 */
export async function validarQrToken(localId: string, token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("validar_qrcode_local", {
    _local_id: localId,
    _token: token,
  } as never);
  if (error) return false;
  return data === true;
}
