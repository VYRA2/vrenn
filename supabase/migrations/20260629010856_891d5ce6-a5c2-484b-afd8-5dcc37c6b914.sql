
-- Avatars: leitura pública, escrita por dono (path começa com user_id)
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars owner upload" ON storage.objects;
CREATE POLICY "Avatars owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatars owner update" ON storage.objects;
CREATE POLICY "Avatars owner update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatars owner delete" ON storage.objects;
CREATE POLICY "Avatars owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Checkins: leitura pública, dono escreve
DROP POLICY IF EXISTS "Checkins public read" ON storage.objects;
CREATE POLICY "Checkins public read" ON storage.objects FOR SELECT USING (bucket_id = 'checkins');

DROP POLICY IF EXISTS "Checkins owner upload" ON storage.objects;
CREATE POLICY "Checkins owner upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'checkins' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Checkins owner update" ON storage.objects;
CREATE POLICY "Checkins owner update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'checkins' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Checkins owner delete" ON storage.objects;
CREATE POLICY "Checkins owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'checkins' AND auth.uid()::text = (storage.foldername(name))[1]);
