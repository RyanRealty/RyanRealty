# CRM Streamline — Adversarial Pre-Execution Audit Findings (2026-07-03)

> **Verdict: NO-GO.** The *design* (the two plan docs) is largely sound, but the only
> **executable artifact** — `scripts/_tag-streamline-migrate.mjs` + `scripts/lib/tag-streamline.mjs`,
> which the plan §6 and the handoff §3 tell the next session to "verify and run" — was written to a
> **superseded, now-absent proposal** (`docs/plans/TAG_STREAMLINE_PROPOSAL_2026-07-03.md`, does not
> exist) and does **not** implement the finalized plan. Running it as the "one coordinated migration"
> would delete enrichment data with no field capture, produce **zero** of the realtor/buyer/seller/
> out-of-area segments the smart lists depend on, and — on a crash or a second run — leave the book
> mutated with **no usable backup.** The stage remap, auto-tagging (`deriveCanonicalTags`), list
> rebuild, and the 30-day demote are **unbuilt**, and the demote has **no valid data source**.
>
> Read-only audit. Nothing was mutated. The plan and migration were not touched. Evidence is live
> (Supabase `dwvlophlbvvygjfxcrhm`, 18,226 non-deleted contacts) + the real classifier run over the
> 1,447-tag inventory.

Author: Claude (Opus session, 2026-07-03). Scope audited: `CRM_TAG_SMARTLIST_STREAMLINE_PLAN_2026-07-03.md`,
`CRM_STAGES_AUTOMATION_2026-07-03.md`, `HANDOFF_CRM_STREAMLINE_2026-07-03.md`, and the in-tree scripts they cite.

---

## Counts / scope

| Metric | Value | Source |
|---|---|---|
| Non-deleted contacts | 18,226 | `crm_people` |
| Distinct tags / assignments | 1,447 / 263,226 | inventory + live (plan figure ✓) |
| Classifier fates (distinct tags) | keep **34** · rename **10** · derive-drop **15** · move-to-field **1,125** · retire **263** | ran real `classify()` over all 1,447 |
| Classifier fates (assignments) | keep 16,855 · rename 1,859 · derive-drop 42,772 · move-to-field **120,755** · retire 80,985 | same |

Findings: **5 P0 (corrupts/loses data or breaks reversibility) · 4 P1 (wrong result) · 5 P2 (polish).**

---

## P0 — corrupts data / breaks reversibility

### P0-1 · "Move to field" is pure deletion. No field is ever written. ~5,790 measured values destroyed (plus every no-target-field family).
- **Plan claim:** §3 "Enrichment data lives in fields… they already exist as custom fields; the tags are pure duplication." §6.4 "moves enrichment tags to their custom fields (only where the field is empty — never overwrite)." §8.2 neighborhood "Populate in the migration by moving the existing 28 tag values."
- **Contradicting evidence:** `scripts/_tag-streamline-migrate.mjs:27-30` states outright the field write "is a SEPARATE enrichment step (flagged in the proposal)" and is **not** done here. `rewritePersonTags()` (`tag-streamline.mjs:141-156`) simply **omits** every `move-to-field` tag from the output array and writes **nothing** to `crm_people.custom`. 1,125 tags / 120,755 assignments are dropped this way. Live count of contacts that carry the tag but whose target field is **empty** (i.e. the value only exists on the tag → hard loss):
  - `neighborhood:` — 10,051 tagged, 7,408 also have the field, **2,643 would lose it.**
  - `subdivision:` — 10,256 tagged, 7,272 have the field, **2,984 would lose it.**
  - `brokerage:` — 163 tagged, **163 lost** (and see P1-4: **no brokerage field exists at all**).
  - Families with **no target field and no write:** `city:` (11,099), `area:` (7,606), `tenure:*` (~20k), `lifecycle:*`, `seller-score:*` (bucketed text, distinct from the `sellerScore` number field), `realtor-source:*` — all deleted outright.
- **Blast radius:** ≥ 5,790 field values provably destroyed on the addressed families alone; tens of thousands more where no field exists. Irreversible except via the tag backup (which itself is fragile — P0-2/P0-3).
- **Fix:** implement the field-write step *inside* the migration (upsert into `crm_people.custom` only where empty) before any `--apply`, and create the missing target fields (P1-4). Or explicitly re-scope §3/§8.2 to "delete the duplicated tags, accept loss on the un-fielded ~26–29%," and get Matt's sign-off on that loss. The neighborhood single-select field (§8.2) does not exist as a select — it exists as `type=text`.

