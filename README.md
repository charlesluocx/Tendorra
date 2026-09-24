# Tendorra

Live project-activity tracking for property and construction teams, built on
top of the existing consultant/RFQ tender workflow: emails dragged onto a
project, quick call notes, and owner-assigned action items all land in one
shared feed per project, with an automatic flag when a project's gone quiet
too long.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Supabase** (Postgres, Auth, Storage) — schema in `supabase/migrations/`
- **mailparser** / **@kenjiuno/msgreader** for reading dragged-in `.eml`/`.msg` email files
- **Cloudflare Workers AI** for turning a logged email into a structured activity-log entry

## Development

```sh
npm install
cp .env.example .env.local   # fill in the values described below
npm run dev
```

Open http://localhost:3000/signup to create a company (you become its
`owner`), or open an `/invite/<token>` link from an owner/admin to join an
existing one. See "Signup, teams, and branding" below.

### Internal testing (staff who aren't on your machine)

- **Same office network:** `npm run dev -- -H 0.0.0.0`, then have them open
  `http://<your-machine's-LAN-IP>:3000` (find the IP with `ipconfig` /
  `ifconfig`). May need to allow port 3000 through your firewall.
- **Remote/distributed staff:** `./scripts/tunnel.sh` (needs
  [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
  installed) runs the dev server and a Cloudflare Tunnel together, printing
  a shareable `https://*.trycloudflare.com` URL — no deployment, no port
  forwarding. Keep the terminal open for as long as staff are testing.

Either way this hits your live Supabase project, so treat it as real data —
worth using throwaway test accounts/companies rather than production ones.

## Environment variables

See `.env.example` for the full list and where to get each value. In short:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already
  filled in `.env.example`; safe to expose to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` — from the Supabase dashboard. Server-only,
  bypasses RLS; used for the one write (`ai_usage_log`) that needs it.
- `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` — required for AI parsing
  of an uploaded email, via Cloudflare Workers AI (free daily allocation,
  no card required — see `.env.example`).

The app runs and lets you use call notes, manual updates, action items, and
the checklist without the Cloudflare keys. You can still drag an email in
without them — it's recorded (so dedup still works, and you won't get a
duplicate once the key is added), but nothing shows up on the visible
Timeline/Activity Feed until the Cloudflare keys are set, since that entry
only gets created once AI parsing succeeds.

## Deployment

This app runs on **Cloudflare Workers** via the [OpenNext Cloudflare
adapter](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare` +
`wrangler`), not Vercel — Cloudflare Workers' free tier (100k
requests/day) allows commercial use with no plan upgrade required, unlike
Vercel's Hobby tier, which is personal/non-commercial only. That matters
here since this module is headed toward a paid multi-tenant product
(Phase 2).

```sh
npx wrangler login          # one-time: connect your Cloudflare account
npm run deploy               # builds with OpenNext and deploys the Worker
```

Before your first deploy, set the same variables from `.env.example` as
Worker secrets (`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, etc.) —
`wrangler.jsonc` doesn't commit secret values, only the non-secret config.

### Auto-deploy on push

`.github/workflows/deploy.yml` redeploys on every push to
`claude/keen-volta-1lwssa`. It needs two **GitHub Actions repo secrets**
(Settings → Secrets and variables → Actions, not committed anywhere):

- `CLOUDFLARE_API_TOKEN` — a token scoped to `Account.Workers Scripts: Edit`
  (the "Edit Cloudflare Workers" template works)
- `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard sidebar

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, etc.) still go through
`wrangler secret put` once, directly against the Worker — the workflow
doesn't touch those.
`npm run preview` builds and runs the Worker locally against
`http://localhost:8787` using the real Workers runtime (closer to
production than `next dev`, which uses Node directly).

Config lives in `wrangler.jsonc` and `open-next.config.ts`; both are
intentionally minimal — no KV/D1/R2 bindings are used yet.

## Database

All schema changes are plain SQL migrations in `supabase/migrations/`,
applied in filename order. To apply them to a Supabase project, use the
Supabase CLI (`supabase db push`) or the SQL editor in the dashboard.

