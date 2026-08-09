-- Fix: infinite recursion (SQLSTATE 42P17) in the admin_roles RLS policy.
--
-- WHAT WAS WRONG. "Super admin read all admin_roles" is a policy ON
-- public.admin_roles whose USING clause read public.admin_roles:
--
--     EXISTS (SELECT 1 FROM admin_roles ar WHERE lower(ar.email) = <caller>
--             AND ar.role = 'superuser')
--
-- Evaluating the policy required reading the table, which required evaluating
-- the policy. Postgres detects the cycle and raises
--
--     42P17  infinite recursion detected in policy for relation "admin_roles"
--
-- Every policy that consults admin_roles to authorise a caller inherited the
-- failure, because reading admin_roles is what trips the cycle. Four surfaces
-- were affected: admin_roles, admin_actions, broker_generated_media and
-- crm_company_settings (two policies). Only the `authenticated` role is
-- affected; service_role policies bypass RLS, which is why every admin screen
-- that reads through a service client kept working and this stayed hidden.
--
-- HOW IT SURFACED. /admin/audit-log reads through the cookie-scoped client, so
-- it was the one screen exercising these policies. getAdminActions discarded
-- the error (`const { data } = await query`), so a hard RLS failure rendered as
-- "No admin action has been recorded." — a compliance surface reporting a clean
-- history it had never been able to read. Verified 2026-08-08 by impersonating
-- the authenticated role with matt@'s uid: the SELECT raised 42P17, and the
-- table did hold a row the screen was not showing.
--
-- THE FIX. Move the lookup into a SECURITY DEFINER function. Inside a definer
-- function the read of admin_roles runs as the function owner and is not
-- subject to the caller's RLS, so the cycle is broken. The predicate itself is
-- unchanged: same table, same email match, same roles, same PERMISSIVE policies
-- on the same `authenticated` role. Nothing gains access that did not have it.
--
-- The caller's email is taken from the JWT, falling back to auth.users for a
-- session whose token carries no email claim. Both resolve the same person; the
-- fallback exists so the audit log cannot fail closed for the one superuser.

-- ── helpers ───────────────────────────────────────────────────────────────

create or replace function public.caller_has_admin_role(allowed text[])
returns boolean
language sql
stable
security definer
-- Pinned so the definer body cannot be redirected by a caller-controlled
-- search_path; pg_temp last, per the Supabase definer hardening convention.
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.admin_roles ar
    where lower(ar.email) = lower(coalesce(
            auth.jwt() ->> 'email',
            (select u.email from auth.users u where u.id = auth.uid())
          ))
      and ar.role = any(allowed)
  )
$$;

comment on function public.caller_has_admin_role(text[]) is
  'True when the calling user holds one of `allowed` in admin_roles. SECURITY DEFINER so an RLS policy can consult admin_roles without recursing into admin_roles'' own policy (42P17).';

create or replace function public.caller_is_superuser()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.caller_has_admin_role(array['superuser'])
$$;

comment on function public.caller_is_superuser() is
  'True when the calling user is a superuser in admin_roles. See caller_has_admin_role.';

-- Grants: never executable by anon or by PUBLIC — these answer an authorisation
-- question and are the input to policies that gate the audit log.
revoke execute on function public.caller_has_admin_role(text[]) from public;
revoke execute on function public.caller_is_superuser() from public;
grant execute on function public.caller_has_admin_role(text[]) to authenticated, service_role;
grant execute on function public.caller_is_superuser() to authenticated, service_role;

-- ── policies, rewritten to call the helpers ───────────────────────────────
-- Each replacement keeps the original name, command, PERMISSIVE-ness, role and
-- predicate. Only `broker_generated_media` carried a WITH CHECK; the others are
-- recreated without one exactly as they were.

drop policy if exists "Super admin read all admin_roles" on public.admin_roles;
create policy "Super admin read all admin_roles" on public.admin_roles
  as permissive for select to authenticated
  using (public.caller_is_superuser());

drop policy if exists "Super admin read admin_actions" on public.admin_actions;
create policy "Super admin read admin_actions" on public.admin_actions
  as permissive for select to authenticated
  using (public.caller_is_superuser());

drop policy if exists "Super admin broker_generated_media" on public.broker_generated_media;
create policy "Super admin broker_generated_media" on public.broker_generated_media
  as permissive for all to authenticated
  using (public.caller_is_superuser())
  with check (public.caller_is_superuser());

drop policy if exists "crm_company_settings_admin_select" on public.crm_company_settings;
create policy "crm_company_settings_admin_select" on public.crm_company_settings
  as permissive for select to authenticated
  using (public.caller_has_admin_role(array['superuser', 'admin', 'broker']));

drop policy if exists "crm_company_settings_superuser_update" on public.crm_company_settings;
create policy "crm_company_settings_superuser_update" on public.crm_company_settings
  as permissive for update to authenticated
  using (public.caller_has_admin_role(array['superuser', 'admin']));
