# Adversarial audit prompt — CRM streamline plan (paste into a new session)

> Refreshed 2026-07-03 after all open decisions were resolved (stages, neighborhood, migration realtors,
> demotion rule). Audits the FINAL plan.

Run an ADVERSARIAL AUDIT of the Ryan Realty CRM streamline plan BEFORE it executes. This is READ-ONLY —
do NOT run the migration, mutate any data, change tags/stages, or send anything. Your job: break the plan
on paper and against live data so a one-shot, book-wide migration of ~18,226 contacts doesn't ship a
mistake. Assume the plan is wrong until each claim is proven against live data.

## Read first
- `docs/plans/CRM_TAG_SMARTLIST_STREAMLINE_PLAN_2026-07-03.md` — tag consolidation (1,447 → ~40), the 8
  segments, smart-list definitions, auto-tagging design. Resolutions baked in: neighborhood → derived
  field; migration realtors data-driven; broker-recruit retired; vendors deferred.
- `docs/plans/CRM_STAGES_AUTOMATION_2026-07-03.md` — 5-stage unified pipeline (New removed), the 16→5
  (+Sphere+Trash) remap, the stage-automation trigger table, the Stages-strip UI.
- `docs/plans/HANDOFF_CRM_STREAMLINE_2026-07-03.md` — §0 execution = ONE coordinated reversible batch;
  pre-run checklist; session state.
- `docs/DATABASE_SCHEMA_SNAPSHOT.md` + `docs/DAL_INDEX.md` before any query. Supabase project
  `dwvlophlbvvygjfxcrhm`. Ad-hoc audit SQL MUST be prefixed `-- audit:`. Never mutate.

## Mindset
Matt is a licensed principal broker; a bad book-wide migration corrupts his business. THIS SESSION already
found real damage from past bulk ops: FUB duplicate-merges collapsing couples, a county import overwriting
names with wrong owners, a corrupted API key (84 chars vs 40), a display bug that hid every custom field,
expired markers on 90 of ~650 leads, a corrupted phone-mirror that could text the wrong number, and tags
meaning 6 different things. Expect the same class of blind spot here. Be hostile; default to "this breaks."

## Audit these — each with LIVE-DATA EVIDENCE (verify the plan's numbers; never trust them):

1. **Tag-collapse completeness.** Walk `out/tag-inventory.csv` (1,447 tags) against the collapse rules.
   Does EVERY tag get a fate (keep / →segment / →realtor / →occupancy / →location / →field / delete /
   review)? Any tag that falls through and is silently dropped? Any WRONGLY collapsed (a compliance-
   adjacent tag swept into delete)? Prove the 83 "manual-review" set is actually surfaced, not auto-
   handled. **Compliance tags (`contact:*`, `compliance:*`, bounce/unsub, DNC) MUST survive verbatim —
   prove none are renamed/dropped.**

2. **"Move to field" is non-destructive.** For each enrichment family moved to a field (subdivision,
   **neighborhood**, year built, tenure, equity, seller-score, brokerage): verify the target custom field
   EXISTS (`crm_field_definitions`) and already holds the data (`crm_people.custom`). If a field is
   missing or the tag holds data the field lacks → moving = data loss. **Neighborhood specifically**: the
   plan says move the 28 tag values into a single-select field now, then DERIVE from the property address
   (point-in-polygon vs Bend neighborhood boundaries) going forward. Verify the boundary data exists and
   the derivation is feasible; check how many contacts would get a DIFFERENT neighborhood from derivation
   vs their current tag (mismatch = a data-quality question for Matt).