### Multi-tenancy (`company_id` + RLS)

Every tenant-owned table (`projects` and everything that hangs off a
project — activity, call notes, action items, checklist items, tagged
emails, connected inboxes) carries a `company_id` and is scoped by Row Level
Security through `public.is_company_member(company_id)`. Multiple companies
can exist side by side with no cross-visibility. Turning this into a billed
product (Stripe, plan/usage caps) is the only piece Phase 2 still needs —
RLS, the schema, and self-serve signup already work per-company.

The `consultant_categories` and `consultants` tables are the one
intentional exception: they're a cross-company marketplace/taxonomy by
design (see the existing "true" SELECT policies from before this module),
not tenant-owned data, so they were left without a `company_id`.

### Signup, teams, and branding

- **`/signup`** — anyone can create a company here. It becomes the caller's
  company (`companies` row + a `company_users` row with `role = 'owner'`),
  created together in `src/app/signup/actions.ts` via the service-role
  client (an owner can't satisfy the company-membership RLS check before
  their own membership row exists, so this one write path is trusted server
  code, same pattern as other service-role-only writes like `ai_usage_log`).
- Owner signup takes an optional **company website**. If given,
  `src/lib/branding/extract.ts` best-effort fetches it and pulls a logo
  (favicon/apple-touch-icon/`og:image` from the HTML, falling back to
  Google's favicon service so there's always something) and a primary brand
  color (the page's `theme-color` meta tag, or failing that the average
  color of the logo image via `jimp`). A secondary shade and a readable
  text color are derived from that primary in `src/lib/branding/color.ts`.
  None of this blocks signup — a slow or unreachable site just yields no
  branding, and the dashboard uses its default theme.
- The dashboard layout (`src/app/(dashboard)/layout.tsx`) reads the
  signed-in user's company and, if it has a `brand_primary`, overrides the
  `--primary`/`--ring`/`--sidebar-primary` CSS custom properties for that
  request and renders the logo in the header — so the whole shadcn/ui theme
  re-colors per company with no component changes.
- **`/settings/team`** — owners/admins invite by email (`company_invites`,
  one row per pending invite, unique per company+email while pending) and
  can change existing members' roles. If `RESEND_API_KEY` is set (see
  `.env.example`), the invite is also emailed via
  `src/lib/email/send-invite.ts`; either way, the `/invite/<token>` link is
  always shown directly in the UI too, so there's always a fallback to copy
  and send manually if email sending isn't configured or fails.
- **`/invite/[token]`** — public page; the invitee sets a name and password,
  which creates their account and inserts their `company_users` row with
  the role the invite specified, scoped to that one company only.
- **`/settings/company`** — owners/admins can edit the company name, website
  (re-running the branding extraction above on change), and the "gone
  quiet" threshold (`stale_after_days`, used by both the dashboard badge and
  the reminder emails — see "Reminders" below). There was previously no way
  to change `stale_after_days` short of editing the row directly.

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
- `project_email_uploads` — a log of every email dragged onto a project,
  driving the AI-parsing pipeline into `activity_log`. `internet_message_id`
  (the email's RFC 5322 Message-ID, shared by every recipient's copy) has a
  unique index per project so a colleague cc'd on the same email dragging in
  their own copy doesn't record it twice.
- `project_activity_status` — a view computing `is_stale` per project from
  `companies.stale_after_days` (defaults to 7), used for the "gone quiet"
  flag on the dashboard and for the stale-project reminder emails (see
  "Reminders" below). `projects.last_reminder_sent_at` tracks the last time
  each project's owners/admins were emailed about it, so the job below
  doesn't re-send every run.
