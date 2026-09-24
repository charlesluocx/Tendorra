-- Postgres grants EXECUTE on new functions to PUBLIC. Lock every function down,
-- then grant only what each role actually needs.
revoke execute on function
  public.is_platform_admin(),
  public.is_org_member(uuid),
  public.org_role_of(uuid),
  public.is_org_admin(uuid),
  public.handle_new_user(),
  public.touch_updated_at(),
  public.create_organization(text, text),
  public.accept_invitation(text),
  public.get_invitation(text)
from public, anon, authenticated;

-- Used inside RLS policies, which only apply to signed-in users.
grant execute on function
  public.is_platform_admin(),
  public.is_org_member(uuid),
  public.org_role_of(uuid),
  public.is_org_admin(uuid)
to authenticated;

-- App RPCs.
grant execute on function public.create_organization(text, text), public.accept_invitation(text) to authenticated;
-- The invite landing page shows the company name before the visitor signs in.
grant execute on function public.get_invitation(text) to anon, authenticated;
