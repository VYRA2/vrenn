-- 1. Hide qrcode_token from direct reads (use get_local_qrcode_token RPC)
REVOKE SELECT (qrcode_token) ON public.locais_validacao FROM authenticated, anon;

-- 2. Storage: stories media must mirror stories table visibility
DROP POLICY IF EXISTS "stories_read_auth" ON storage.objects;
CREATE POLICY "stories_read_visible" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'stories'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.media_url LIKE '%' || storage.objects.name
        AND s.expires_at > now()
        AND (
          s.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = s.user_id AND p.perfil_publico = true)
          OR EXISTS (SELECT 1 FROM public.follows f WHERE f.following_id = s.user_id AND f.follower_id = auth.uid() AND f.status = 'aceito')
        )
    )
  )
);

-- 3. Revoke anon EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.entrar_na_equipe(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_equipe_membros(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verificar_temporadas_encerradas() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verificar_objetivo_km_meta() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verificar_objetivo_km_duelo() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trigger_push_on_message() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.entrar_na_equipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_equipe_membros(uuid) TO authenticated;