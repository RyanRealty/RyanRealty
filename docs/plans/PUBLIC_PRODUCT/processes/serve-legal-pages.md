# Process: serve-legal-pages — Serve static legal/policy pages

## 0. Meta

- Status: deepened
- Cadence: event-driven (visitor-triggered render; content edits are rare — "Last updated" stamps range Mar 2026 to Jun 2, 2026 across the seven pages)
- Verdict (PROPOSAL, not a lock): **KEEP** — these surfaces are legally mandatory and their URLs are pinned by external systems (A2P carrier campaign copy, OAuth consent screens, Meta/Google app data-deletion configuration); the process cannot be killed or merged away. The defect list in §10 (orphaned routes, sitemap/noindex contradiction, untracked mailto completion, split contact-email fallbacks) is P4/P9 repair work inside a KEEP, not a reason to restructure the process.
- Last evidence pass: 2026-08-11 (every file:line below opened this run)

## 1. Purpose

(a) A visitor — or an external reviewer acting on visitors' behalf (carrier trust-and-safety, platform app review, a HUD intake officer) — gets the definitive answer to a trust, rights, or compliance question: what Ryan Realty collects, what governs use of the site and its MLS data, how to opt out, and the exact channel to file a deletion, copyright, accessibility, or fair-housing request. (b) The machine outcome is that every capture step of the lead machine stays lawful and switched on: the carrier-verified SMS consent sentence on every lead form is checked word-for-word against the live /privacy and /terms pages (components/site/SmsConsentDisclosure.tsx:7-24), OAuth sign-in and Meta/Google app standing require working /privacy and /data-deletion URLs (app/data-deletion/page.tsx:64-79), and the consent banner whose choices gate the analytics/marketing trackers links to /privacy for its full terms (components/CookieConsentBanner.tsx:176-178) — so fully serving (a) is what licenses every other process in this registry to capture anything at all.

## 2. Inception (what starts it)

Trigger: a visitor opens one of seven static policy routes. Entry channels, in observed order of wiring strength:

