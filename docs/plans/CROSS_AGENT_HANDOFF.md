# CROSS-AGENT HANDOFF — Full Codebase Audit

**Date:** 2026-06-13
**HEAD:** `b67ce2ab8e8e91961cb646f1ceddc3b0a9dd0bd0`
**Branch:** `main`

> This document is the authoritative replacement for the four prior session handoffs (`HANDOFF-homepage-voice-2026-06-13.md`, `HANDOFF-cma-form-twilio-2026-06-13.md`, `HANDOFF_HEATH_LP_2026-06-13.md`, `HANDOFF_CRM_SESSION_2026-06-12.md`) and the `NEXT_SESSION_START_HERE` pointer. It synthesizes a full-universe audit (30-agent fan-out) of the platform. **Note: the working tree was a moving target during this audit** — files were being staged and changed by parallel sessions as agents read them, so treat the working-tree section as a snapshot, not a guarantee.

---

## 1. CURRENT STATE

- **HEAD:** `b67ce2ab` on `main`.
- **Working tree:** 46 entries dirty (20 tracked modifications + 26 untracked files), spread across three in-flight feature threads plus two locked-system documentation overhauls.
- **In-flight features:**
  - **Homepage V6/V7** — `app/page.tsx` rewritten to a "Linear" linear-stack design; new `components/site/HomepageV6*.tsx` island set; `app/globals.css` +1105 unreviewed lines; `next.config.ts` CSP adds `tile.googleapis.com` + `blob:`. **Architecture unresolved** (3D-tiles "OUT" vs CSP/JSDoc that wire live Google 3D Tiles; three competing `parity.json` specs). The rejected cinematic variant (`HomepageCine*`, 12 components) is orphaned and unreferenced.
  - **Trails** — new `app/trails/` index + detail pages, `components/site/Trail*.tsx`, `scripts/trails/*`, and a migration (`20260613040000_trails.sql`) already applied to prod but UNTRACKED in git. DAL exports are correct; the only blocker is a design-token regression in the new components.
  - **TC e-signature** — Phase 2b envelope composer + public signer + sealed PDF shipped 2026-06-12; one live end-to-end test still pending. Two files in this thread hardcode a `.vercel.app` fallback and fail the staging-host gate.
- **Locked-system docs in tree:** brand-voice v2 (`VOICE.md` Five Laws canonical) and the DAL/schema snapshot refresh.

---

## 2. SYSTEM STATUS

One line per system. Counts: ~58 LIVE-HEALTHY · ~22 LIVE-DEGRADED · ~13 BLOCKED (1 BLOCKER) · ~9 UNUSED · ~8 STALE-REMOVE · ~4 UNKNOWN.

### MLS / Listing Sync
- Spark API (SPARK_) — LIVE-HEALTHY; strong SFR-filter discipline, 200/page pagination.
- Production Supabase (`dwvlophlbvvygjfxcrhm`) — LIVE-HEALTHY; all 3 new tables applied.
- sync-delta / sync-full / sync-history-terminal crons — LIVE-HEALTHY.
- refresh-mvs cron + materialized views — LIVE-DEGRADED; no auto-retry/heartbeat, stale tiles up to 15 min if a refresh stalls.
- Schema snapshot + DAL index (G16) — LIVE-DEGRADED; **drifted after 3 new migrations, G16 gate FAILING** (`npm run ci:data-access -- --refresh`).

