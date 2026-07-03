# CRM Streamline + Data-Quality — Session Handoff (2026-07-03)

> Self-contained handoff for the next session. This session (2026-07-02 → 07-03) moved from the CRM
> rebuild into a **data-quality + streamline** phase: fixed the expired workflow, repaired FUB-import
> corruption, diagnosed a live-email leak, and produced the tag/smart-list streamline plan (approved in
> shape, awaiting Matt's final inputs before execution). Read this top-to-bottom before acting.

**HEAD context:** `main` in sync with origin. Key plan doc: `docs/plans/CRM_TAG_SMARTLIST_STREAMLINE_PLAN_2026-07-03.md`.

---

## 1. THE ONE THING ONLY MATT CAN DO (unblocks a live problem)

**Revoke Follow Up Boss's access to Matt's Google account** → `myaccount.google.com/connections` →
Follow Up Boss → Remove access. FUB's legacy **Beacon smart-campaign** (template #28, subject literally
"archived", body = just Matt's signature) is STILL sending drip emails to real leads (Brian Keith, Laurie
McAdam, others) **through Matt's connected Gmail** — proven by timestamp match to the second. Our code sends
nothing; FUB does. Full evidence: `docs/plans/EMAIL_SEND_AUDIT_2026-07-02.md`. Until Matt revokes, the
"archived" emails keep going out. **After he revokes:** run the two cleanups (below).

---

## 2. SHIPPED THIS SESSION (live on prod, all pushed)

**Data-display + feed fixes (the "my data is gone" scare — it was never gone, only mis-displayed):**
- `f99a45df` — **custom-field display fix.** Root cause: `crm_field_definitions` keys were unprefixed
  (`yearBuilt`) while every populated value is prefixed (`customYearBuilt`) → zero overlap → every
  contact's enrichment (expired info, homeowner data, mailing) rendered blank. Fix renders all populated
  custom keys. Data was always intact (22,377 notes, 11,251 backgrounds, 10,998 custom-field sets).
- `fe85d8f5` — **notes ranking**: broker-written notes now sort above auto-generated "outreach packet"
  system notes (classifier `lib/crm/note-classify.ts`), desktop + mobile.
- `46854d89` — **New Leads de-pollution**: the 16 recreated split-spouses (below) were being stamped
  `lead_created` today by a DB trigger → showed as new leads. Removed the false events + backdated
  created_at. New Leads 5,252 → 5,236. Restore: `scripts/_newlead-cleanup-restore.mjs`.

**Expired workflow (was dead since ~2026-06-12, both breaks fixed):**
- `41841a53` — **CRM-native rewire.** The processor created people via dead FUB APIs post-cutover → 0
  enrollments in 3 weeks, only 13/98 detected listings made a lead. Rewired to
  `ensureNativeLead → enrichNativeLead → createNativeTask → autoEnrollPerson`. Alert sender fixed.
- **BatchData key fixed on Vercel** (not a commit — an env fix). The prod `BATCHDATA_API_KEY` was
  **corrupted: 84 chars w/ trailing newline vs the correct 40**. Skip-trace failed on prod → new expireds
  got no phones/emails → dropped. Replaced with the verified-working key (live-tested HTTP 200, 5 phones).
  Redeploy triggered. Audit: `docs/plans/EXPIRED_WORKFLOW_AUDIT_2026-07-03.md`.
- **NEXT SESSION: verify end-to-end after the deploy lands** — a new expired should detect → create a
  native lead → skip-trace → enroll in "Expired Recovery" (seq plan 71, active) → alert Matt. Also 10 old
  enrollments stuck `paused` since 2026-06-16 (P1-D) — decide resume vs leave.

