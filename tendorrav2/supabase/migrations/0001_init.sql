-- Tendorra v2 — initial schema
-- Multi-tenant: every business row carries org_id and is protected by RLS.
-- Platform admins (Tendorra staff) can read everything via is_platform_admin().

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'member');
create type public.org_status as enum ('active', 'suspended');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
create type public.timeline_kind as enum ('event', 'milestone');
create type public.milestone_status as enum ('planned', 'achieved', 'missed');
create type public.email_format as enum ('eml', 'msg', 'text');

-- ---------------------------------------------------------------------------
-- Platform admin allowlist: emails listed here become platform admins on signup
-- ---------------------------------------------------------------------------
create table public.platform_admin_emails (
  email text primary key
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Organizations (tenants) & memberships
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  status public.org_status not null default 'active',
  plan text not null default 'free',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.org_role not null default 'member' check (role <> 'owner'),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations (org_id);

-- Which tools each organization has switched on (tool catalog lives in app code)
create table public.org_tools (
  org_id uuid not null references public.organizations (id) on delete cascade,
  tool_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (org_id, tool_key)
);

-- ---------------------------------------------------------------------------
-- Tool: Project Timeline
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  code text,
  address text,
  description text,
  status public.project_status not null default 'active',
  start_date date,
  target_end_date date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_org_idx on public.projects (org_id);

create table public.emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  subject text,
  from_name text,
  from_address text,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  sent_at timestamptz,
  body_text text,
  message_id text,
  file_name text,
  source_format public.email_format not null,
  attachments jsonb not null default '[]',
  storage_path text,
  ai_summary text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index emails_project_idx on public.emails (project_id, sent_at);
create index emails_org_idx on public.emails (org_id);
-- Same email dropped twice into the same project is ignored
create unique index emails_dedupe_idx on public.emails (project_id, message_id) where message_id is not null;

create table public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  email_id uuid references public.emails (id) on delete set null,
  kind public.timeline_kind not null default 'event',
  milestone_status public.milestone_status,
  title text not null check (char_length(title) between 1 and 300),
  summary text,
  category text,
  occurred_at timestamptz not null,
  ai_generated boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestone_status_only_for_milestones
    check ((kind = 'milestone') = (milestone_status is not null))
);
create index timeline_items_project_idx on public.timeline_items (project_id, occurred_at);
create index timeline_items_org_idx on public.timeline_items (org_id);

-- ---------------------------------------------------------------------------
-- Activity log (feeds the admin CRM)
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_log_org_idx on public.activity_log (org_id, created_at desc);
create index activity_log_created_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_platform_admin from public.profiles where id = (select auth.uid())), false);
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.org_id = p_org and m.user_id = (select auth.uid()) and o.status = 'active'
  );
$$;

create or replace function public.org_role_of(p_org uuid)
returns public.org_role language sql stable security definer set search_path = '' as $$
  select role from public.memberships where org_id = p_org and user_id = (select auth.uid());
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_org_member(p_org) and public.org_role_of(p_org) in ('owner', 'admin');
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger timeline_items_touch before update on public.timeline_items
  for each row execute function public.touch_updated_at();

-- New auth user -> profile row (and platform admin flag if allowlisted)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, is_platform_admin)
  values (
    new.id,
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    exists (select 1 from public.platform_admin_emails a where a.email = lower(new.email))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Create an organization; caller becomes owner; default tools switched on.
create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare
  v_org public.organizations;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), v_uid)
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role) values (v_org.id, v_uid, 'owner');
  insert into public.org_tools (org_id, tool_key) values (v_org.id, 'timeline');
  insert into public.activity_log (org_id, user_id, action, entity_type, entity_id, meta)
  values (v_org.id, v_uid, 'organization.created', 'organization', v_org.id, jsonb_build_object('name', v_org.name));

  return v_org;
end;
$$;

-- Accept an invitation by token (must match the signed-in user's email).
create or replace function public.accept_invitation(p_token text)
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations;
  v_org public.organizations;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select lower(email) into v_email from public.profiles where id = v_uid;

  select * into v_inv from public.invitations
  where token = p_token and accepted_at is null and expires_at > now()
  for update;

  if v_inv.id is null then
    raise exception 'invitation is invalid or has expired';
  end if;
  if lower(v_inv.email) <> v_email then
    raise exception 'this invitation was sent to a different email address';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, user_id) do nothing;

  update public.invitations set accepted_at = now() where id = v_inv.id;

  insert into public.activity_log (org_id, user_id, action, entity_type, entity_id)
  values (v_inv.org_id, v_uid, 'member.joined', 'invitation', v_inv.id);

  select * into v_org from public.organizations where id = v_inv.org_id;
  return v_org;
end;
$$;

