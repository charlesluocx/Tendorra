# Tendorra

Live project-activity tracking for property and construction teams, built on
top of the existing consultant/RFQ tender workflow: tagged emails, quick call
notes, and owner-assigned action items all land in one shared feed per
project, with an automatic flag when a project's gone quiet too long.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Supabase** (Postgres, Auth, Storage) — schema in `supabase/migrations/`
- **Microsoft Graph** for connecting a staff member's own Outlook inbox
- **Anthropic Claude** for turning a tagged email into a structured activity-log entry

## Development

```sh
npm install
cp .env.example .env.local   # fill in the values described below
npm run dev
```

Open http://localhost:3000, sign up, and you'll be auto-joined to the
company's single team (see "Multi-tenancy" below).

## Environment variables

See `.env.example` for the full list and where to get each value. In short:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already
  filled in `.env.example`; safe to expose to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` — from the Supabase dashboard. Server-only,
  bypasses RLS; used for writing OAuth tokens and other trusted operations.
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` —
  from an Entra ID (Azure AD) app registration. Required for the "Connect
  Outlook" flow under Inbox Settings.
- `ANTHROPIC_API_KEY` — required for AI parsing of tagged emails.

The app runs and lets you use call notes, manual updates, action items, and
the checklist without any of the Microsoft/Anthropic keys — those are only
needed for the email-tagging flow.

## Database

All schema changes are plain SQL migrations in `supabase/migrations/`,
applied in filename order. To apply them to a Supabase project, use the
Supabase CLI (`supabase db push`) or the SQL editor in the dashboard.

### Multi-tenancy (`company_id` + RLS)

Every tenant-owned table (`projects` and everything that hangs off a
project — activity, call notes, action items, checklist items, tagged
emails, connected inboxes) carries a `company_id` and is scoped by Row Level
Security through `public.is_company_member(company_id)`. Phase 1 runs a
single company; new signups auto-join it (see `handle_new_auth_user` in
`20260917140000_activity_tracking.sql`). Turning this into a self-serve,
billed product (Phase 2) is a matter of:

1. Building a signup flow that creates a new `companies` row instead of
   relying on the single-company auto-join trigger.
2. Adding Stripe billing + plan/usage-cap enforcement.
3. Everything else — RLS, the schema, the auto-flag rule — already works
   per-company with no further schema changes.

The `consultant_categories` and `consultants` tables are the one
intentional exception: they're a cross-company marketplace/taxonomy by
design (see the existing "true" SELECT policies from before this module),
not tenant-owned data, so they were left without a `company_id`.

### Key tables

- `activity_log` — the feed: one row per email/call-note/manual update, with
  `commitments`/`key_dates` extracted by AI for emails.
- `call_notes` — quick capture form; a trigger mirrors every insert into
  `activity_log` automatically.
- `action_items` — owner-assigned, with `status` and `due_date`.
- `lifecycle_phases` / `lifecycle_checklist_items` — the shared
  Feasibility → Approval → Construction → Handover template.
- `project_checklist_items` — per-project instance of that template,
  seeded automatically when a project is created; tracks `expected_at`
  (planned) separately from `completed_at` (actual).
- `connected_inboxes` — one row per staff member's connected Outlook
  account. Access/refresh tokens are readable only by the service role
  (column-level `GRANT`); the client only ever sees connection status.
- `tagged_emails` — an email a staff member tagged to a project; drives the
  AI-parsing pipeline into `activity_log`.
- `project_activity_status` — a view computing `is_stale` per project from
  `companies.stale_after_days` (defaults to 7), used for the "gone quiet"
  flag on the dashboard.

## What's not built yet

This covers Phase 1 of the module (activity feed, call notes, action items,
checklist, email tagging + AI parsing, the stale-project flag) on top of the
existing consultant/RFQ tender flow. Not in this pass:

- A push/email/Slack **reminders engine** — today the "gone quiet" flag is
  surfaced in the dashboard UI only, not proactively pushed to anyone.
- The **public tender board** (a separate area where owners can flag a job
  public for consultants to browse) — the existing private
  invite-a-consultant flow is untouched and still works.
- **Deployment** — pick a host (Vercel is the natural fit for Next.js),
  connect this repo, and set the environment variables above in its
  dashboard.
- **Stripe billing / Phase 2 self-serve signup** — see "Multi-tenancy" above
  for what's already in place versus what Phase 2 still needs.
