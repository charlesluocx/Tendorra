CREATE TABLE public.project_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_documents TO authenticated;
GRANT ALL ON public.project_documents TO service_role;

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their project documents"
ON public.project_documents FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

CREATE INDEX idx_project_documents_project_id ON public.project_documents(project_id);

CREATE POLICY "Owners can read their project files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-documents' AND EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.owner_id = auth.uid() AND p.id::text = (storage.foldername(name))[1]
));

CREATE POLICY "Owners can upload their project files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-documents' AND EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.owner_id = auth.uid() AND p.id::text = (storage.foldername(name))[1]
));

CREATE POLICY "Owners can delete their project files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-documents' AND EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.owner_id = auth.uid() AND p.id::text = (storage.foldername(name))[1]
));