### P0-2 · Interrupted `--apply` = partial mutation with NO backup file. Not restorable.
- **Plan claim:** §6.1 / §7 "Full backup + one-command restore… reversible." Handoff §0 "Single backup of everything touched."
- **Contradicting evidence:** `_tag-streamline-migrate.mjs` writes each contact's new array **inside** the page loop (`:118-124`) but writes `out/tag-migration-backup.json` **only after the entire loop completes** (`:132`). A crash/timeout at contact *N* of 18,226 leaves 1..*N* already mutated and **no backup file on disk** → the restore script has nothing to read (`_tag-streamline-restore.mjs:28-31` exits "nothing to restore").
- **Blast radius:** This session's own handoff (§5) records that **two long agents crashed mid-run** this week. On an 18K-row apply this is a likely, not hypothetical, failure — and it is unrecoverable.
- **Fix:** write the full pre-image backup to disk **before** the first `update`, not after the loop. (Snapshot all rows first, persist, then mutate.)

### P0-3 · A second `--apply` overwrites the backup with already-migrated arrays, destroying the undo.
- **Contradicting evidence:** `backup.push({ id, tags: before })` captures `before` = the row's **current** tags. The doc bills the migration as "idempotent (re-runnable)." But a second `--apply` recomputes `before` from the **already-migrated** state and overwrites `out/tag-migration-backup.json` with it; `restore` then restores to the *migrated* arrays, not the originals. "Re-runnable" and "one-command undo" are mutually exclusive as written.
- **Fix:** refuse to overwrite an existing backup (timestamp/version it), or key restore off an immutable first-run snapshot.

### P0-4 · Sellers — the single largest list — goes empty under the coordinated migration (cross-plan interaction).
- **Plan claim:** Tag plan §4 "**Sellers** | stage = `Seller Prospect` | ~7,500." Stage plan remaps "Seller Prospect (7,524) → **Nurture**." Tag plan §3.1 "`audience:seller`… → `segment:seller` ~7,500."
- **Contradicting evidence:** (a) The stage remap **deletes the exact key** the Sellers list filters on — after remap, 0 contacts have stage `Seller Prospect`. (b) The tag side never creates `segment:seller`: `audience:seller` (3,511 live) is classified **keep-as-is**, not renamed (`tag-streamline.mjs:60` explicitly skips it). (c) The live "Sellers" saved view actually filters `{tagsAny:["audience:seller"]}` = **3,511**, not stage=Seller Prospect — so the plan's own filter definition and its ~7,500 count are already inconsistent (7,524 is the *stage* count; 3,511 is the *tag* count; 4,013 stage-Seller-Prospect contacts carry no `audience:seller` tag).
- **Blast radius:** post-migration, **no** filter (stage or tag) returns the seller book. The biggest workflow list is destroyed. Fails audit item (3) reconciliation.
- **Fix:** pick ONE seller definition; if it's `segment:seller`, backfill that tag onto the 7,524 (or the 3,511) in the migration; sequence so the list filter and the data agree.

### P0-5 · Realtor segment: produces ZERO `realtor:local`/`realtor:migration` and erases realtor identity for 2,342 agents.
- **Plan claim:** §3.1 "`industry:realtor` kept as the base; local vs migration derived from work market." §8.1 "`realtor:migration` = a realtor with any `<City> realtor` tag OR `migration broker`… `audience:broker-recruit` (233) → RETIRE." Audit item (3): "verify migration-realtor rule classifies all 2,341."
- **Contradicting evidence (all from the real classifier):** `industry:realtor` (2,405) → **move-to-field → dropped** (contradicts "kept as base"). `Realtor` (2,315) → **retire → dropped**. All ten `<City> realtor` feeder tags + `migration broker` (59) → **retire → dropped** (the plan says these *drive* `realtor:migration`). `audience:broker-recruit` (233) → **kept** (plan says retire). There is **no code anywhere** that emits `realtor:local` or `realtor:migration` — grep-confirmed, and `deriveFromAddresses` only emits owner/location. Live: 2,342 stage-realtors / 2,405 `industry:realtor` / 2,315 bare `Realtor`.
- **Blast radius:** the migration **classifies 0 of 2,341** realtors (audit item 3 target) and strips their identity tags. Local Realtors + Migration Realtors lists are empty. Only the (mis-kept) 233 broker-recruit tags survive.
- **Fix:** build the realtor derivation (base `industry:realtor` retained + local/migration from the market signal) and reverse the `industry:`/`Realtor`/`<City> realtor` drop rules before apply.

---

## P1 — wrong result

