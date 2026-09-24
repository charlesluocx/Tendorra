-- Owners/admins can edit their own company's settings (name, stale-after
-- threshold, website/branding) from a new /settings/company page. There was
-- previously no UPDATE policy on companies at all — only the bootstrap
-- SELECT policy from the multi-tenant migration.
CREATE POLICY "Owners and admins can update their company"
  ON public.companies FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = companies.id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = companies.id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin')
    )
  );
