# Handoff — CRM + Lead-Funnel + LP Session (2026-06-12)

**Author:** Claude Code (Opus/Fable session, 2026-06-12)
**Branch:** `main` (single checkout; push-to-origin-immediately workflow)
**Latest relevant commit:** `0a8d8361` (Heath chart mount gate). Note: a PARALLEL session committed TC/sell work on top (`2f354096`, `1663cc33`, `2b1a12fb`, `2741bab6`) — those are NOT this session's and are unrelated.
**Read first:** memories `project_crm_ui_queue`, `project_lead_funnel_audit_2026-06-12`, `project_heath_lp_charts`, `feedback_post_fixes_keep_grinding`.

---

## 1. One-paragraph summary

This session rebuilt the in-house CRM around the broker's daily job, made it phone-native, wired the live-visit "lead is on your site now → text with a deep link → contact them" loop, fixed the A2P/SMS compliance blockers, audited and tightened every ad→LP→lead→CRM pathway, confirmed + fired the expired-listing outreach, and started an investment-grade chart section on the Tetherow Heath LP. Everything is committed, pushed, and deployed. The two things NOT finished: the Heath LP performance chart (concept being redirected, see §6) and a short list of CRM polish items (see §5).

---

## 2. What shipped & is verified live

### CRM — comms & correctness
- **Per-broker HTML email signatures** on every client-facing send (manual + sequence), built live from `public.brokers`, carrying the **Oregon Initial Agency Disclosure Pamphlet** link (`/docs/oregon-initial-agency-disclosure-pamphlet.pdf`, self-hosted OREA PDF) — ORS 696.820 satisfied by construction. Internal alerts stay signature-free. `lib/crm/email-signature.ts`, wired in `lib/crm/gmail.ts` (`withSignature`).
- **Rendered send previews** — email composer shows the exact HTML in a sandboxed iframe; SMS shows a phone bubble + segment count. Merge tokens resolve server-side; unresolved-token warning. `components/admin/crm/EmailComposer.tsx`, `SmsComposer.tsx`, `lib/crm/email-body.ts` (`composeOutboundHtml`/`buildEmailPreviewDoc`).
- **`%custom*%` merge resolution** generalized in `lib/crm/merge.ts` (was hardcoded token list); sequence engine inherits it.
- **Broker attribution on every outbound site link** — `attributeSiteLinks()` appends `?agent=<assigned broker>` to every ryan-realty.com URL in CRM emails/texts (manual + sequence), so the site features that broker when the lead clicks through.
- **Gmail near-twin dedupe** — sync no longer double-logs app-sent emails.
- **A2P / SMS unblock** — `middleware.ts` `COMPLIANCE_VERIFICATION_PATHS` exempts consent pages from the bot screen (carrier reviewers use HTTP-library UAs); `/privacy` got an "SMS and text messaging" section with the carrier-required no-mobile-data-sharing clause; campaign resubmitted via `scripts/crm-a2p-resubmit.mjs` (hardened preflight fetches every cited URL with a python-requests UA). **Status: campaign IN_PROGRESS at carrier review — outbound SMS stays queued until it flips VERIFIED.** Watch: https://console.twilio.com/us1/develop/sms/regulatory-compliance/campaigns

