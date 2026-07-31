DROP POLICY IF EXISTS "stories_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "stories_read_auth" ON storage.objects;
DROP POLICY IF EXISTS "stories_delete_own" ON storage.objects;

CREATE POLICY "stories_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "stories_read_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stories');

CREATE POLICY "stories_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);