-- Look up an invitation by token for the invite landing page (limited fields).
create or replace function public.get_invitation(p_token text)
returns table (org_name text, email text, role public.org_role, expired boolean, accepted boolean)
language sql stable security definer set search_path = '' as $$
  select o.name, i.email, i.role, i.expires_at < now(), i.accepted_at is not null
  from public.invitations i join public.organizations o on o.id = i.org_id
  where i.token = p_token;
$$;

revoke execute on function public.create_organization(text, text) from anon;
revoke execute on function public.accept_invitation(text) from anon;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.platform_admin_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.org_tools enable row level security;
alter table public.projects enable row level security;
alter table public.emails enable row level security;
alter table public.timeline_items enable row level security;
alter table public.activity_log enable row level security;

-- platform_admin_emails: platform admins only
create policy "platform admins manage allowlist" on public.platform_admin_emails
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- profiles: self, co-members, platform admins
create policy "read own or co-member profiles" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or public.is_platform_admin()
    or exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.org_id = mine.org_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Users may only change their display name (never email or admin flag)
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- organizations
create policy "members read their orgs" on public.organizations
  for select to authenticated using (public.is_org_member(id) or public.is_platform_admin());
create policy "org admins update their org" on public.organizations
  for update to authenticated using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- memberships
create policy "members read memberships of their orgs" on public.memberships
  for select to authenticated using (public.is_org_member(org_id) or user_id = (select auth.uid()) or public.is_platform_admin());
create policy "org admins manage memberships" on public.memberships
  for update to authenticated using (public.is_org_admin(org_id) and role <> 'owner')
  with check (public.is_org_admin(org_id) and role <> 'owner');
create policy "org admins remove members or self leave" on public.memberships
  for delete to authenticated using ((public.is_org_admin(org_id) or user_id = (select auth.uid())) and role <> 'owner');

-- invitations
create policy "org admins read invitations" on public.invitations
  for select to authenticated using (public.is_org_admin(org_id) or public.is_platform_admin());
create policy "org admins create invitations" on public.invitations
  for insert to authenticated with check (public.is_org_admin(org_id) and invited_by = (select auth.uid()));
create policy "org admins delete invitations" on public.invitations
  for delete to authenticated using (public.is_org_admin(org_id));

-- org_tools
create policy "members read org tools" on public.org_tools
  for select to authenticated using (public.is_org_member(org_id) or public.is_platform_admin());
create policy "org admins insert org tools" on public.org_tools
  for insert to authenticated with check (public.is_org_admin(org_id));
create policy "org admins update org tools" on public.org_tools
  for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- projects
create policy "members read projects" on public.projects
  for select to authenticated using (public.is_org_member(org_id) or public.is_platform_admin());
create policy "members create projects" on public.projects
  for insert to authenticated with check (public.is_org_member(org_id) and created_by = (select auth.uid()));
create policy "members update projects" on public.projects
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org admins delete projects" on public.projects
  for delete to authenticated using (public.is_org_admin(org_id));

-- emails
create policy "members read emails" on public.emails
  for select to authenticated using (public.is_org_member(org_id) or public.is_platform_admin());
create policy "members add emails" on public.emails
  for insert to authenticated with check (
    public.is_org_member(org_id) and created_by = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.org_id = emails.org_id)
  );
create policy "members update emails" on public.emails
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "members delete emails" on public.emails
  for delete to authenticated using (public.is_org_member(org_id));

-- timeline items
create policy "members read timeline" on public.timeline_items
  for select to authenticated using (public.is_org_member(org_id) or public.is_platform_admin());
create policy "members add timeline" on public.timeline_items
  for insert to authenticated with check (
    public.is_org_member(org_id) and created_by = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.org_id = timeline_items.org_id)
  );
create policy "members update timeline" on public.timeline_items
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "members delete timeline" on public.timeline_items
  for delete to authenticated using (public.is_org_member(org_id));

-- activity log
create policy "org admins read activity" on public.activity_log
  for select to authenticated using (public.is_org_admin(org_id) or public.is_platform_admin());
create policy "members write activity" on public.activity_log
  for insert to authenticated with check (
    user_id = (select auth.uid()) and (org_id is null or public.is_org_member(org_id))
  );

-- ---------------------------------------------------------------------------
-- Storage: raw email files, path = <org_id>/<project_id>/<uuid>-<filename>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('emails', 'emails', false, 26214400)
on conflict (id) do nothing;

create policy "members read org email files" on storage.objects
  for select to authenticated using (
    bucket_id = 'emails'
    and (public.is_org_member(((storage.foldername(name))[1])::uuid) or public.is_platform_admin())
  );
create policy "members upload org email files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'emails' and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
create policy "members delete org email files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'emails' and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
