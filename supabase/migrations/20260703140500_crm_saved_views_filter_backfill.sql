-- crm_saved_views — legacy `filter` backfill for the canonical lists (streamline v2).
--
-- listCrmPeople (app/actions/crm.ts) resolves a clicked view through the LEGACY
-- `filter` bag ({stage, tagsAny}), while the sidebar COUNT path uses the `ast`.
-- The canonical rebuild (20260703140000) set only `ast`, so a clicked tag-list showed
-- everyone. This backfills `filter` to match each view's ast so the list filters
-- correctly. (Follow-up tech debt: unify listCrmPeople onto the ast compiler so the
-- two can never drift again — tracked in the execution log.)

update public.crm_saved_views set filter = '{"tagsAny":["segment:seller"]}'::jsonb where owner_email is null and name = 'Sellers';
update public.crm_saved_views set filter = '{"tagsAny":["segment:buyer"]}'::jsonb where owner_email is null and name = 'Buyers';
update public.crm_saved_views set filter = '{"tagsAny":["segment:expired"]}'::jsonb where owner_email is null and name = 'Expired';
update public.crm_saved_views set filter = '{"tagsAny":["segment:fsbo"]}'::jsonb where owner_email is null and name = 'FSBO';
update public.crm_saved_views set filter = '{"tagsAny":["segment:out-of-area"]}'::jsonb where owner_email is null and name = 'Out Of Area Home Owners';
update public.crm_saved_views set filter = '{"tagsAny":["realtor:local"]}'::jsonb where owner_email is null and name = 'Local Realtors';
update public.crm_saved_views set filter = '{"tagsAny":["realtor:migration"]}'::jsonb where owner_email is null and name = 'Migration Realtors';
update public.crm_saved_views set filter = '{"tagsAny":["segment:vendor"]}'::jsonb where owner_email is null and name = 'Vendors';
update public.crm_saved_views set filter = '{"stage":"Active Client"}'::jsonb where owner_email is null and name = 'Active Clients';
update public.crm_saved_views set filter = '{"stage":"Past Client"}'::jsonb where owner_email is null and name = 'Past Clients';
update public.crm_saved_views set filter = '{"stage":"Pending"}'::jsonb where owner_email is null and name = 'Pending';
update public.crm_saved_views set filter = '{"tagsAny":["compliance:hard-stop"]}'::jsonb where owner_email is null and name = 'Compliance Blocked';
