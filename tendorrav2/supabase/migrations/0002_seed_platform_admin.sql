-- The platform owner becomes a Tendorra platform admin (admin CRM access) on signup.
insert into public.platform_admin_emails (email) values ('charlesluocx@gmail.com')
on conflict do nothing;
-- If that account already exists, promote it now.
update public.profiles set is_platform_admin = true where email = 'charlesluocx@gmail.com';