### CRM — UI & mobile
- **Admin nav reworked** by JOB (Today / People / Transactions / Listings / Marketing / Content / System), collapsible w/ lucide icons, localStorage persistence, longest-match highlight. Added previously-unlinked daily pages (Approvals, Hot leads, CMAs, Tasks, New contact). `app/components/admin/admin-nav.ts`, `AdminNavList.tsx`, `AdminNavIcons.tsx`.
- **⌘K command palette** — `AdminCommandPalette.tsx` (every destination + free-text → `/admin/search`).
- **Instant loading skeletons** — `app/admin/(protected)/loading.tsx`.
- **Self-healing error boundary** — `app/admin/error.tsx` auto-reloads on stale-deploy chunk errors.
- **Home dashboard rebuilt** around the broker's lead funnel + needs-attention tiles + newest leads (avatars, semantic stage colors). The old "Super Admin Command Center" (sync/GA4/marketing/site-perf) moved intact to **`/admin/operations`**. `app/admin/(protected)/page.tsx` + `operations/page.tsx`, `getCrmHomeDashboard()`.
- **Global Tasks page** `/admin/crm/tasks` (Overdue/Today/Upcoming, broker filter, one-tap Done). **Manual contact creation** `/admin/crm/new` (FUB events API → mirror → land on person page).
- **Phone-native:** fixed bottom tab bar (`AdminMobileTabBar.tsx`), contacts table → tap cards below `md`, person page comms-first ordering, timeline collapsed past 15, tags behind a toggle.
- **Contacts page:** titled "Contacts", **search-as-you-type** (`ContactsSearch.tsx`), sorted by recent activity, semantic **StageBadge** colors (`StageBadge.tsx`), broker license cards removed.
- **Profile photos** — OAuth (Google/FB) sign-in saves `picture_url` (`saveOauthAvatarByEmail` in `lib/crm/mirror.ts`, called from `app/auth/callback/route.ts`); **backfilled 1,659 contacts from FUB's enrichment**. Shown on person header (large 96px), contacts table + cards, dashboard.
- **Conversation thread** on person page (`ConversationThread.tsx` — texts+emails only, chat bubbles) + **sticky + FAB** (`QuickContactFab.tsx`: Call/Text/Email/Note).

### CRM — the live-visit loop (the headline feature)
When an identified lead is on the site, the assigned broker gets an instant text (iMessage relay now, Twilio when A2P verifies) naming the page + a deep link to `/admin/crm/<id>`, throttled 1/person/day, broker self-visits excluded. The person page opens with an **"On the site right now"** banner + one-tap Call/Text/Email. Built server-side in `app/api/visitors/track/route.ts` → `queueReturnVisitAlert` in `lib/crm/broker-alerts.ts`. (The old client-side return detector was dead; this replaced it. **Verified end-to-end** — a tracked visit queued + relayed a text in ~14s.)

### Owned-home view (prior, still live)
Person page shows the home a lead owns: address, Street View, MLS photo, map, sale history, on-market alert. `lib/data/crm/getOwnedHome.ts`, `lib/crm/owned-home-media.ts`.

