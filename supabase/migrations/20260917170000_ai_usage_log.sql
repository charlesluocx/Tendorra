-- AI usage/token logging for internal cost tracking (Phase 1: no caps or
-- billing yet, just visibility per company/project/feature).
create table public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  feature text not null default 'email_parse' check (feature in ('email_parse')),
  source_id uuid,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer generated always as (input_tokens + output_tokens) stored,
  created_at timestamptz not null default now()
);

create index ai_usage_log_company_idx on public.ai_usage_log(company_id, created_at desc);

grant select on public.ai_usage_log to authenticated;
grant all on public.ai_usage_log to service_role;

alter table public.ai_usage_log enable row level security;

create policy "Company members can view their company's AI usage"
  on public.ai_usage_log for select to authenticated
  using (public.is_company_member(company_id));