### P1-1 · `segment:buyer` / `segment:seller` are never produced → Buyers list empty; seller segment absent.
- `Buyer` (53) → retire; `audience:buyer` (42) → kept as-is (not renamed). Nothing emits `segment:buyer`. The live Buyers view keys `audience:buyer` (works today, 42), but plan §4 wants `segment:buyer` — which no code creates. Same mechanism as P0-4 on the seller side. Fix: add the `Buyer/audience:buyer → segment:buyer` (and seller) renames, or repoint the lists to the kept `audience:*` tags and delete the `segment:*` claims.

### P1-2 · The coordinated migration is ~15% built; running the one existing artifact breaks the live views.
- **Absent entirely:** `deriveCanonicalTags` (§5 auto-tagging — grep: 0 hits), the stage-migration + restore scripts (`scripts/*stage-migration*` — none), the smart-list rebuild (§6.5), the demotion/inactivity sweep. Only the tag rewrite exists.
- **Breakage if the tag rewrite runs alone:** the migration renames `intent:expired-listing` → `segment:expired` and `intent:fsbo` → `segment:fsbo`, but the live "Expired Pipeline" view filters `{tagsAny:["intent:expired-listing"]}` and "FSBO Pipeline" filters `{tagsAny:["intent:fsbo"]}` — **nothing repoints them** → both go empty. No view-rebuild code exists. Handoff §0's "one coordinated, reversible batch" cannot ship from what's in tree.
- Fix: treat this as "design done, build not started"; do not run the tag script as if it were the migration.

### P1-3 · The 30-day two-way demote has no valid data source.
- **Plan claim:** stage §"Anti-stuck" + §Resolved.3 — Engaged → Nurture after 30 days of **no two-way** activity (inbound reply / held call / kept appointment — NOT opens, NOT outbound sends). "high — the load-bearing automation."
- **Contradicting evidence:** `last_activity_at` is written in exactly **one** place — `app/actions/crm-person-detail.ts:318-321`, the manual **call-log** action, and it fires for **every** outcome including `Left voicemail` / `No answer` / `Wrong number` (`:292`) — i.e. **outbound attempts**. Inbound Twilio SMS (`app/api/twilio/inbound-sms`), the conversations webhook, and the Gmail sync **do not touch `last_activity_at`** (grep of `app/api` for a `last_activity_at` write returns only the read-only export route). So the field (a) is set by outbound activity and (b) is blind to inbound replies.
- **Blast radius:** a demote keyed on `last_activity_at` would mis-fire **both ways** — leaving a voicemail resets the 30-day clock (stale contacts never demote), while a genuine inbound text reply does **not** reset it (an engaged contact who replied gets wrongly demoted). This is the automation the stage doc calls the most important one.
- Fix: define "two-way activity" from the timeline (inbound `crm_timeline` rows + held-call outcomes + kept appointments), not `last_activity_at`; build the sweep against that. Note also the `lastActiveDate` custom field exists but is a separate, unverified source.

### P1-4 · Move-to-field target fields are missing for brokerage / city / area / tenure / seller-score-bucket / lifecycle; neighborhood is text, not the single-select §8.2 specifies.
- Live `crm_field_definitions` has `neighborhood` (**text**), `subdivision` (text), `equityPercent`, `marketValue`, `yearsOwned`, `sellerScore` (number). It has **no** `brokerage`, `city`, `area`, `tenure`, or bucketed `seller-score` field. So even after P0-1 is fixed, those families have nowhere to land. §8.2 wants neighborhood as a **single-select** derived by point-in-polygon; the field is a free-text column and no geocode/boundary derivation exists. Fix: create the missing fields (right types) and convert neighborhood to select before wiring the move.

---

## P2 — polish / lower severity

### P2-1 · Compliance is intact — confirmed — but `email:invalid/-catchall/-valid/-unverified` are retired despite §3.1 "keep email:invalid/bounced."
- **Reassuring:** all seven live send-gate tags (`lib/crm/suppressions.ts` `TAG_CHANNEL`: `compliance:hard-stop`, `contact:do-not-text`, `contact:do-not-call`, `do_not_email`, `unsubscribed`, `bounced`, `complained`) are in the migration's `SACRED` set and kept verbatim; `crm_suppressions` rows are untouched. **No suppressed contact is made contactable** (audit item 8 passes). `tcpa:litigator`, `compliance:dnc-registry`, `compliance:deceased`, `contact:do-not-email` are also SACRED.
- **Divergence:** `email:invalid` (746), `email:catchall` (202), `email:valid` (4,702), `email:unverified` (1,324) → **retire**, but §3.1 says keep `email:invalid/bounced`. Not a compliance breach (none are send-gate tags), but it loses 8,386 deliverability signals and contradicts the plan. Confirm intent; if kept, add `email:` carve-outs.

