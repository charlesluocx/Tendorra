import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";

// Runs every migration in an in-memory Postgres (PGlite) with stand-ins for Supabase auth/storage,
// then checks tenant isolation and role rules. Run: npm run test:db
const M = new URL("../migrations/", import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto } });

// Minimal stand-ins for Supabase's auth + storage schemas and roles
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage; create schema extensions; create extension pgcrypto schema extensions;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
for (const f of fs.readdirSync(M).sort()) {
  await db.exec(fs.readFileSync(M + f, "utf8"));
  console.log("applied", f);
}
// Supabase's default grants
await db.exec(`
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage on schema extensions to authenticated;
  revoke update on public.profiles from authenticated; grant update (full_name) on public.profiles to authenticated;
  grant select, insert, delete on storage.objects to authenticated;
`);

const A = "11111111-1111-1111-1111-111111111111"; // owner, company A
const B = "22222222-2222-2222-2222-222222222222"; // owner, company B
const C = "33333333-3333-3333-3333-333333333333"; // invited staff for A
const ADM = "44444444-4444-4444-4444-444444444444"; // platform admin
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${A}','alice@a.com','{"full_name":"Alice"}'), ('${B}','bob@b.com','{}'),
  ('${C}','carol@a.com','{}'), ('${ADM}','CharlesLuoCX@gmail.com','{}')`);

async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.sub', '${uid}', false); set role authenticated;`);
  try { return (await db.query(sql, params)).rows; }
  finally { await db.exec("reset role"); }
}
let pass = 0, fail = 0;
function check(name, cond) { cond ? pass++ : fail++; console.log(cond ? "  ✓" : "  ✗", name); }
async function expectError(name, fn) { try { await fn(); check(name + " (expected error)", false); } catch (e) { check(name + " → " + e.message.slice(0, 70), true); } }

const admins = (await db.query("select email, is_platform_admin from public.profiles order by email")).rows;
check("platform admin flagged from allowlist (case-insensitive)", admins.find(r => r.email === "charlesluocx@gmail.com")?.is_platform_admin === true);
check("normal users are not platform admins", admins.filter(r => r.is_platform_admin).length === 1);

const [orgA] = await as(A, "select * from public.create_organization('Acme Dev', 'acme')");
const [orgB] = await as(B, "select * from public.create_organization('Beta Homes', 'beta')");
check("owner membership + timeline tool created", (await as(A, "select tool_key from org_tools")).map(r=>r.tool_key).join() === "timeline");

const [pA] = await as(A, `insert into projects (org_id, name, created_by) values ($1, 'Harbour St', $2) returning id`, [orgA.id, A]);
const [pB] = await as(B, `insert into projects (org_id, name, created_by) values ($1, 'Secret B', $2) returning id`, [orgB.id, B]);
await as(A, `insert into emails (org_id, project_id, subject, source_format, created_by, message_id) values ($1,$2,'DA approved','eml',$3,'<m1>')`, [orgA.id, pA.id, A]);
await as(A, `insert into timeline_items (org_id, project_id, kind, milestone_status, title, occurred_at, created_by) values ($1,$2,'milestone','achieved','DA approved', now(), $3)`, [orgA.id, pA.id, A]);

console.log("Tenant isolation");
check("A sees only own org", (await as(A, "select name from organizations")).map(r=>r.name).join() === "Acme Dev");
check("B cannot see A's projects", (await as(B, "select * from projects where org_id = $1", [orgA.id])).length === 0);
check("B cannot see A's emails", (await as(B, "select * from emails")).length === 0);
check("B cannot see A's timeline", (await as(B, "select * from timeline_items")).length === 0);
await expectError("B cannot insert into A's org", () => as(B, `insert into projects (org_id, name, created_by) values ($1,'x',$2)`, [orgA.id, B]));
await expectError("A cannot attach timeline to B's project", () => as(A, `insert into timeline_items (org_id, project_id, title, occurred_at, created_by) values ($1,$2,'x',now(),$3)`, [orgA.id, pB.id, A]));
check("B update of A's project affects 0 rows", (await as(B, "update projects set name='pwn' where id=$1 returning id", [pA.id])).length === 0);
await expectError("user cannot self-promote to platform admin", () => as(B, "update profiles set is_platform_admin = true where id = $1", [B]));
await expectError("milestone needs a status", () => as(A, `insert into timeline_items (org_id, project_id, kind, title, occurred_at, created_by) values ($1,$2,'milestone','x',now(),$3)`, [orgA.id, pA.id, A]));
await expectError("duplicate email message-id rejected", () => as(A, `insert into emails (org_id, project_id, subject, source_format, created_by, message_id) values ($1,$2,'dupe','eml',$3,'<m1>')`, [orgA.id, pA.id, A]));

console.log("Invitations");
const [inv] = await as(A, `insert into invitations (org_id, email, role, invited_by) values ($1,'carol@a.com','member',$2) returning token`, [orgA.id, A]);
await expectError("B cannot invite into A", () => as(B, `insert into invitations (org_id, email, invited_by) values ($1,'x@x.com',$2)`, [orgA.id, B]));
check("get_invitation works", (await as(C, "select * from get_invitation($1)", [inv.token]))[0]?.org_name === "Acme Dev");
await expectError("B cannot accept Carol's invite", () => as(B, "select * from accept_invitation($1)", [inv.token]));
check("Carol accepts invite", (await as(C, "select slug from accept_invitation($1)", [inv.token]))[0]?.slug === "acme");
check("Carol sees A's project", (await as(C, "select name from projects")).map(r=>r.name).join() === "Harbour St");
check("Carol sees co-member profiles", (await as(C, "select email from profiles order by email")).length === 2);
check("Carol (member) cannot read invitations", (await as(C, "select * from invitations")).length === 0);
check("Carol cannot delete project (admins only)", (await as(C, "delete from projects where id=$1 returning id", [pA.id])).length === 0);
check("Carol cannot demote owner", (await as(C, "update memberships set role='member' where user_id=$1 returning user_id", [A])).length === 0);
await expectError("invite cannot be reused", () => as(C, "select * from accept_invitation($1)", [inv.token]));

console.log("Storage");
await as(A, `insert into storage.objects (bucket_id, name) values ('emails', $1)`, [`${orgA.id}/${pA.id}/x.msg`]);
check("B cannot read A's email files", (await as(B, "select * from storage.objects")).length === 0);
await expectError("B cannot upload into A's folder", () => as(B, `insert into storage.objects (bucket_id, name) values ('emails', $1)`, [`${orgA.id}/${pA.id}/y.msg`]));

console.log("Platform admin + suspension");
check("platform admin reads all orgs", (await as(ADM, "select * from organizations")).length === 2);
check("platform admin reads all timeline", (await as(ADM, "select * from timeline_items")).length === 1);
await db.exec(`update organizations set status='suspended' where id='${orgA.id}'`);
check("suspended org hides data from its staff", (await as(C, "select * from projects")).length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
