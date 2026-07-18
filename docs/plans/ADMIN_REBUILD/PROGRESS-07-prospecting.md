# Spec 07 · Prospecting hub — build log

Building `docs/plans/ADMIN_REBUILD/specs/07-prospecting.md` (the ONE `/admin/prospecting` surface) per Matt's 2026-07-18 directive: consolidate the confusing expired multi-page mess into one mobile+desktop worklist with photo/map/price-history/audit + a rich compliance-gated send dialog (preview, test, editable template, inline delivered/opened/clicked reporting), then clone the surface to Seller-CMA and Buyer-Price-Opinion siblings. Taxonomy locked: **CMA = sellers · Audit = expireds · Price Opinion = buyers.**

Matt's two build decisions (2026-07-18): (1) **Expired first on a cloneable architecture, then CMA + Price Opinion**; (2) **rich send dialog on the dashboard, gated per recipient** (every real recipient still passes hard-stop / DNC / quiet-hours / suppression).

## DONE (this session)

### Data foundation — additive, back-compatible migrations APPLIED to hosted (dwvlophlbvvygjfxcrhm) + files committed to `supabase/migrations/`
- `20260718120000_prospect_cma_link.sql` — `cma_id uuid` FK on expired_listings + fsbo_listings (+ indexes). Resolve doc by id, slug fallback (§4.2).
- `20260718120100_prospect_compliance_flags.sql` — `compliance_hard_stop bool`, `compliance_flags jsonb`, `compliance_source text` on both (§4.3). Display + fail-closed secondary; authoritative gate stays `isSuppressed`.
- `20260718120200_prospect_send_claim.sql` — `outreach_sms_status`, `outreach_claim_at`, `outreach_idempotency_key` on both (§4.5).
- `20260718120300_seed_prospecting_templates.sql` — seeds `expired-first-touch-sell-v1` + `fsbo-first-touch-v1` into crm_templates (NOT EXISTS guard; never clobbers prod live edits) (§4.6).
- `20260718120400_prospect_send_claim_rpcs.sql` — row-locked `prospect_send_claim` / `prospect_send_finalize` / `prospect_send_release` (at-most-once, idempotent-replay, 2-min stale-claim window) (§4.5).
- Verified: 7 new cols on each table (162 expired / 17 fsbo rows), 2 templates present.

### doc_type threaded end-to-end (Defect 4 fix — §4.1)
- `lib/cma-request.ts` — `CreateCmaRequestInput.docType?: 'cma'|'expired-audit'` → written to `payload.doc_type`.
- `lib/cma/worker.ts` — reads `payload.doc_type` → passes `docType` to `buildCma` (which already branches at build.ts:283).
- `lib/expired-listing-processor.ts` — passes `docType:'expired-audit'` + stamps `expired_listings.cma_id` from the returned `cmaId`.
- `lib/fsbo-processor.ts` — stays default `'cma'` + stamps `fsbo_listings.cma_id`.
- Net: newly-detected expired listings now auto-build as **audits** and self-link by id, so the surface shows "Send intro" with no manual 60s rebuild.

### Contract + send-claim wrapper (authored by main session — the compliance core)
- `lib/data/prospecting/types.ts` — the shared contract (ProspectKind, ProspectRow, ProspectDetail, ProspectListResult, ProspectDocState, ProspectComplianceState, ProspectEngagement, ProspectListFilters, SendIntroResult, SendGuardCode, `expectedDocTypeFor`, `introTemplateKeyFor`).
- `lib/data/prospecting/send-claim.ts` — `claimProspectSend` / `finalizeProspectSend` / `releaseProspectSend` over the RPCs.

## IN FLIGHT (parallel agents)
- **Read-DAL agent** → `lib/data/prospecting/{docs,compliance,engagement,get,list,index}.ts` + one export line in `lib/data/index.ts`. Ports existing compliance/relist/engagement logic; fail-closed. `getBuiltDocForProspect` = the ONE "built" definition (doc_type match + sendable status + cma_id-first resolution).
- **UI-components agent** → `components/admin/prospecting/*` presentational client components (ProspectFilters, ProspectCard, ProspectComplianceRibbon, ProspectDocPill, ProspectMap, ProspectPriceHistory, ProspectDetailPanel, ProspectDetailDrawer, ProspectSendDialog). Built against types.ts + callback props (decoupled from unfinished actions/DAL).

