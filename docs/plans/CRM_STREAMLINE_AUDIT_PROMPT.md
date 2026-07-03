# Adversarial audit prompt — CRM streamline plan (paste into a new session)

Run an ADVERSARIAL AUDIT of the Ryan Realty CRM streamline plan BEFORE it executes. This is a
read-only audit — you do NOT run the migration, mutate any data, or change stages/tags. Your job is to
break the plan on paper and against live data so a one-shot, book-wide migration of ~18,226 contacts
doesn't ship a mistake. Assume the plan is wrong until each claim is proven.

## Read first
- `docs/plans/CRM_TAG_SMARTLIST_STREAMLINE_PLAN_2026-07-03.md` — tag consolidation (1,447 → ~40), the 8
  segments, the smart-list definitions, the auto-tagging design.
- `docs/plans/CRM_STAGES_AUTOMATION_2026-07-03.md` — the unified 5-stage model (New removed), the 16→5
  remap, the stage-automation trigger table, the Stages-strip UI.
- `docs/plans/HANDOFF_CRM_STREAMLINE_2026-07-03.md` — §0 execution approach (ONE coordinated reversible
  batch), the pre-run checklist, session state.
- `docs/DATABASE_SCHEMA_SNAPSHOT.md` + `docs/DAL_INDEX.md` before any query. Supabase project
  `dwvlophlbvvygjfxcrhm`. Prefix ad-hoc audit SQL with `-- audit:`. Never mutate.

## Mindset
Matt is a licensed principal broker; a bad book-wide migration corrupts his business. This session has
ALREADY found real damage from past bulk operations (FUB duplicate-merges, a county-import overwriting
names, a corrupted API key, a display bug that hid all custom fields, expired markers on only 90 of ~650,
tags meaning 6 different things). Expect the plan to have similar blind spots. Be hostile.

## Audit these, each with EVIDENCE from live data (verify the plan's numbers — don't trust them):

1. **Tag collapse completeness.** Walk `out/tag-inventory.csv` (1,447 tags) against the plan's collapse
   rules. Is EVERY tag assigned a fate (keep / →segment / →realtor / →occupancy / →location / →field /
   delete / review)? Any tag that falls through the rules and gets silently dropped? Any tag WRONGLY
   collapsed (e.g. a compliance-adjacent tag swept into "delete")? Confirm the 83 "manual review" set is
   actually reviewed, not auto-handled. **Compliance tags (`contact:*`, `compliance:*`, bounce/unsub)
   MUST survive verbatim — prove none are touched.**

2. **"Move to field" is safe.** For each enrichment tag family moved to a custom field (subdivision,
   neighborhood, year built, tenure, equity, seller-score, brokerage), verify the target custom field
   ACTUALLY EXISTS and already holds the data (the plan claims it's duplication). If a field is missing
   or the tag holds data the field lacks, moving = data loss. Check `crm_field_definitions` +
   `crm_people.custom` for real coverage. Flag any tag whose data isn't already in a field.

3. **Segment definitions — correct + non-overlapping.** For each of the 5 lead segments, run the plan's
   filter and sanity-check the count + membership:
   - Expired (`segment:expired` from ~15 collapsed tags) — reconcile to Matt's ~600, not 90 or 7,455.
   - **Out Of Area (address-derived, ~1,743)** — stress the address logic HARD: the plan assumes a
     `type='Property'` address = owned home and the non-Property entry = mailing. Verify that holds
     across the data (inconsistent `type` values: 'Property'/'home'/''; PO boxes; contacts with only one
     address; trusts/LLCs). How many get mis-classified? Is the Central-OR city list complete (missing a
     Central-OR town would falsely flag a local as out-of-area)?
   - FSBO, Buyers, Sellers — do the definitions overlap or double-count? A contact can be seller + expired
     — is that intended and handled?
   - Realtor local vs migration (feeder-market derivation) — does the rule actually classify all 2,341,
     or leave most `unknown`?

4. **Stage remap reconciles.** Run the 16→5(+Sphere+Trash) map against live `crm_people.stage` counts.
   Do the before/after totals reconcile exactly (no contact lost, none double-counted, no old stage
   unmapped)? Is any mapping wrong for the business (e.g. "Active Client → Active" vs "→ Engaged";
   A/B/C-temperature → Nurture losing the heat; Real Estate Agent → Sphere)? Does collapsing removes the
   ability to find anything Matt needs?

5. **Auto-tagging + stage automation actually fire.** The plan hooks `deriveCanonicalTags` into lead
   creation / enrichment / address-change, and stage transitions into inbound webhooks / `crm_appointments`
   / `crm_deals` / an inactivity sweep. Verify those signals EXIST and are reliable: does `last_activity_at`
   exist and update on the right events (the demotion timer depends on it)? Do the creation paths
   (`ensureNativeLead`, LP actions, lead-router) actually call a taggable hook? Is any "automate" trigger
   in the table actually a false signal (the plan bans email-open/website-visit promotion — confirm none
   sneak in)? What breaks if an event double-fires?

6. **Reversibility is real.** The plan promises a full backup + one-command restore for BOTH tags and
   stages in one coordinated run. Verify the backup captures every field the migration writes, the restore
   is byte-faithful + idempotent, and a partial/interrupted run is recoverable (this session lost agents
   mid-run twice). Is there a dry-run that writes nothing?

7. **Ordering / interdependency.** It's one batch — is the order correct? (e.g. stage remap or smart-list
   rebuild that references segment tags must run AFTER the tag consolidation; the Out-Of-Area list depends
   on address-derived tags existing.) Find any step that reads a value another step hasn't written yet.

8. **Compliance end-to-end.** Suppression/DNC/quiet-hours/hard-stop must be intact after the migration,
   and nothing in the plan can make a suppressed contact contactable. Confirm the send gates don't key on
   any tag/stage the migration renames.

## Output
A severity-ranked findings ledger (P0 would-corrupt-data / P1 wrong-result / P2 polish) written to
`docs/plans/CRM_STREAMLINE_AUDIT_FINDINGS_<date>.md`, each finding with: the plan claim, the live-data
evidence that contradicts it, the blast radius, and the specific fix to the plan. Do NOT edit the plan to
"fix" it silently and do NOT run the migration — surface findings for Matt to decide. Commit the findings
doc (docs-only). End with: counts (claims checked, findings by severity), the P0/P1 list one-line each,
and a go/no-go verdict on whether the plan is safe to execute as written.

Constraints: read-only (audit SQL only, `-- audit:` prefixed); no data mutation; no sub-agents unless the
audit is genuinely too big for one context (then keep them read-only). Standing authorization covers
committing the findings doc only.
