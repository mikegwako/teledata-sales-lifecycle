
-- Fix storage policies (drop first if exist)
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can view documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