1. **Internal — footer legal row (site-wide).** `LEGAL_LINKS` (lib/site-nav.ts:389-396) renders in SiteFooter (import at components/site/SiteFooter.tsx:12, render loop at :138-153). The row carries /privacy, /terms, /accessibility, /fair-housing, /dmca (+ /site-index, which belongs to `earn-search-traffic`, not this process). **/cookies and /data-deletion are NOT in the row.**
2. **Internal — form fine print at the moment of consent.** The A2P SMS consent checkbox links /privacy and /terms (components/site/SmsConsentDisclosure.tsx:81,85) and is mounted on 20+ capture surfaces (contact form, valuation forms, every /lp/* form, broker pages, listing CTAs — grep this run). SignupForm links /terms and /privacy (components/auth/SignupForm.tsx:157-158). The cookie banner links /privacy and /privacy#donotsell (components/CookieConsentBanner.tsx:176,178; mounted globally via components/site/providers/RootProvider.tsx:41, hidden on /lp/* per :20). The CMA register gate emits Privacy · Terms links in its HTML shell (lib/cma/register-gate.ts:116).
3. **Internal — LP-local legal rows.** /lp/* pages hide global chrome and hand-roll their own links: app/lp/fsbo/page.tsx:441, app/lp/sell-your-home/page.tsx:514, app/lp/seller-home-value/page.tsx:578 (privacy), app/lp/tetherow/heath/page.tsx:1092-1094 (privacy, fair-housing, terms).
4. **Internal — /privacy body prose** is the ONLY inbound link to /cookies (app/privacy/page.tsx:39,98).
5. **External — compliance references.** /data-deletion has ZERO internal inbound links (repo grep this run: only its own metadata self-references at app/data-deletion/page.tsx:14,18) — it exists to satisfy the Meta/Google app data-deletion-URL requirement, and its body walks Facebook/Google access-revoke paths (app/data-deletion/page.tsx:64-79). /privacy is the URL named on OAuth consent screens and read by A2P carrier review. /fair-housing serves HUD-complaint context (app/fair-housing/page.tsx:59-74). /dmca serves copyright claimants arriving from anywhere.

Preconditions: none — all seven pages are public, unauthenticated, data-free server components. Crawlers can reach them (app/robots.ts:21-27 — the `*` rule's disallow list at :26 covers no legal path), which is what lets the `noindex, follow` meta actually be honored.

## 3. Actors

- **Visitor segments:** all segments touch these pages rarely; the distinct personas are (1) the privacy-conscious visitor mid-form (arriving from fine print), (2) the rights-exerciser (deletion, do-not-sell, CCPA/OCPA), (3) the claimant (DMCA, accessibility barrier, fair-housing complaint), (4) the non-visitor reviewer — carrier trust-and-safety verifying the A2P consent sentence, Meta/Google app review verifying the deletion URL. Device reality from GA4 for these routes was **not queried this pass** — a stated gap, not a number.
- **Automated actors:** none. No cron touches these pages (vercel.json grep for legal/privacy/dmca: zero hits this run). Global trackers run on them like any page (VisitTrackerWithSession + GlobalIntentTracker via components/layout/PublicClientLayer.tsx:56-57, mounted app/layout.tsx:166; page-view analytics consent-gated per components/PageViewTracker.tsx:5).
- **Accountable for completion:** Matt (licensed principal broker — license 201206613, lib/brand/contact.ts:122) owns policy-content accuracy; the admin@ryan-realty.com mailbox owner owns the request-path SLAs the pages promise (30-day deletion, app/data-deletion/page.tsx:59; 45-day rights response, app/privacy/page.tsx:113,120).

## 4. Systems of record

- **Policy text:** the git repo itself — the copy is hardcoded in the seven `app/*/page.tsx` files. No CMS, no DB table holds policy content.
- **Cookie inventory:** the hardcoded `COOKIES` array (app/cookies/page.tsx:38-103, nine rows: sb-*, ryan_realty_cookie_consent, fub_cid, rr_session_id, ryan_realty_visit_id, rr_agent_attribution, _ga/_ga_*, _fbp, _fbc). This is a hand-maintained claim about what the codebase sets elsewhere — a drift-prone SoR (§10).
- **Consent state:** the `ryan_realty_cookie_consent` first-party cookie, 1-year expiry (components/CookieConsentBanner.tsx:17,46-50) — the page describes it; the banner owns it.
- **SMS consent sentence:** lib/crm/sms-consent-text (single server-safe source re-exported by components/site/SmsConsentDisclosure.tsx:28-29), locked in step with the Twilio A2P campaign and two gate scripts (docblock :7-24). The /privacy and /terms SMS sections must stay consistent with it.
- **Deletion and DMCA requests:** the admin@ryan-realty.com mailbox — off-platform. Explicitly NOT a SoR on our side: no `legal_requests` table, no ticket, no CRM write exists for either request path (repo grep this run found none).
- **NOT SoR:** these pages are not the source of ODS/IDX display compliance (that is sibling process `ods-idx-attribution`, enforced by G54) and /site-index is not theirs (belongs to `earn-search-traffic`).

## 5. End-to-end path (inception → completion)

1. **Arrive** · visitor · clicks a footer legal link, a form fine-print link, an LP footer link, or an external compliance reference · input: the URL · output: request for a static route · system: Next static prerender (all seven are data-free server components; /cookies and /data-deletion self-declare `@data-free` `@no-parity` at app/cookies/page.tsx:5 and app/data-deletion/page.tsx:1-2) · failure: none observed (no data fetch to fail) · device: any.
2. **Render** · system · serves the page with `robots: 'noindex, follow'` and a canonical URL (metadata blocks: app/privacy/page.tsx:10-23, app/terms/page.tsx:9-22, app/cookies/page.tsx:10-23, app/dmca/page.tsx:10-23, app/fair-housing/page.tsx:12-25, app/accessibility/page.tsx:10-23, app/data-deletion/page.tsx:11-24) · output: full policy text, H1/H2 via `components/site/primitives` (each page's imports, e.g. app/privacy/page.tsx:2), SiteFooter mounted at page bottom (e.g. app/privacy/page.tsx:185) · failure: none · device: any.
3. **Read / anchor-jump** · visitor · scans to the section answering their question, including deep anchors other surfaces target: `#sms` (app/privacy/page.tsx:68, app/terms/page.tsx:129), `#donotsell` (app/privacy/page.tsx:131 — linked from the banner at components/CookieConsentBanner.tsx:178 and from /cookies at app/cookies/page.tsx:172) · output: the answer, in place · failure: the answer is missing or stale (policy drift — §10) · device: any.
4. **Cross-navigate the policy set** · visitor · follows body links: /privacy→/cookies (app/privacy/page.tsx:39,98), /cookies→/privacy and /privacy#donotsell (app/cookies/page.tsx:114,172), /terms→/privacy#sms (app/terms/page.tsx:139), /data-deletion→/privacy (app/data-deletion/page.tsx:98) · failure: /cookies is unreachable for a visitor who starts anywhere but /privacy (§10) · device: any.
5. **Act — branch by page** (the terminal step; see §6 for the branch logic):
   - *Informational close* (privacy, terms, cookies, fair-housing read-only visits): visitor closes or exits via footer/back-to-home links (app/dmca/page.tsx:77, app/fair-housing/page.tsx:86, app/accessibility/page.tsx:76) · side effect on our side: page-view telemetry only.
   - *Cookie control:* visitor re-opens the banner or clears the consent cookie as the page instructs (app/cookies/page.tsx:154-177) · side effect: consent cookie rewritten by the banner (components/CookieConsentBanner.tsx:46-50).
   - *Rights/deletion request:* visitor sends the prescribed email — deletion with subject "Delete my data" (app/data-deletion/page.tsx:53-60), do-not-sell with subject "Do Not Sell or Share" (app/privacy/page.tsx:137), general rights (app/privacy/page.tsx:144) · system: **mailto only — the request leaves our observable plane** · failure: no on-site confirmation, no tracking, SLA unenforceable by any mechanism in the repo.
   - *DMCA notice/counter-notice:* claimant emails the designated agent (app/dmca/page.tsx:34-41; notice elements :44-58; counter-notice :62-66) · same mailto blindness.
   - *Accessibility barrier report:* visitor emails the address at app/accessibility/page.tsx:55-65 · same, plus this page's fallback address differs (§10).
   - *Fair-housing complaint:* the action is deliberately OFF-site — HUD link + 1-800-669-9777 (app/fair-housing/page.tsx:9-10,59-74). Correct by design: the complaint channel must be the regulator, not the brokerage.

## 6. Decision points

- **Which obligation → which page:** data handling → /privacy; site/MLS-data use → /terms; cookie detail → /cookies; copyright → /dmca; discrimination → /fair-housing (routes OUT to HUD by design); barriers → /accessibility; account/data erasure → /data-deletion.
- **Consent branch:** the banner links here, but the choice itself is made in the banner, not on the page — decline-path is honored by consent-gated trackers (components/PageViewTracker.tsx:5; components/VisitTracker.tsx:6).
- **Compliance gates that bind this process:** voice canon applies — these are public pages (CLAUDE.md §2; the SMS consent sentence is explicitly exempt compliance language per components/site/SmsConsentDisclosure.tsx:22-23). The A2P lock-step is a hard gate: the consent sentence may not be reworded without updating three lock-step copies and re-submitting the carrier campaign (SmsConsentDisclosure.tsx:13-17), and the /privacy:74 + /terms:138 "No mobile information will be shared…" sentences are part of what carriers verify. §0 data accuracy: these pages carry no market stats — the only "numbers" are legal commitments (30-day, 45-day, license number), each of which is a promise Matt owns, not a queried stat. ODS/IDX attribution is NOT decided here (sibling process, G54).

## 7. Completion

- **Done-when (observable on our side):** the policy page rendered with the correct canonical + noindex meta and the visitor's question is answerable on-page — for informational visits that render IS completion. For the cookie-control branch: the consent cookie reflects the new choice.
- **Done-when (NOT observable on our side):** deletion, do-not-sell, DMCA, and accessibility requests complete off-platform in the admin@ mailbox; fair-housing complaints complete at HUD. The registry row's finding stands after deepening: **no on-site form, ticket, or tracking exists for any request path** — the mailto is the terminal artifact.
- **Artifacts at completion:** none on-platform beyond consent-gated page-view telemetry rows (visitor plane via PublicClientLayer trackers) and, for cookie control, the rewritten `ryan_realty_cookie_consent` cookie.
- **Terminal states:** answered-and-left · consent-updated · request-emailed (unobserved) · complaint-routed-to-HUD (unobserved, by design).

## 8. Time & performance

- **Time-to-answer budget:** first paint = the answer's container; the page-level question ("what do you collect", "how do I delete") must be resolvable within one scan of the H2 skeleton or one anchor jump — all seven pages are single-column, max-w-2xl, heading-per-obligation documents, so the structural budget is met by construction. The request-path answer (the email address) sits one heading deep on every request page (app/dmca/page.tsx:34-41; app/data-deletion/page.tsx:53-60; app/accessibility/page.tsx:55-65).
- **CWV reality:** all seven are data-free static prerenders with no DAL touch and no page-specific client JS — the only JS cost is the global chrome. Route-level field CWV for these URLs was **not queried this pass** (gap; the site-wide web-vitals pipeline exists per app/layout.tsx:151 comment).
- **What "slow" means and who sees it:** slowness here would be global-bundle cost, borne by a mobile visitor tapping fine print mid-form — the one moment a lag can spook a lead out of completing a capture form. That risk lives in the chrome, not in these pages.

## 9. Variants

One process, four entry variants sharing an identical serve path: (1) footer row, (2) mid-form fine print (the consent-moment reader), (3) LP-local legal rows (chrome-hidden pages), (4) external compliance reference (the reviewer/claimant who never browses the site). No split is warranted — the render path, content SoR, and completion classes are byte-identical across variants; only inbound linkage differs. Boundary confirmations from deepening: /site-index is `earn-search-traffic`'s (footer row co-tenancy is incidental); ODS/IDX display compliance is `ods-idx-attribution` (split 3 of 3 from the serve-legal hypothesis); the SMS consent checkbox itself belongs to the capture processes — this process only owns the policy text the checkbox points at.

## 10. Current implementation map

- **Routes today:** /privacy (app/privacy/page.tsx:30), /terms (app/terms/page.tsx:24), /cookies (app/cookies/page.tsx:105), /dmca (app/dmca/page.tsx:25), /fair-housing (app/fair-housing/page.tsx:27), /accessibility (app/accessibility/page.tsx:25), /data-deletion (app/data-deletion/page.tsx:31).
- **Registers used:** `components/site/primitives` (H1/H2/Link primitives; e.g. app/privacy/page.tsx:2, app/terms/page.tsx:3) + legacy-flat SiteFooter (each page mounts it, e.g. app/cookies/page.tsx:191) + one bespoke legal component, EqualHousing (components/legal/EqualHousing.tsx:23-40; imported app/fair-housing/page.tsx:3). No kb, no explore. Behavior fact only — carries no naming/grouping authority under amnesia.
- **Actions/API/crons:** none. Zero server actions, zero API routes, zero crons belong to this process.
- **Known defects (each verified this run):**
  1. **/cookies orphaned from the footer set** — LEGAL_LINKS (lib/site-nav.ts:389-396) omits it; only /privacy prose reaches it (app/privacy/page.tsx:39,98).
  2. **/data-deletion fully orphaned internally** — zero inbound links repo-wide (grep this run; only self-metadata at app/data-deletion/page.tsx:14,18). Deliberate for platform compliance, but an on-site visitor wanting deletion cannot find the page.
  3. **Sitemap/noindex contradiction** — app/sitemap.ts:158-162 emits /privacy, /terms, /accessibility, /fair-housing, /dmca (priority 0.3) while all seven pages declare `noindex, follow`; /cookies and /data-deletion are the two NOT emitted. Whichever policy is right, the current state is internally inconsistent both ways.
  4. **Untracked mailto completion** — deletion (30-day promise, app/data-deletion/page.tsx:59), do-not-sell (app/privacy/page.tsx:137), rights (45-day promises, app/privacy/page.tsx:113,120), DMCA (app/dmca/page.tsx:39), and accessibility reports all terminate in a bare mailto. No mechanism in the repo can prove an SLA was met.
  5. **Split contact-email fallbacks** — /accessibility defaults to `info@ryan-realty.com` (app/accessibility/page.tsx:8) while privacy/cookies/dmca/data-deletion default to `admin@ryan-realty.com` (app/privacy/page.tsx:8, app/cookies/page.tsx:8, app/dmca/page.tsx:8, app/data-deletion/page.tsx:8). If `NEXT_PUBLIC_SITE_OWNER_EMAIL` is unset in prod (env value not verified this pass), requests split across two mailboxes.
  6. **Hand-maintained cookie inventory** — the COOKIES array (app/cookies/page.tsx:38-103) is a claim about cookies set elsewhere in the codebase with no gate tying the list to reality; silent drift is a compliance misstatement.
  7. **Duplicate LP legal rows** — four /lp/* files hand-roll their own legal links (app/lp/fsbo/page.tsx:441, app/lp/sell-your-home/page.tsx:514, app/lp/seller-home-value/page.tsx:578, app/lp/tetherow/heath/page.tsx:1092-1094) instead of one shared strip; the sets differ (heath carries fair-housing; the others privacy only).
  8. **Accessibility statement lags the program bar** — page claims WCAG 2.1 AA aim (app/accessibility/page.tsx:36) while this program's standards stack is WCAG 2.2 AA (PUBLIC-PRODUCT-OS.md standards stack).
  9. **DMCA designated-agent registration unevidenced** — the page names an email agent (app/dmca/page.tsx:34-41) but no repo artifact evidences the U.S. Copyright Office designated-agent directory registration the DMCA safe harbor requires; an off-repo check, flagged, not asserted either way.
- **Duplicate/parallel paths that should die:** the four LP legal-row implementations (defect 7) — one shared component. No parallel page-level duplicates exist.

## 11. Target shape (process-level, not pixels)

**Should this exist?** Yes — non-optional. The job (derived from the obligations, not from today's routes): give every legal obligation a stable, findable, actionable surface, and give every request path an observable completion.

- **Ideal step count:** unchanged for informational visits (arrive → read → leave is correct; one step). For request paths, the target is arrive → submit **on-site** → confirmed (three steps, all observable) — replacing the current arrive → compose-email-elsewhere → hope.
- **Device:** mobile-first like everything else; these pages are structurally mobile-safe already.
- **URL stability is a protected fact, not shape:** /privacy and /data-deletion are pinned by external systems (A2P campaign review, OAuth consent screens, Meta/Google app config) exactly like SEO-load-bearing URLs — P5 must treat them as un-renamable without an external-config migration, per the same carve-out the constitution grants GSC equity.
- **Data gaps blocking correctness:** no request ledger exists (defect 4) — the 30/45-day promises are unenforceable and unmeasurable until requests land in a store (a `legal_requests`-class table or a CRM-task path) instead of a mailbox; the cookie inventory needs a mechanical tie to the cookies code actually sets (defect 6).
- **Destination implication:** NOT a destination. These pages take the `SYSTEM` sentinel in page-inventory.json — a legal annex reachable from one shared legal strip in whatever chrome P5/P6 lock, never a nav group. The footer set should cover the full seven (or a deliberate P3-recorded decision keeps /data-deletion external-only); /cookies stops being reachable only through prose.
- **Dual objective stamped on these pages:**
  - `visitor_objective`: "Get the definitive answer to a trust, rights, or compliance question about Ryan Realty — and the exact channel to act on it — in one page."
  - `machine_objective`: "Keep every capture surface on the site lawful and operating (carrier, platform, and regulator standing verified against these URLs), and return the visitor to their exploration with trust raised rather than ending the session."
  - `exits`: back to the prior exploration context (the decisions.md north star names legal pages the one tolerated low-exit class — "dead ends (legal aside) are defects" — but three of seven already carry a Back-to-home exit and all should carry a return path); cross-links within the policy set (/privacy ↔ /cookies ↔ /terms anchors); the request channel itself (on-site form target-state, mailto today); HUD (off-site by design, /fair-housing only).

## 12. Acceptance checks

Persist; never delete. Run against prod (https://ryan-realty.com) unless noted.

1. **All seven serve with the right meta** — for each of privacy, terms, cookies, dmca, fair-housing, accessibility, data-deletion:
   `curl -s -o /dev/null -w '%{http_code}' https://ryan-realty.com/<route>` → `200`, and
   `curl -s https://ryan-realty.com/<route> | grep -c 'noindex, follow'` → `≥1`, and the canonical tag equals the route.
2. **Crawlability of noindex pages** — `curl -s https://ryan-realty.com/robots.txt` shows no Disallow covering any of the seven paths (noindex only works on crawlable URLs; source app/robots.ts:21-27).
3. **Internal link integrity of the policy set** — every cross-link resolves 200 with its anchor present: /privacy→/cookies, /cookies→/privacy#donotsell, /terms→/privacy#sms, /data-deletion→/privacy; `curl -s https://ryan-realty.com/privacy | grep -c 'id="sms"\|id="donotsell"'` → `2`; `curl -s https://ryan-realty.com/terms | grep -c 'id="sms"'` → `1`.
4. **Footer coverage matches the locked decision** — `grep -A8 'LEGAL_LINKS' lib/site-nav.ts` lists exactly the set P3/P5 lock (today: 5 of 7 + /site-index; target-state: all visitor-reachable legal pages).
5. **A2P lock-step green** — `node scripts/check-sms-consent-compliance.mjs` passes, and the carrier-verified sharing sentence is live on both pages: `curl -s https://ryan-realty.com/privacy | grep -c 'No mobile information will be shared'` → `≥1`, same for /terms.
6. **Brand-voice gate on the seven files** — `npm run ci:brand-voice` green with app/{privacy,terms,cookies,dmca,fair-housing,accessibility,data-deletion}/page.tsx in tree.
7. **Sitemap consistency (post-decision)** — one of the two must hold repo-wide, never a mix: (a) no legal route in app/sitemap.ts, or (b) legal routes emitted AND indexable. Check: `grep -n 'privacy\|/terms\|dmca\|fair-housing\|accessibility\|cookies\|data-deletion' app/sitemap.ts` reconciled against each page's `robots` metadata.
8. **External pins hold** — browser check: Meta app settings' data-deletion URL and the Google OAuth consent screen's privacy URL each load the live page (manual; screenshot the config pages).
9. **Request channel is real** — send a test email to the address rendered on /data-deletion and /dmca (resolve `NEXT_PUBLIC_SITE_OWNER_EMAIL` in prod env first) and confirm receipt in the mailbox; if defect 5 is fixed, both /accessibility and the rest resolve to the SAME address. Target-state upgrade: submit the on-site request form and assert the request row + confirmation render.
10. **Cookie inventory truth** — for each first-party row in the COOKIES array (app/cookies/page.tsx:38-103), a repo grep finds the code that sets it (e.g. `grep -rn 'rr_agent_attribution\|fub_cid\|rr_session_id\|ryan_realty_visit_id\|ryan_realty_cookie_consent' components lib app --include='*.ts*' -l`), and no first-party cookie set in code is missing from the page. Target-state: this becomes a gate script.