## NEXT (main session owns)
1. `app/actions/prospecting.ts` — `sendProspectingIntro(kind,id,{idempotencyKey})` (15 ordered fail-closed guards, §5.3, claim→Twilio→finalize/release), `buildProspectDoc(kind,id)` (async queue, §5.4), `getBuildStatus(actionId)`, `prepareProspectSend(kind,id)` (pre-merge default templates + already-sent + engagement for the dialog), `sendProspectTest({channel,subject,body})` (reuse `sendTemplateSelfTestAction`). Port guard chain from `app/actions/expired-outreach.ts`.
2. `app/admin/(protected)/prospecting/page.tsx` — server component: `requireAdminPage('prospecting.view')`, read `listProspects(filters)` / `getProspectDetail` (streamed `<Suspense>`), render KpiStrip + ProspectFilters + worklist + `?id=` detail drawer + send dialog; pass server actions down as props.
3. Route consolidation (§3): old routes → `redirect('/admin/prospecting')` (`/admin/expireds`, `/admin/expired-outreach`, `/admin/expired-listings[/[key]]` stub, `/admin/fsbos`). Repoint `lib/admin/nav.ts` Prospecting group children.
4. Browser E2E (desktop + mobile viewport, matt@ magic-link) — load surface, filter, open detail, open send dialog, preview, **send test to self only** (never a real cold text to a real owner without Matt), confirm reporting + no h-scroll. Adversarial review of the send path. `npm run ci:gates`. Commit.
5. Compliance writer fixes (§6, follow-on): Tracerfy/Apify skiptrace structured compliance + drop DNC-phone fallback; FSBO off-market + re-list guards + silent-failure fix. Delete the 5 hard-stop regexes + dead actions + hardcoded preview (§ DELETE list).
6. CLONE to siblings: `/admin/cmas` (seller CMA worklist) + `/admin/bpo` (buyer Price Opinion worklist) reuse the shared shell + send dialog, pointed at their own doc-worklist DAL. Narrow BPO display to buyer posture per Matt ("Price Opinions are for buyers").

## VERIFIED + SHIPPED-READY (2026-07-18)

- **Browser-verified** (authed matt@, real data): one `/admin/prospecting` hub; old routes (`/admin/expireds`, `/admin/expired-outreach`, `/admin/fsbos`, `/admin/expired-listings[/[key]]`) redirect to it; nav repointed (G52 green). Fast load, accurate counts (162 total / 75 ready / 38 needs-audit / 0 sent / 15 excluded / 34 no-phone, all traced to source). No mobile horizontal scroll. Detail drawer renders photo + Google map + full price history + specs + engagement. Send dialog opens with recipient + editable merged template + preview + send-test + compliance-gated send.
- **One-definition fix:** list vs. detail disagreed on "built" (per-row resolver excluded `delivered` status); unified `getProspect`/detail/send to the batch resolver (spec §4.1).
- **Perf fix:** the initial per-row classification did ~500 queries/load (hung + stack-overflowed). Rewrote to a batch classifier (`batch.ts`, ~4 queries) + `makeResilientCached`.
- **Adversarial compliance review done.** Fixed before ship: F1 (finalize-failure after a successful Twilio send used to release the claim → retry double-text; now never releases post-send, finalize-with-retry), F2 (relist guard failed OPEN on read error; added `verifyNotRelisted` fail-closed at send time), F5 (dangerous `compliance_flags` now block even without the boolean), F6 (added value-keyed phone SMS-suppression check). Gate caught a real silent-failure bug: quoted `.select('"StreetName"…')` in supabase-js → fixed to bare columns.
- **Deferred (documented follow-ups, non-blocking):** F3 (hard-crash-between-send-and-finalize 2-min reopen window — needs Twilio reconciliation), F4 (quiet-hours uses Pacific, not recipient-local tz — pre-existing system-wide, not prospecting-specific), F7 (relist street-name token-prefix match is fragile — ported from legacy), F8 (unused `docs.ts`/`compliance.ts` resolvers now that batch is canonical — dead-code cleanup), F9 (person mutation before the claim on a blocked send — no text leaves), F10 (`toE164` last-10-digits international mangling — narrow for OR book).
- **Gates:** full `npm run ci:gates` chain EXIT=0. `tsc` 0 errors. Schema snapshot + DAL index refreshed (G16). file-size baseline bumped +1 for the required `@/lib/data` barrel export (page-dal gate mandates the barrel import).
- **NOT yet done (next pass, per Matt "expired first, then clone"):** the CMA (seller) + Price-Opinion (buyer) sibling dashboards reusing this shell; a `cma_id` backfill for legacy rows (they resolve via slug fallback today — new rows self-link).

## Guardrails
- Draft-first for real client sends: send TEST to self is fine; a real cold intro to a real owner waits for Matt.
- Additive migrations only (no drops). `cma_id` legacy rows resolve via slug fallback (warned) until a backfill script runs — new rows self-link.
- `git pull --rebase` before every push (concurrent Cursor sessions). Pre-push runs full gates (~10 min).
