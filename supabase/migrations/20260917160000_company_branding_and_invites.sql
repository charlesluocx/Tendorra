-- Self-serve owner signup + employee invites (Phase 2 groundwork):
-- retire the Phase 1 "single company auto-join" trigger now that multiple
-- companies can exist, and add branding fields + an invite table.

ALTER TABLE public.companies
  ADD COLUMN website text,
  ADD COLUMN logo_url text,
  ADD COLUMN brand_primary text,
  ADD COLUMN brand_secondary text;

-- Phase 1 auto-joined every new signup into the sole company. Now that
-- owner signup creates its own company explicitly (and employees only join
-- via an invite token), that blanket behavior would incorrectly merge
-- unrelated companies' signups together, so it's retired.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

CREATE TABLE public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE INDEX company_invites_company_idx ON public.company_invites(company_id);
CREATE UNIQUE INDEX company_invites_pending_email_idx
  ON public.company_invites(company_id, lower(email))
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can manage company invites"
  ON public.company_invites FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_invites.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_invites.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin')
    )
  );

-- Members can see the roster's roles to know who to promote/demote, but only
-- owners/admins can change roles or remove people.
DROP POLICY IF EXISTS "Members can read their company roster" ON public.company_users;
CREATE POLICY "Members can read their company roster"
  ON public.company_users FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Owners and admins can manage company roster"
  ON public.company_users FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = company_users.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'admin')
    )
  );