**Family-record corruption repairs (root cause: FUB duplicate-merges + the 2026-05-27 westside import
overwriting names with county deed-owner names — NOT our code):**
- Yahson Terry (son-in-law of Mary Bowman), Christopher + Maria Hoffman (was mis-named "Kevin"), Steve +
  Lanny Olivieri, and **14 more collapsed couples split back out** — 17 people recreated, evidence-based
  (FUB relationship snapshots held each erased spouse's own phones/emails), spouse/partner-linked,
  message history re-attributed. Commits `bb21ec5c`, `49297967`, `624c864d`, `cecce67d`, `c1795570`.
- **FUB group-text backfill**: 784 group messages across 18 threads mirrored onto every participant's
  timeline (importer had dropped `groupTextId`/`participants`). Script `scripts/crm-backfill-fub-group-texts.mjs`.

**Group SMS (was completely broken):**
- `74d22bf9` — native group MMS (`sendGroupMms` via Twilio Conversations) + a new inbound webhook
  `/api/twilio/conversations-events` that records group texts on every member's timeline. Before this,
  group texts to the ported line were **dropped entirely** (never delivered, no log) since the 06-24 port.
  8-day gap (06-24→07-02) is unrecoverable server-side; Matt was offered a Messages-app sweep (not done).

**Westside wrong-household parcel strip:**
- `e2b0847c` — 67 contacts had a WRONG county parcel stamped on them (skip-trace mis-match, like the
  Hoffmans). Stripped the county data; **8 protected** (had real expired-listing/realtor data). Fully
  reversible: `out/westside-strip-backup.json` + `scripts/_westside-parcel-restore.mjs`. Sweep that found
  them: `docs/plans/WESTSIDE_DATA_SWEEP_2026-07-02.md` (995 flags total; only the 75 high-confidence
  Hoffman-pattern were acted on; the medium/low tiers remain for Matt if he wants a deeper pass).

**Telephony:** Matt's texts now send from **+15417033095** (was the temp +15412245025; broker row +
Twilio config fixed earlier this session). Paul's row had a non-owned number (typo) — also fixed.

**Earlier in the arc (all done + audited):** the 18/18 CRM screen rebuild (desktop + mobile) under
`ci:crm-screen-parity`, both adversarial audits, the production sign-off
(`docs/plans/CRM_PRODUCTION_SIGNOFF_2026-07-02.md`), the FUB cutover (lead-router default `native`),
merge-field resolver fix, email open/click tracking.

---

## 3. THE STREAMLINE PLAN (written, awaiting Matt's inputs, then execute)

**Full plan: `docs/plans/CRM_TAG_SMARTLIST_STREAMLINE_PLAN_2026-07-03.md`.** Read it — it's the spec.

**Summary:** collapse **1,447 tags → ~40** (1,038 → custom fields, 166 deleted, ~119 collapsed to
canonical, ~40 kept). Establish **8 smart lists**: Sellers · Expired · FSBO · Out Of Area Home Owners ·
Buyers · Local Realtors · Migration Realtors · Vendors. Plus a **default auto-tagging ruleset**
(`deriveCanonicalTags` at creation + enrichment + address-change) so new leads self-tag forever.

**Key definitions Matt confirmed this session:**
- **Expired ≈ 650** (tagged 15 inconsistent ways: `Expired`=653, `Expired Listings`=527, etc.) — NOT 90
  (classification field, recent-cron only) and NOT 7,455 (historical farm = Sellers). Collapse all →
  `segment:expired`.
- **Out Of Area Home Owners = 1,743**, ADDRESS-DERIVED (owns a `type='Property'` address in-area + mailing
  address non-local). NOT tag-derived. Self-corrects. Central-OR city list is in the plan.
- **Migration Realtors** = agents in Bend's **feeder markets** (the metros people move to Bend FROM:
  Seattle/WA, Bay Area + SoCal, Portland metro, Colorado Front Range) → referral network. `realtor:migration`.
  **Local Realtors** = Central-OR agents → `realtor:local`. Derived from work market, not hand-tags.
