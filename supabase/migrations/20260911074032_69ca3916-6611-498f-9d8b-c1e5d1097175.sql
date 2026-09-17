DROP POLICY IF EXISTS "Owners can upload their project files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read their project files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their project files" ON storage.objects;

CREATE POLICY "Owners can upload their project files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-documents'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid()
      AND p.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Owners can read their project files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-documents'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid()
      AND p.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Owners can delete their project files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-documents'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid()
      AND p.id::text = (storage.foldername(storage.objects.name))[1]
  )
);