3. **Segment definitions — correct, non-overlapping, reconcile to reality.** Run each filter live:
   - **Expired** (`segment:expired` from ~15 collapsed tags) — reconcile to Matt's ~600 (`Expired`=653,
     `Expired Listings`=527), NOT 90 or 7,455. Confirm the collapse set is complete and doesn't sweep in
     the historical-farm-only background matches.
   - **Out Of Area** (address-derived, ~1,743) — STRESS the address logic HARD: the plan assumes the
     `type='Property'` address = owned home, the non-Property entry = mailing. Verify across inconsistent
     `type` values ('Property'/'home'/''), PO boxes, single-address contacts, trusts/LLCs. How many
     mis-classify? Is the Central-OR city list complete (a missing town falsely flags a local as
     out-of-area)?
   - **Migration realtors** (data-driven): `realtor:migration` = realtor with a `<City> realtor` tag OR
     `migration broker`; everyone else = `realtor:local`; `audience:broker-recruit` (233) RETIRED. Verify
     the 233 are all realtors (won't orphan), and that the rule classifies all 2,341 realtors (none left
     unclassified). Any `<City> realtor` tag for a LOCAL city (would wrongly mark a local as migration)?
   - FSBO / Buyers / Sellers — overlap/double-count check (a contact can be seller + expired — intended?).

4. **Stage remap reconciles + is business-correct.** Run the 16→5(+Sphere+Trash) map vs live
   `crm_people.stage` counts. Do before/after totals reconcile EXACTLY (no contact lost, none double-
   counted, no old stage unmapped)? Challenge the business logic: Lead + Seller Prospect + A/B/C-temperature
   all → Nurture (does collapsing temperature lose Matt's ability to find his hot ones before priority is
   built?); Active Client → Active; Real Estate Agent + Vendor → Sphere. Anything Matt can no longer find.

5. **Auto-tagging + stage automation actually fire + don't mis-fire.** The plan hooks
   `deriveCanonicalTags` into creation/enrichment/address-change, and stage transitions into inbound
   webhooks / `crm_appointments` / `crm_deals` / an inactivity sweep. VERIFY the signals exist and are
   reliable:
   - `last_activity_at` — does it exist and update on the RIGHT events? The **30-day demote is Engaged-ONLY
     and must key on TWO-WAY activity** (inbound reply / held call / kept appointment), NOT email opens and
     NOT outbound drip sends. Can the code actually distinguish two-way from outbound? If `last_activity_at`
     bumps on your own sends, the demote timer is broken (never fires or fires wrong).
   - **Active / Under Contract must NEVER auto-demote** — confirm the sweep excludes them.
   - Do the creation paths (`ensureNativeLead`, LP actions, lead-router) actually call a taggable hook?
   - Does any BANNED promotion (email-open / website-visit → stage advance) sneak into the "automate" set?
   - What breaks if an event double-fires or fires out of order?

6. **Reversibility is real.** One coordinated run promises a full backup + one-command restore for BOTH
   tags AND stages. Verify the backup captures every field the migration writes, the restore is
   byte-faithful + idempotent, a partial/interrupted run is recoverable (this session lost agents mid-run
   twice), and there's a dry-run that writes NOTHING.

7. **Ordering / interdependency (it's ONE batch).** Is the order correct? The smart-list rebuild and the
   Out-Of-Area/realtor derivations depend on the canonical tags existing first; the stage remap is
   independent but the Stages strip depends on the new stages. Find any step that reads a value another
   step hasn't written yet.

8. **Compliance end-to-end.** Suppression/DNC/quiet-hours/hard-stop intact after the migration; nothing
   can make a suppressed contact contactable. Confirm the send gates don't key on any tag/stage the
   migration renames or remaps.

## Output
A severity-ranked findings ledger (P0 corrupts-data / P1 wrong-result / P2 polish) written to
`docs/plans/CRM_STREAMLINE_AUDIT_FINDINGS_<date>.md`, each finding: the plan claim, the live-data evidence
that contradicts it, the blast radius, the specific fix to the plan. Do NOT edit the plan to "fix" it
silently and do NOT run the migration — surface findings for Matt. Commit the findings doc (docs-only).
End with: counts (claims checked, findings by severity), the P0/P1 list one line each, and a clear
GO / NO-GO verdict on whether the plan is safe to execute as written.

Constraints: read-only (audit SQL only, `-- audit:` prefixed); no data mutation; no sends; no sub-agents
unless genuinely too big for one context (then keep them read-only). Standing authorization covers
committing the findings doc only.
