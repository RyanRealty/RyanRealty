-- W12.3: register the referral:referred-out disposition tag in the CRM taxonomy.
--
-- recordReferralReceivable (lib/data/crm/referralReceivables.ts) stamps this tag
-- on crm_people.tags when a referral handoff is recorded. It was already VISIBLE
-- on the person card (TagChips renders raw tag keys), but not FILTERABLE through
-- the standard smart-list UI: the people-list Filter Panel tag dropdown is
-- populated only from getCrmTags(), which reads this crm_tags taxonomy where
-- is_active and not is_protected. Without a row here the disposition never
-- appeared as a selectable filter. Registering it closes W12.3's "visible AND
-- filterable" goal — a broker can now filter the people list to "Referral -
-- referred out" from the dropdown.
--
-- Idempotent (on conflict do nothing), never clobbers a hand-edited label. Not
-- protected (a normal, mergeable/deletable disposition tag). is_active defaults
-- to true; position 900 sorts it after the core taxonomy.
insert into public.crm_tags (key, label, position, is_protected)
values ('referral:referred-out', 'Referral - referred out', 900, false)
on conflict (key) do nothing;