- **Vendors = segment #8** (Matt added): `segment:vendor` + curated `vendor:<type>` (21 trades: lender,
  title, appraiser, inspector, electrician, plumber, hvac, roofer, contractor, painter, landscaper,
  stager, photographer, handyman, cleaner, pest, surveyor, attorney, insurance, flooring, mover). Type is
  a MANUAL dropdown pick (can't auto-derive a trade).

**BLOCKED ON MATT — three inputs before the dry-run:**
1. Feeder-market list for Migration Realtors (or use the observed WA/CA/Portland/Colorado set).
2. `neighborhood` tag (17,763 uses) — keep as a tag or move to a field like the other geo data?
3. Any tweak to the 21-trade vendor list.

**EXECUTION (after Matt approves — the plan §6, reversible, dry-run FIRST):**
1. Backup every contact's `tags` array → `out/tag-migration-backup.json` + restore script
   (`scripts/_tag-streamline-restore.mjs`, already drafted by the crashed agent — verify it).
2. `scripts/_tag-streamline-migrate.mjs --dry-run` (also drafted — verify) → show Matt real before/after
   counts + the 83 manual-review tags. NO writes.
3. Matt rules on the 83 + approves → apply (idempotent; move-to-field only where field empty; delete
   noise; keep compliance verbatim).
4. Rebuild the 8 `crm_saved_views` + retire noise lists; wire Out-Of-Area + realtor lists to the
   address/market rules.
5. Ship `deriveCanonicalTags` + creation-path hooks (auto-tagging).
6. Verify each list's count; a sample contact shows ~5 clean tags + enrichment as fields; compliance intact.

**Partial work the CRASHED tag agent left (uncommitted, in tree):** `out/tag-inventory.csv` (1,448 rows),
`scripts/_tag-streamline-migrate.mjs`, `scripts/lib/tag-streamline.mjs` + `.test.mjs`. Build on these; the
proposal doc was never finished (this handoff + the plan doc supersede it).

---

## 4. TWO CLEANUPS QUEUED (run AFTER Matt revokes FUB access)

1. **Delete the 48 FUB "archived" junk rows**: `crm_timeline` where `kind='email_out' AND lower(title)='archived'
   AND source='gmail'` (they pollute contact timelines; back them up first).
2. **Stop the Gmail sync from re-ingesting FUB Beacon automation emails** as `email_out` (they mislabel FUB's
   drips as Matt's sends). The sync is `app/api/cron/crm-gmail-sync` + `lib/crm/gmail.ts` (read-only ingest).

---

## 5. GOTCHAS / LESSONS (this session)

- **Long background agents can crash and lose in-process state** — this session lost 2 mid-run (expired +
  tag agents). BUT they'd committed/left partial work, which was recovered. **Checkpoint to git frequently;
  keep agents scoped; for planning tasks the main loop writing the doc directly is safer than a long agent.**
- **Never trust a single field for a segment count** — expired was findable 6 ways (90 / 321 / 527 / 653 /
  921 / 7,468). Always reconcile signals + ask Matt his mental number.
- **The westside 2026-05-27 import mis-matched skip-traced parcels onto wrong households** — any parcel/
  homeowner data from that import is suspect (the medium/low sweep tiers remain unaudited).
- **Compliance tags are sacred** (contact:do-not-*, compliance:hard-stop) — never renamed/dropped in any
  migration; derivations only ADD them.
- **Draft-first on anything that SENDS or restructures the book at scale** — Matt approves; nothing
  outbound fires without his explicit go. The streamline itself sends nothing (tags/lists only).
- Every data mutation this session shipped with a backup + one-command restore. Keep that bar.

---

## 6. QUICK STATE TABLE

| Thread | State |
|---|---|
| CRM rebuild (18 screens) | ✅ done, signed off |
| Expired workflow | ✅ code + key fixed; verify after deploy |
| Family-record corruption | ✅ 17 people repaired, reversible |
| Westside wrong parcels | ✅ 67 stripped (high-conf); medium/low tiers open |
| Group SMS | ✅ fixed (send + record); 8-day gap unrecoverable |
| Telephony (703-3095) | ✅ fixed |
| FUB "archived" emails | 🔴 Matt must revoke Google access |
| Tag/smart-list streamline | 📋 planned; blocked on Matt's 3 inputs + approval |
| Vendors (segment #8) | ⏸ DEFERRED (Matt 2026-07-03 "add vendors later"). Design done in the plan (`segment:vendor` + curated `vendor:<type>` dropdown + Vendors list). NO existing vendor list found in CRM or FUB (checked stages/tags/groups/raw — all empty). When Matt's ready: import his external list, OR scan the book for vendor-looking contacts (company names, closing-thread service providers) for him to confirm/type. |
| Post-revoke cleanups | ⏳ queued (48 rows + sync filter) |