- `ai_usage_log` — one row per AI call (currently just email parsing), with
  `model`, `input_tokens`, `output_tokens`, and a generated `total_tokens`,
  scoped to the company that triggered it. This is internal cost visibility
  only for now — there's no cap or per-company billing wired to it yet (see
  "What's not built yet"). Viewable at **`/settings/usage`** (any company
  member; shows this month's token total and the last 100 AI calls).

## Project timeline

Every project's page has a drag-and-drop zone
(`src/components/project/email-dropzone.tsx`): drop an email file onto it
and it's read, AI-summarized, and logged straight to that project — no
inbox connection, no OAuth, no scheduled sync job.

- **Drag straight from Outlook desktop** — in Chrome/Edge on Windows,
  dragging an email out of the classic Outlook app produces a virtual
  `.msg` file the browser can read directly, no save step needed.
- **Or drop a saved file** — Gmail's "Show original" → download, or
  Outlook's "Save As" both produce a `.eml` file that works the same way.
- Parsing (`src/lib/email-file-parser.ts`) sniffs the file's content (the
  OLE/CFBF magic bytes for `.msg`, otherwise plain MIME) rather than
  trusting the extension, since a dragged virtual file's name isn't always
  reliable: `.msg` goes through `@kenjiuno/msgreader`, `.eml` through
  `mailparser`.
- The upload is scoped to whichever project's page it landed on — no
  project code to match, since the drop target already says which project.
- Dedupes by the email's RFC 5322 Message-ID (`internetMessageId`/
  `messageId`, shared by every recipient's copy), not any per-mailbox id —
  so if several staff are cc'd on one email and each drags in their own
  copy, it's recorded on the timeline exactly once
  (`project_email_uploads.internet_message_id`).
- The server action (`uploadEmailFile` in `src/app/(dashboard)/projects/
  [id]/actions.ts`) runs the AI parsing (Cloudflare Workers AI) inline and
  writes straight to `activity_log` — no processing queue, no polling.
- Not yet verified running on the actual Cloudflare Workers runtime (only
  local `next dev` so far) — `mailparser` pulls in a few Node built-ins
  that OpenNext's Cloudflare adapter usually polyfills, but this hasn't
  been confirmed end-to-end post-deploy.

The **Timeline** section on each project page (`src/components/project/
timeline.tsx`) plots that project's `activity_log` entries alongside its
checklist milestones (both reached — `completed_at` — and upcoming —
`expected_at`) as one chronological visual timeline, separate from the
more detailed Activity Feed list below it.

## Reminders

`POST /api/cron/stale-reminders` finds every project currently flagged
`is_stale` (via `project_activity_status`) that hasn't had a reminder sent
in the last 24 hours, and emails each affected company's owners/admins a
summary via Resend (`src/lib/email/send-stale-reminder.ts`) — a proactive
nudge on top of the dashboard's "Gone quiet" badge, not a replacement for
it; if `RESEND_API_KEY` isn't set, the route still runs (and still updates
`last_reminder_sent_at`) but just doesn't send anything.

The route is protected by a shared secret (`CRON_SECRET`) since it acts
across every company with the service-role client — anyone calling it
without the right `Authorization: Bearer <CRON_SECRET>` header gets a 401.
`.github/workflows/stale-reminders.yml` calls it hourly; it needs an
**`APP_URL` repo variable** (your deployed app's URL, used both to call the
route and to build the links inside the reminder emails) and a
**`CRON_SECRET` repo secret** (any random string, e.g. from
`openssl rand -hex 32` — set the same value in your Worker's env via
`wrangler secret put CRON_SECRET`). Without either, the workflow run fails
fast with a clear message instead of silently no-op'ing.

## What's not built yet

This covers Phase 1 of the module (activity feed, call notes, action items,
checklist, email tagging + AI parsing, the stale-project flag and its
reminder emails) on top of the existing consultant/RFQ tender flow. Not in
this pass:

- The **public tender board** (a separate area where owners can flag a job
  public for consultants to browse) — the existing private
  invite-a-consultant flow is untouched and still works.
- **Going live on Cloudflare** — the adapter/config are wired up (see
  "Deployment" below); connecting a real Cloudflare account and running
  `npm run deploy` is still a manual, one-time step.
- **Stripe billing / plan enforcement** — signup and per-company isolation
  are built (see "Signup, teams, and branding" above); billing and usage
  caps per plan are not. `ai_usage_log` (see "Key tables") tracks token
  spend per company today, but nothing acts on it yet — that's the natural
  next step once pricing per external company is decided.
