# Tendorra v2

A multi-company platform for managing property development projects. Staff sign in to their company's private workspace.
The first tool is **Project Timeline**: drag emails in from Outlook or Gmail, and Claude turns them into a visual
project history with the major milestones flagged.

- **Multi-tenant**: every company is an isolated workspace. Row Level Security in Postgres enforces the isolation, so one company can never read another's data, even through a bug in the app.
- **Roles**: owner, admin and member inside each company. Platform admins (you) get the **Admin console** at `/admin`, which can see across all companies.
- **Pluggable tools**: new tools are added to one registry, and each company switches them on or off.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, Tailwind CSS 4 |
| Auth, DB, file storage | Supabase (Postgres + RLS, Auth, Storage bucket `emails`) |
| AI | Claude via `@anthropic-ai/sdk` with structured outputs (`claude-opus-5`, server-side refusal fallback enabled) |
| Email parsing | In the browser: `@kenjiuno/msgreader` (Outlook `.msg`), `postal-mime` (`.eml`) |
| Hosting | Vercel |

## Setup (about 10 minutes)

### 1. Supabase

1. Create a new Supabase project called `tendorrav2`. The free plan allows 2 active projects per account, so pause or upgrade another project if needed.
2. Apply the migrations in order. Either:
   - SQL Editor: paste and run `supabase/migrations/0001_init.sql`, then `0002_seed_platform_admin.sql`, or
   - CLI: `supabase link --project-ref <ref> && supabase db push`
3. Authentication → URL Configuration: set **Site URL** to your Vercel URL and add `https://<your-domain>/auth/callback` to the Redirect URLs.
4. Optional: while testing you can turn off email confirmation (Authentication → Providers → Email).

`0002_seed_platform_admin.sql` makes `charlesluocx@gmail.com` a platform admin. To add more admins, insert rows into
`public.platform_admin_emails` or tick "Platform admin" on the Admin → Users page.

### 2. Environment variables

Copy `.env.example` to `.env.local` for local development, or set the same values in Vercel → Settings → Environment Variables:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page (anon or publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. **Server only**: the admin console uses it |
| `ANTHROPIC_API_KEY` | console.anthropic.com. Optional: without it each email becomes one basic entry |
| `NEXT_PUBLIC_APP_TIMEZONE` | Optional, defaults to `Australia/Sydney` |

### 3. Run and deploy

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
```

On Vercel, import the repo (framework: Next.js; root directory: `tendorrav2` if it is still inside a monorepo), add the env vars, and deploy.

## Using it

1. Sign up → create your company workspace (you become **owner**).
2. Settings → Invite staff → copy the invite link and send it to them. They sign up with that email and join automatically.
3. Project Timeline → New project → open it → drag emails onto the drop zone:
   - **Outlook desktop**: drag messages straight from the inbox into the drop zone (`.msg`). If your Outlook version won't drag into the browser, drag to the desktop first, then drop the file.
   - **Outlook on the web / new Outlook**: open the message → `…` → *Download* (`.eml`), then drop it in.
   - **Gmail**: open the message → `⋮` → *Download message* (`.eml`), then drop it in.
   - Or click **"…or paste the email text"**.
4. Claude reads each email, writes a summary, and adds events and milestones (planned / achieved / missed) to the timeline.
   You can edit anything, promote an event to a milestone, or add entries by hand.
   If the same email is dropped twice (same Message-ID), it is skipped.

## Architecture

```
src/
  proxy.ts                       session refresh + auth gate (Next 16 "proxy", formerly middleware)
  lib/
    auth.ts                      requireProfile / requireOrg(slug) / requireTool / requirePlatformAdmin
    supabase/{client,server,admin}.ts
    tools/registry.ts            ← the tool catalog (add new tools here)
    email/parse.ts               .msg / .eml / text → ParsedEmail (runs in the browser)
    ai/extract.ts                Claude extraction → events & milestones (structured output)
    timeline.ts                  shared categories, colours, types
  app/
    (auth)/login, signup         email + password auth
    onboarding/                  create a company workspace
    invite/[token]/              accept a staff invitation
    o/[slug]/                    company workspace (sidebar lists enabled tools)
      timeline/                  Project Timeline tool
      settings/                  company name, staff, invites, tools, activity
    admin/                       platform admin CRM (service role, platform admins only)
    api/emails/ingest/           parsed email → Claude → emails + timeline_items rows
supabase/migrations/             schema + RLS policies
```

### Data model

- `organizations` (tenant) ← `memberships` (user, role) → `profiles`
- `invitations`, `org_tools` (which tools a company has switched on), `activity_log` (feeds the admin CRM)
- Timeline tool: `projects` → `emails` → `timeline_items` (`kind` = event | milestone, `milestone_status`)
- Storage bucket `emails`: original files at `<org_id>/<project_id>/<uuid>-<filename>`

Every business table has an `org_id` and RLS policies built on `is_org_member()` / `is_org_admin()` / `is_platform_admin()`.
The policies are covered by an isolation test suite (companies can't see or write each other's data, members can't manage
staff, users can't make themselves admin, suspended companies are locked out).

## Adding a new tool

1. Add an entry to `src/lib/tools/registry.ts` (set `status: "live"` when ready).
2. Build its pages under `src/app/o/[slug]/<tool-key>/`, starting each page with
   `const { org } = await requireOrg(slug); await requireTool(org.id, "<tool-key>");`
3. Add tables in a new `supabase/migrations/000N_<tool>.sql`. Always include `org_id` and RLS policies that use
   `public.is_org_member(org_id)`, following the timeline tables as the pattern.
4. Log important actions to `activity_log` so they show up in the admin CRM.

The sidebar, dashboard tiles, Settings → Tools switches and the Admin tool toggles pick the tool up automatically.