### P2-2 · `do_not_text` (bare, 1 contact) is retired and not SACRED — its analog `do_not_email` IS.
- Belt-and-suspenders gap. Not in `TAG_CHANNEL` so not a live-gate breach, but add `do_not_text` to `SACRED` for parity.

### P2-3 · Out-Of-Area has a hard address-coverage ceiling the plan's 1,743 doesn't state.
- Only **2,738** contacts have a `type='Property'` address; **2,615** have property + a mailing; **2,006** have property + mailing-with-a-state (the only rows where `location:*` is derivable). 7,141 contacts (39%) have **no** address at all. The plan's "1,743 out-of-area" is really "1,743 of the ~2,006 address-complete subset"; out-of-area owners among the addressless/property-only are invisible to the rule. State the ceiling; don't present 1,743 as the whole.

### P2-4 · The address/market smart lists may not be expressible as `crm_saved_views`.
- Live view filters are simple `{tagsAny}` / `{stage}` JSON. "Out Of Area Home Owners" (an address rule) and "Local/Migration Realtors" (a market rule) can't be written as such a filter, and `segment:out-of-area` — which §5 says to derive — is **never emitted** by `deriveFromAddresses`. Either emit the derived `segment:*` tag (then the list is a normal tag filter) or extend the filter engine. Today neither exists.

### P2-5 · Plan §7 blast-radius numbers don't match the classifier.
- §7 claims "~1,038 → fields, ~166 deleted, ~119 collapsed to canonical, ~40 kept." Actual: **1,125** move-to-field, **263** retire, **10** rename + **15** derive-drop, **34** keep. The "~40 kept / ~119 collapsed / ~166 deleted" figures are materially off and should be regenerated from the real map before Matt reviews a dry-run.

---

## Cross-check against the audit checklist

| # | Item | Result |
|---|---|---|
| 1 | Tag-collapse completeness; compliance survives verbatim | Every tag gets a fate (no silent drop); **compliance verbatim ✓**. But the fates are wrong for realtor/buyer/seller (P0-5, P1-1) and destructive for move-to-field (P0-1). |
| 2 | "Move to field" non-destructive; neighborhood derivation | **FAIL** — no field write at all; 2,643 neighborhood + 2,984 subdivision + 163 brokerage values lost; neighborhood field is text not select; no geocode derivation (P0-1, P1-4). |
| 3 | Segments reconcile; realtor rule classifies all 2,341; broker-recruit retired | **FAIL** — realtors classified **0**, identity dropped; broker-recruit **kept** not retired (P0-5). Sellers reconciliation broken (P0-4). |
| 4 | Stage remap reconciles + business-correct | Old→new map covers every **populated** live stage; counts match (Lead 8,265 / Seller Prospect 7,524 / Realtor 2,342 / Active 12 / Past 32 ✓). **But no remap script exists**, and the remap breaks the Sellers list (P0-4). New stages already pre-created + active alongside the old 16 (not yet deactivated). |
| 5 | Automation fires + doesn't mis-fire | **FAIL** — demote data source invalid (P1-3); no sweep built; Active/UC-never-demote is correct in spec but unimplemented; no soft-signal promotion sneaks in (spec is correct on that). |
| 6 | Reversibility real | **FAIL** — interrupted run unrecoverable (P0-2); re-run destroys backup (P0-3); backup covers tags only, **not stages** (no stage backup script). Dry-run does write zero ✓. |
| 7 | Ordering (tags before readers) | The one artifact rewrites tags but nothing rebuilds the views that read them → live views break (P1-2). |
| 8 | Compliance intact; no suppressed contact made contactable | **PASS** — verified against the live `TAG_CHANNEL` gate (P2-1). Minor `do_not_text`/`email:*` divergences (P2-1/2-2). |

---

## Recommendation

**Do not run the in-tree migration as "the plan."** It implements a superseded proposal. Before any dry-run
is shown to Matt: (1) add the field-write step + create the missing fields, with an immutable pre-write
backup; (2) build the realtor/buyer/seller/out-of-area segment emission; (3) build the stage-remap +
its backup; (4) build the list rebuild so filters match the new tags; (5) re-source the demote off real
two-way timeline activity; (6) regenerate §7's blast-radius numbers from the real map. Then dry-run,
reconcile every list count to a live query, and only then apply — as one batch, with a single
pre-image backup of both `tags` and `stage`.