### Lead funnel (ad → LP → lead → CRM)
Audited all 7 pathways (seller, list-now, FSBO, expired, buyer, Tetherow Heath, Meta webhook). Gold standard = `app/lp/seller-home-value/actions.ts`. **Fixed two gaps** (`e8e0871a`): Meta seller leads now geocoded inline (were invisible to geo smart lists for 30 min); expired LP now queues a CMA (was the only seller path that didn't). Site-features-the-broker: attributed-broker card on listing pages (`AttributedBrokerCard.client.tsx`).

### Expired-listing pipeline — confirmed + fired
Detection cron works. **Sequence "Expired Recovery (auto)" restructured** (DB): step 0 = expired LP link + "CMA coming in a separate text", step 1 = the CMA link (held until built). **Backfill endpoint** `/api/cron/expired-outreach-backfill?limit=N` (CRON_SECRET) ran for the last 10 → **4 contactable leads queued both texts + CMA requested** (Anna Kilgore, Dana Felice, Zac Ludington, Robert Newby), enrollment `awaiting_broker`. Others: 4 skip-trace-pending, 2 no-phone. **Nothing sends until Matt approves each first touch in `/admin/crm/approvals` AND A2P verifies.**

---

## 3. External blockers (state changes unlock work)
- **A2P campaign IN_PROGRESS** (carrier review). When VERIFIED: queued SMS drain; announce texting live; smoke-test 1 number. Twilio console link above.
- **541.703.3095 number port** — awaiting Twilio approval email (FUB submitted it).
- **Anthropic credits OUT** — blocks the marketing producer-runtime (CMA producer builds, etc.). Smart follow-ups run on-plan via LaunchAgent. The 4 expired CMAs are queued as `content:cma` action rows and build when credits return.

---

## 4. Hard rules honored (keep honoring)
- **§0 data accuracy** — every public number traces to a verified source. On the Heath LP I refused to fabricate golf dues, taxes, a multi-year appreciation curve from 2 points, or land→build "returns."
- **Draft-first** — public-surface commits used `DRAFT_FIRST_OK=1` only under Matt's explicit standing directive; live URLs surfaced for review.
- **Parallel-session integrity** — a second session shares this working tree (TC/sell + HomepageCine* + LP-redesign uncommitted files). ALWAYS pathspec-scope `git add` to your own files. Never `git stash` the whole tree.
- **Suppressions are sacred**, never mass-enroll the historical book (`ENROLLMENT_EPOCH`), never auto-send outside active sequences.

---

## 5. Open CRM polish (from `project_crm_ui_queue`) — next session
1. **Lead identity header (TOP PRIORITY)** — pin photo + name + colored stage + home-ownership one-liner + assigned broker + a **suggested-next-step pill** (priority: suppressed > on-site-now > unanswered inbound > overdue task > due-today > awaiting first-touch approval > no-outbound-7d > caught-up), color-coded, linking to the matching composer anchor. Matt: "I have no idea what lead I'm looking at."
2. Inbox → thread-aware (tap inbound → conversation view → reply inline).
3. Click-to-call w/ logged calls; bulk actions on contacts; template editor UI.
4. **Tetherow Heath funnel outlier** (`app/lp/tetherow/heath/actions.ts`): uses `seller-intent` tag + 30-min deferred mirror; make it match the seller LP (instant `audience:seller` + `autoEnrollByFubId` + `mirrorPersonFromFub`). ~20 LOC.

---

## 6. Heath LP charts — REDIRECTED (read `project_heath_lp_charts`)
- **Shipped & live:** verified stat ribbon (median sale $1,830K, $/sqft $568, DOM 26, sale-to-list 94.1%, active 8) — looks professional.
- **Broken:** the recharts bar chart does not paint live (`.recharts-surface` = 0). Two tangled causes: `fetchRecentTetherowClosings` may return <2 to the component despite 44 closings in DB (verify `getListingTiles({subdivision:'Tetherow',status:'closed',propertyType:'A',closedFromDate})`), and a recharts App-Router 0×0 measure issue (mount gate added, still 0 — may be ISR/edge cache).
- **Matt's redirect:** the section reads like a MARKET REPORT; he wants **"how a home performs as an asset over time"** = repeat-sales appreciation (bought $X → worth $Y → Z%/yr). **Data validated** (Tetherow homes resold: 5900 59th $139,900'97→$885,000'26). **§0 LANDMINE:** raw pairs conflate land→build & rebuilds (e.g. $46K→$673K is land+construction, NOT appreciation) — must screen to true arms-length same-home pairs. Build CAREFULLY, fresh context.
- **SEO:** metadata/JSON-LD good; URL `/lp/tetherow/heath` is the weak spot — move to `/communities/tetherow/heath` + 301 to rank. robots allows /lp; page is index:true.
- **Also deferred:** golf-dues/tax cost-of-ownership panel (needs Matt's verified figures or Deschutes assessed-value compute); templatize the section across resort LPs.

---

## 7. Key files touched (quick map)
- CRM actions/data: `app/actions/crm.ts`, `lib/crm/{merge,mirror,gmail,email-signature,email-body,broker-alerts,suppressions}.ts`, `lib/data/crm/getOwnedHome.ts`
- Admin shell: `app/admin/(protected)/{layout,page,operations/page}.tsx`, `app/components/admin/*`, `components/admin/crm/*`
- Person page: `app/admin/(protected)/crm/[id]/page.tsx`; lists/tasks/new: `app/admin/(protected)/crm/{page,tasks,new}/page.tsx`
- Funnel: `app/api/meta/lead-webhook/route.ts`, `app/lp/expired-listing/actions.ts`, `app/api/cron/expired-outreach-backfill/route.ts`, `components/site/AttributedBrokerCard.client.tsx`
- LP charts: `app/lp/tetherow/heath/page.tsx`, `app/lp/tetherow/heath/_components/HeathPerformanceCharts.client.tsx`
- Compliance: `middleware.ts`, `app/privacy/page.tsx`, `scripts/crm-a2p-resubmit.mjs`
- Battery: `scripts/crm-e2e-verify.mjs` (run `node scripts/crm-e2e-verify.mjs` to health-check production)

---

## 8. How to verify it's all healthy
```bash
node scripts/crm-e2e-verify.mjs   # ~30 checks against production
```
Last green run this session: 32 pass / 0 fail (warns = A2P-in-review + Anthropic-credits, both expected externals).