### CRM / Follow Up Boss
- FUB API + CRM mirror + auto-enroll + FUB delta sync + seller-workflow-pause — LIVE-HEALTHY.
- CRM contacts/inbox/detail/deal/broker dashboard — LIVE-HEALTHY (32 PASS / 3 WARN on e2e; GCal DWD live).
- CRM sequence engine — LIVE-DEGRADED; engine healthy but **all 4 sequences `status='paused'`**.
- CRM lead-identity header — **BLOCKED / not implemented** (Matt's #1: "no idea what lead I'm looking at"), ~20-30 LOC.
- FUB POST /v1/textMessages — LIVE-DEGRADED (FUB cannot POST texts; SMS moves to Twilio post-cutover).
- FUB outreach execution cron — LIVE-DEGRADED; redundant post-cutover.
- `fub_contacts_cache` table — BROKEN / absent in hosted DB; blocks facebook-seller-growth outreach.

### Transaction Coordination (TC)
- TC Phase 1/2a–2f (migration, write, req-docs, contacts, commissions, expenses) — LIVE-HEALTHY; reconciled to the cent ($384K GCI).
- TC Phase 2b e-signature — LIVE-HEALTHY; one live e2e test pending.
- TC Phase 3 field-mapper — UNKNOWN / not started; blocked on Matt's OREF blanks.
- SkySlope API — UNUSED; migration complete, 29 scripts prunable.
- tc_principal_reviews / broker_gcal_tokens tables — LIVE-HEALTHY; add to DAL index on refresh.

### Twilio / SMS
- Twilio account + Messaging Service + inbound webhooks + broker forwards — LIVE-HEALTHY; brand APPROVED; balance $10.86.
- **A2P 10DLC campaign — BLOCKED** (IN_PROGRESS carrier review ~2-3wk; error 30034 on all outbound; ticket #27497858; clears ~2026-06-26 to 07-03, auto-unblocks).
- All outbound SMS (sequence/drip/manual/direct) — BLOCKED; queues until A2P VERIFIED.
- iMessage fallback relay + LaunchAgent — LIVE-HEALTHY / UNKNOWN load status (`launchctl load` to confirm, else brokers miss instant alerts).

### Email
- Gmail DWD (3 mailboxes) + CRM Gmail sync + Oregon disclosure in CRM email — LIVE-HEALTHY.
- Resend (RESEND_) — LIVE-DEGRADED; `mail.ryan-realty.com` unverified, blocks email producers + digest tier.
- CMA signature page ORS 696.820 disclosure — BLOCKED / missing (compliance gap if CMA is first contact).

### Meta / Facebook
- Meta CAPI + Lead Ads webhook + organic/publishing + IG/page tokens — LIVE-HEALTHY.
- **Meta Graph Insights (ad spend) — BLOCKED**; `marketing-snapshot-meta-ads` NOT in vercel.json, zero `meta_ads` rows.
- Meta ad account — LIVE-DEGRADED; 3 PAUSED campaigns + 1 orphan adset active ($47/wk, never recorded).

### Google Suite
- GA4 server + client + consent + caching + AI-referrer + Ads pixels + GBP OAuth/health/digest + GCal DWD + Maps + service account — LIVE-HEALTHY.
- GA4 Data API (reporting) — LIVE-HEALTHY but needs `GOOGLE_GA4_PROPERTY_ID` + service-account creds set.
- GA4 AI Assistants channel group — UNKNOWN (GA4 Admin group not created).
- **GSC ingest — BLOCKED**; no client/cron/snapshots exist.
- **Google Ads API (server v18) — BLOCKED**; cron unscheduled + 3 creds unset, silent no-op.
- **GBP post publishing — BLOCKER**; no cron publishes posts (health check only detects staleness).
- `fetchGbpPostMetrics()` — BLOCKED stub (throws `fetcher_not_implemented`).

### Social Platforms
- Token-heartbeat + OAuth storage (7 tables) + publisher-sweep + publish routes + all 7 platforms (TikTok/LinkedIn/X/YouTube/Threads/Pinterest/Nextdoor) — LIVE-HEALTHY (no content has ever published).
- 11 marketing-snapshot crons — UNUSED; all on disk, none scheduled.

### AI / Producers
- **Anthropic API — BLOCKED**; credits EXHAUSTED, blocks 4 queued expired CMAs + producer-runtime (stale since 2026-05-24) + market-report blog publish.
- Producer registry + freeze (G45) — LIVE-HEALTHY; frozen 2026-06-09, maintenance-only.
- ElevenLabs / OpenAI / xAI / Replicate — LIVE-HEALTHY. Fal.ai — UNUSED (balance exhausted). Synthesia — LIVE-DEGRADED (never called).
- CMA producer + skill — LIVE-HEALTHY (locked 2026-06-13).
- Action row 72c4ee55 (Laurie McAdam 62285 Deer Trail CMA) — LIVE-DEGRADED; status=`ready`, verified PASS-with-flags, **awaiting Matt's "ship it"**.

### Media / Content APIs
- Unsplash / Pexels / Shutterstock / Apify / detect-fsbo cron / asset library + dedup gate — LIVE-HEALTHY.
- Shutterstock 23 watermarked assets — LIVE-DEGRADED; unlicensed, mockup-only.
- SchoolDigger / NeverBounce / BatchData — UNUSED (provisioned, zero references).

### Infra / Config
- Vercel config / CSP / Sentry / lib/env validation — LIVE-HEALTHY.
- **Staging-host gate — BLOCKED**; 2 files hardcode `ryanrealty.vercel.app` (`tc-envelopes.ts:49`, `seal-envelope.ts:27`).
- Upstash — UNKNOWN (no lib/redis.ts but TikTok OAuth uses it). Inngest / Cursor / GCP_USER_REFRESH_TOKEN / misc env — STALE-REMOVE.

### Site / SEO / Brand / Funnel
- Nav + SEO infra + 4 main lead funnels + WP/Next blogs + measurement-loop wiring — LIVE-HEALTHY.
- Brand voice (VOICE.md, G2/G3) — LIVE-HEALTHY (19-violation baseline to burn down).
- Trails route — LIVE-HEALTHY (not yet in sitemap.ts).
- Heath LP — LIVE-DEGRADED (30-min enroll lag, no instant CMA/mirror, SEO URL misplaced).
- **Homepage V6 — LIVE-DEGRADED** (25 token regressions, 3D-tiles arch unresolved, HomepageCine* orphaned).
- Design system (shadcn/radix-nova) — LIVE-DEGRADED (353 vs 328 baseline token issues).
- Market-report cron — LIVE-DEGRADED (publish blocked by Anthropic credits).

### Dead / Orphaned Crons
- loop-health-check — LIVE-DEGRADED (scheduled but loops STOPPED 2026-06-11). weekly-cycle — UNUSED dead alias. 27 total unscheduled routes on disk; STALE-REMOVE.

---

## 3. FUNNEL HEALTH

Gold standard = `seller-home-value/actions.ts`: instant 0-min enroll, CMA link stamped on the CRM person before first-touch preview, full CAPI+GA4 dual fire, attribution captured at submit.

| Path | Lead Creation | CAPI | Attribution | Enroll Speed | Sequence | Overall |
|---|---|---|---|---|---|---|
| **Seller** | gold | $500 | high | 0-min | paused | 🟢 |
| **Expired** | mirrors gold | $500 | high | 0-min | paused + SMS step-0 blocked | 🟡 |
| **FSBO** | mirrors gold | $500 | high | 0-min | paused + SMS blocked | 🟡 |
| **Buyer** | mirrors gold | $300 | thin | 0-min | paused | 🟡 |
| **Heath** | off-standard | $500 | async-dep | 7.5–30 min | paused | 🟠 |

**Three cross-cutting funnel facts:**
1. **All 4 CRM sequences (plans 69/70/71/72) are `paused`, not `active`** — `enroll.ts` returns "sequence not active", so auto-enroll creates `awaiting_broker` rows that never run. This gates the **email** half of every path, not just SMS. Single highest-leverage unblock: `UPDATE crm_sequences SET status='active' WHERE fub_legacy_plan_id IN (69,70,71,72)`.
2. **All outbound SMS is A2P-blocked** (Twilio, external, ~2-3wk). Expired step-0 and FSBO/seller drips are SMS-first; they queue and auto-fire the first cycle after VERIFIED. Email steps fire fine.
3. **Ad-spend measurement is dead** — `marketing-snapshot-meta-ads` + `marketing-snapshot-google-ads` are unscheduled, so zero spend rows land and the attribution loop has no input. CAPI itself is healthy on every submit (seller/fsbo/expired/heath $500, buyer $300, shared dedup `event_id`).

**Heath deviates from gold standard** (Matt-aware): async `canonicallyTagLead()` instead of synchronous `autoEnrollByFubId()`; no `createCmaRequest()`, no instant mirror, no instant Matt alert; legacy `seller-intent` tag. Open items: golf/tax panel, SEO URL move to `/communities/tetherow/heath` + 301, templatize.

**Compliance:** CRM emails carry the ORS 696.820 pamphlet link; the CMA signature page does not (gap if a CMA is the first-contact doc).

---

## 4. GATE + CI HEALTH

**Four gates fail and block commits sitewide — fix these first:**

1. **`tsc --noEmit` baseline** — PASSES *only after* `rm -rf .next`. The earlier errors were stale `.next` manifest entries pointing at deleted google-calendar OAuth routes, not a code bug. Every downstream `ci:commit-compiles` depends on this clean baseline. (`ci:commit-compiles` / G46 PASSES at 26.5s after the purge.)
2. **G16 Data Access Discipline** — FAIL; schema snapshot + DAL index drifted after the 3 new June migrations (trails, tc_principal_reviews, broker_gcal_tokens). Fix: `npm run ci:data-access -- --refresh` and commit both generated files.
3. **`check-no-staging-host`** — FAIL; `app/actions/tc-envelopes.ts:49` and `lib/tc/seal-envelope.ts:27` hardcode `https://ryanrealty.vercel.app`. Fix: fallback to `https://ryan-realty.com`.
4. **`ci:design-tokens` (G2/G5)** — FAIL; +25 regression (328→353). New Trail* components use hardcoded hex (`#102742`, `#ff5a1f`, `#0b1a2e`, `#ffffff`), arbitrary Tailwind (`h-[64vh]`, `text-[11px]`, `min-h-[460px]`), and hand-rolled cards; also PDF sign flow, LP forms, broker-dashboard.

**Passing (notable):** brand-voice G2/G3 (PASS at 19-violation baseline), G1 DAL boundary, G17 column-quoting, G21 DAL-internal, G8 page-DAL (0 new violators), migration-drift, G6 mockup-parity (PASS but 3 competing parity specs — homepage-v6 / v7-cinematic / base — canonical unresolved), G7 dead-UI, CSP, G45 producer-freeze, G34 structured-data (24 surfaces), nav/canonical/SEO-routes, measurement-loop, G44 process-canon.

**Runtime/operational (not commit-blocking):** A2P 10DLC (external BLOCKING-PRODUCTION), Anthropic credits (external BLOCKING), CRM sequences paused (HIGH), meta-ads/google-ads snapshot crons unscheduled (HIGH/MEDIUM), Resend domain unverified (MEDIUM), CMA ORS disclosure (MEDIUM), GBP post automation missing (MEDIUM), crm-alert-relay LaunchAgent load UNKNOWN (MEDIUM), MV refresh no-retry (MEDIUM).

**Gaps with no gate:** no dead-link detector in CI; no CLAUDE.md prose lint (orphaned v1 spec at lines 272–275 + misdirected line 561); no migration-syntax `ci:schema` check before manual apply; no security-review gate for CSP `blob:` additions.

---

## 5. PRUNE LIST SUMMARY (top 15, highest confidence)

| Item | Type | Why | Conf |
|---|---|---|---|
| `components/site/HomepageCine*` (12 files: CineHero/Closer/Search/DealFlow/Collection/Tools/Sell/Proof/Standard/Guides/Places/Parallax) | orphaned components | Rejected cinematic variant; zero imports in any active route | high |
| 11 `app/api/cron/marketing-snapshot-*` (fub/ga4/gbp/google-ads/gsc/linkedin/meta-ads/meta-page/tiktok/x/youtube) | dead cron routes | Unscheduled; logic consolidated into snapshot-channels. **CONFLICT:** schedule meta-ads + google-ads to repair the measurement loop instead of deleting — resolve with Matt | high |
| Inngest integration (`lib/inngest.ts` + 2 admin send calls + INNGEST_* env) | dead-code module | Scaffolded; no events/subscribers defined; silent no-op | high |
| Synthesia integration (`app/actions/synthesia.ts`, `createSynthesiaVideo`) | dead-code feature | Integrated but never invoked from any route/producer | high |
| `app/api/cron/weekly-cycle` + `optimization-loop` + `sync-verify-full-history` | dead cron routes | Dead aliases / unscheduled, never invoked since freeze | high |
| 24 stale env vars (CURSOR_API_KEY, 3× ELEVENLABS_VOICE_ID*, SCHOOLDIGGER_*, GCP_USER_REFRESH_TOKEN, REMOTION_GOOGLE_MAPS_KEY, NEVERBOUNCE_API_KEY, META_FB_PAGE_NAME, NEXT_PUBLIC_FUB_*, NEXT_PUBLIC_GTM_CONTAINER_ID, TWILIO_PHONE_NUMBER) | env vars | Zero references / superseded / vendor-display-only | high |
| `app/api/maps/cma-228-soft-tail/route.ts` | dead route | Slug never registered in `lib/cma-map.ts`; returns null buffer; CMA never finalized | high |
| SkySlope legacy scripts (~29: `scripts/_skyslope-*`, `scripts/skyslope-*`) | infrastructure | TC migration complete; no new SkySlope work | high |
| 23 watermarked Shutterstock assets (`data/asset-library`, `out/asset-audit/catalog.json`) | assets | Unlicensed, visible watermarks; replace or remove before any deliverable | high |
| `scripts/build_cma_wrapper.py` | script stub | Copy-relabel stub; §0 wrong-property risk; never wired | high |
| `fetchGbpPostMetrics()` stub (`lib/google-business-profile.ts`) | code stub | Always throws `fetcher_not_implemented`; no consumer | high |
| `.claude/skills/skyslope-form-compliance-{v1-snapshot,workspace}/` | skill snapshots | Historical backups; real skill at `skyslope-form-compliance/` | high |
| Old session handoffs (`SESSION_HANDOFF_2026-06-01*.md`, 3× `site-consistency-audit-2026-06-*`, `ultracode-site-consistency-kickoff.md`) | docs | 12+ days old; superseded by THE LOOP + this doc; archive | high |
| CLAUDE.md lines 272–275 (gold #D4AF37/#C8A864, AzoSans, Cream #F2EBDD) + line 561 caption cross-ref | CLAUDE.md sections | Orphaned v1 spec contradicted by Design System v2 + captions lock (Amboqia) | high |
| `project_heath_lp_charts.md` "BROKEN" claim | project memory | Contradicted by commit d3a4549a (chart FIXED); update or delete | high |

**Conflicts the next session must resolve before acting:** (a) marketing-snapshot crons — schedule meta-ads/google-ads (repair loop) vs delete all 11 (consolidated); (b) 3D-tiles CSP — homepage 3D is "OUT" but it is wired to the V6 city-tiles island and the trails 3D viewer (`TrailViewer3D` is the legitimate consumer); (c) the 155 marketing/video/social sub-skills are "maintain, do not delete/expand" under the G45 freeze, not a true prune.

---

## 6. COMMIT SEQUENCE

Working tree = 44+ files across three feature threads + two locked-system doc overhauls. Dependency-ordered; each unit commits clean against `ci:gates`.

**Land first (autonomous, clears blockers):**
- **Unit 1 — Restore tsc + ci:commit-compiles (trail fix).** `lib/data/index.ts`, `docs/DAL_INDEX.md`, `docs/DATABASE_SCHEMA_SNAPSHOT.md`. The four trail exports (`getTrailsIndex/getTrailDetail/getTrailGeoJSON/getTrailHomes`, lines 541–548) already resolve to implemented files; `getTrailElevation.ts` stays unexported. `rm -rf .next && npx tsc --noEmit` to confirm clean, then `npm run ci:data-access -- --refresh` to clear G16 drift. **Must land first — every downstream unit depends on a clean tsc baseline.** SAFE-AUTONOMOUS. Risk LOW.
- **Unit 6 — Staging-host gate fix.** `app/actions/tc-envelopes.ts`, `lib/tc/seal-envelope.ts` → fallback `https://ryan-realty.com`. Land early to stop the gate blocking every commit. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 2 — Track trails migration.** `supabase/migrations/20260613040000_trails.sql` (already applied to prod; table + GiST/GIN indexes + 3 RPCs the Unit 1 DAL calls). SAFE-AUTONOMOUS. Risk LOW.

**Then autonomous feature/docs:**
- **Unit 3 — Trails pages + components** (`app/trails/*`, `components/site/Trail*.tsx`, `scripts/trails/*`). BLOCKED on the +25 design-token regression — fix hex→tokens, hand-rolled→`<Card>`, arbitrary utils→ladder first. Optional `/trails` sitemap seed. SAFE-AUTONOMOUS once tokens fixed. Risk MEDIUM until fix.
- **Unit 4 — CMA map + Deer Trail routes** (`lib/cma-map.ts` cma-62285-deer entry, `app/api/maps/cma-62285-deer/route.ts`, `public/drafts/cma-62285-deer/`). Map infra only; CMA delivery is separate. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 7 — Brand voice v2 → VOICE.md canonical** (`VOICE.md`, vocabulary, baseline, gate). Already locked/approved by Matt; records live state. Risk ZERO.
- **Unit 8 — Render-worker + script infra** (`scripts/render-worker.mjs`, `scripts/ultracode-audit.sh`). launchd plist stays unloaded by design; staged iMessage notify stays staged. SAFE-AUTONOMOUS. Risk LOW.
- **Unit 9 — Docs + handoffs** (this file, tools/skills inventory, brand-voice exemplars, experience/tools docs). Fix the stale `project_heath_lp_charts.md` claim here. SAFE-AUTONOMOUS. Risk LOW.

**Hold for Matt:**
- **Unit 0 (pre-flight, gates Unit 5 ONLY) — Resolve 3D-tiles + parity.json architecture.** Decide: (a) CSP for the trails viewer + a poster-first homepage island vs a full 3D hero, (b) is `homepage-v7-cinematic/parity.json` dead, (c) does G6 enforce all three parity surfaces or only v6. NEEDS-MATT.
- **Unit 5 — Homepage V6 rebuild + CSP** (`app/page.tsx`, `app/globals.css` +1105 unreviewed, `next.config.ts`, V6 parity + components). Depends on Unit 0. NEEDS-MATT (major surface + unresolved arch). Risk HIGH.
- **Unit 10 (separate session) — Schedule the 3 funnel-critical crons** (`vercel.json`: meta-ads, google-ads + 3 env vars, GSC ingestor not yet built). Do NOT bulk-revive all 27 dead crons. NEEDS-MATT (changes prod spend recording; a targeted exception to the loop-stop, not a loop restart). Risk MEDIUM.

---

## 7. EXTERNAL BLOCKERS

- **Twilio A2P 10DLC** — campaign `CMb1d8153a...` IN_PROGRESS under carrier review (~2-3 weeks; brand APPROVED; error 30034 on all outbound; ticket #27497858; expected clear ~2026-06-26 to 07-03). Auto-unblocks all SMS on VERIFIED. The only lever is the support ticket. The number to port/operate is **541.703.3095** (FUB-tracked bio number).
- **Anthropic API credits** — EXHAUSTED. Blocks producer-runtime (stale since 2026-05-24), 4 queued expired CMAs, and the market-report blog publish. Resolves when Matt adds credits at console.anthropic.com.
- **Apify** — currently under the **$200 cap**; graceful-degrades if hit. Cap resets ~the 18th; monitor.

---

## 8. SINGLE RECOMMENDED FIRST ACTION

**Run the Unit 1 tsc/trail fix and land it.** Purge the stale cache and confirm the baseline, then clear the G16 drift, then commit the three files together:

```
rm -rf .next && npx tsc --noEmit          # confirm clean (errors were stale .next manifest entries, not code)
npm run ci:commit-compiles                 # G46 PASS
npm run ci:data-access -- --refresh         # regenerate DAL_INDEX.md + DATABASE_SCHEMA_SNAPSHOT.md (clears G16)
# commit: lib/data/index.ts, docs/DAL_INDEX.md, docs/DATABASE_SCHEMA_SNAPSHOT.md
```

Nothing in the audit is more urgent for *unblocking the build*: every other commit's `ci:commit-compiles` depends on this clean tsc baseline, and G16 is failing right now. The genuine production blockers (Twilio A2P, Anthropic credits) are external and cannot be moved by code this session. Immediately after Unit 1, land Unit 6 (staging-host gate) so commits stop failing sitewide.
