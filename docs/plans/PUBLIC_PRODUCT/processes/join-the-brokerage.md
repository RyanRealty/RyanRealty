# Process: join-the-brokerage — Broker recruiting funnel (/join)

## 0. Meta

- Status: **deepened**
- Cadence: **rare** (registry claim; unmeasured this session — no analytics pulled, and the
  page's own CTAs carry no click events, so the true rate is currently unknowable from our
  data without the §12.8 telemetry query)
- Verdict: **PROPOSAL (not a lock — P3 decides): KEEP** — the recruit is a distinct visitor
  persona no other process serves (a licensed agent evaluating a workplace, not a consumer
  lead), and brokerage growth is a first-order business outcome where one completion is worth
  an entire book of business. NOT a merge into `contact-form-inquiry`: that process is only
  this one's completion leg, while the substance here — the listing-support pitch, the
  how-the-brokerage-works model, the split conversation — exists nowhere else. The KEEP
  carries a hard condition for P4/P5: the completion handoff is broken today (§10 D1 — the
  recruit's intent cannot round-trip and the recruit is captured as a consumer *buyer* lead
  and pointed at the buyer drip), so the machine side of this process effectively does not
  exist yet.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

A licensed (or soon-to-be-licensed) Central Oregon broker learns exactly what this brokerage
does for their listings and their business — production handled, pricing from live data,
principal-broker supervision, a split set in conversation — enough to decide to start that
conversation. Serving that fully advances the recruit-conversation-started machine step:
a convinced recruit reaches Matt in writing or by phone carrying their recruit intent, which
should create an identified, recruit-tagged contact rather than a consumer lead.

## 2. Inception (what starts it)

**Trigger:** a broker curious about the brokerage as a workplace opens `/join`. No
preconditions — entry is anonymous, no params are read (the page component takes no
searchParams; full read of `app/join/page.tsx:203-208` — the only input is the surface-image
resolve).

**Entry channels + routes (evidence):**

1. **Internal navigation** — the About group of the top nav (`lib/site-nav.ts:167`), the
   About column of every footer variant (`lib/site-nav.ts:252,325,384`), and the Connect
   group of the mega menu (`lib/site-menu.ts:319`), all labeled "Join the team". Because the
   KB footer renders `KB_FOOTER_COLUMNS` (`components/site/kb/KbFooter.client.tsx:9,89`),
   the link is present on effectively every public page.
2. **Organic search** — `/join` is sitemapped at priority 0.5 / monthly
   (`app/sitemap.ts:157`) with its own metadata, canonical via `pageMetadata`
   (`app/join/page.tsx:49-61`; canonical construction `lib/site/page-metadata.ts:86,97`),
   recruiting-intent keywords ("real estate broker jobs Bend Oregon", "Bend real estate
   careers" — `page.tsx:55-60`), and WebPage + BreadcrumbList + FAQPage JSON-LD
   (`page.tsx:214-235`). GSC impression/click evidence for these queries: **not pulled this
   session — gap** (§11).
3. **Direct / word of mouth** — the realistic primary channel for a rare, high-context
   decision (a broker told about the brokerage types the URL or is sent the link). No
   attribution machinery distinguishes this; unmeasured.
4. **Paid / social** — none found: no `/lp/*` recruiting landing path exists and no campaign
   links to `/join` (inbound-link sweep of `app`, `components`, `lib` this session found
   only the nav/menu rows above).

**NOT this process:** consumer contact of any kind (`contact-form-inquiry`); the trust
surfaces `/team`, `/about`, `/reviews` (they feed this process as proof but belong to
`contact-a-broker`); `/sell#marketing-plan` (the recruit is sent there as evidence of the
marketing engine — `plan-a-sale` owns the surface).

## 3. Actors

- **Visitor segment:** licensed Oregon brokers (producing agents with a book, and new
  licensees — the FAQ explicitly serves both, `app/join/page.tsx:110-113`) evaluating
  Ryan Realty as a workplace. The page's own copy models them as intelligent professionals:
  no smallness positioning, no invented split, no production figures (doc-comment contract,
  `page.tsx:26-31`). Device reality from GA4: **not pulled this session — gap** (§11).
- **Automated actors:** ISR revalidation every 3600s (`page.tsx:47`); the
  `KbSectionTracker` telemetry client, which fires `section_view` at 55% visibility per
  section plus scroll-depth milestones, dual-sinked to GA4/Pixel and to
  `/api/visitors/track` (`components/site/kb/KbSectionTracker.client.tsx:33,46-49,7-16`;
  the route inserts into `visitor_events`, `app/api/visitors/track/route.ts:403-404`). No
  cron touches this process (`vercel.json` registers none for it — the downstream CRM crons
  belong to `contact-form-inquiry`).
- **Accountable for completion:** Matt — the page promises "the first conversation is with a
  broker, not a recruiter" (`page.tsx:411-413`, FAQ `page.tsx:135-138`) and names Matt as
  the principal broker on every file (`page.tsx:90-92`); the direct line offered is
  `CONTACT.phoneDirect` (`page.tsx:418-420`; values `lib/brand/contact.ts:81-82`). If the
  written path is used, lead routing's seeded default assigns matt
  (per `contact-form-inquiry` §3 — that process's accountability applies from the handoff
  onward).

## 4. Systems of record

This process is a read-and-persuade surface: it persists nothing of its own. Its artifacts:

| Artifact | SoR | Evidence |
|---|---|---|
| The pitch (cards, model blocks, FAQ, CTAs) | hardcoded constants in the route file | `app/join/page.tsx:65-139` (LISTING_SUPPORT, HOW_IT_WORKS, FAQ_ITEMS) — no CMS read; the only DAL call is the hero image |
| Hero photograph | `public.asset_library` (approved, A/B vision-grade, `surface_tags` hero) via `getSurfaceImage`, seeded by `/join`, falling back to the static office-interior file | `lib/data/media/getSurfaceImages.ts:1-38` (query + grade gate); call `app/join/page.tsx:204-208`; fallback `page.tsx:63` |
| Contact identity (phone) | `lib/brand/contact.ts` | `:81-82` (`phoneDirect` / `phoneDirectTel`) |
| Section-view / scroll telemetry | `public.visitor_events` | `docs/DATABASE_SCHEMA_SNAPSHOT.md:4914`; write path `app/api/visitors/track/route.ts:403-404` |
| The recruit lead, once the written completion leg fires | `public.crm_people` — owned by `contact-form-inquiry` from the handoff onward | boundary; see that PDS §4 |

**Explicitly NOT a SoR:** the route file's doc comment (it describes the PRIOR build's CTA
labels, which have since drifted — §10 D5); the FAQ JSON-LD (a projection of FAQ_ITEMS,
`page.tsx:235`); any store of "who was recruited" — none exists anywhere (§10 D2).

## 5. End-to-end path (inception → completion)

1. **Land** · visitor · opens `/join` from any §2 channel · input: URL only · output: the
   ISR-cached page (revalidate 3600, `app/join/page.tsx:47`) with a resolved hero photo
   (`page.tsx:204-208`) · system: one DAL read (`getSurfaceImage`, resilient-cached,
   `lib/data/media/getSurfaceImages.ts:17-19`) · failure: a DAL blip serves the static
   office fallback (`page.tsx:63,207`) — the page never blanks · device: both.
2. **Absorb the hook** · visitor · reads the hero: "Film, 3D tour, / weekly report" + the
   lede ("On every listing you bring… You keep the client from first call to close.") ·
   input: KbHero with all market data nulled — the HUD row degrades to the lead line with no
   invented figures (`page.tsx:250-258`; degrade path
   `components/site/kb/KbHero.client.tsx:48-54,257-264`) · side effect: hero
   `section_view` telemetry (§3) · failure: none — no data dependency · device: both.
3. **Orient via the CTA row** · visitor · three doors at `#join-cta`: "Talk about joining"
   → `/contact?inquiry=Join%20the%20team`, "Listing marketing plan" → `/sell#marketing-plan`,
   "Broker profiles" → `/team` (`page.tsx:261-283`) · output: either an immediate
   completion jump (step 8) or a proof detour (step 6) · failure: the joining link's
   `inquiry` value cannot round-trip (§10 D1) · device: both.
4. **Evaluate the listing support** · visitor · the four LISTING_SUPPORT cards (film/3D/
   photos in 48h · CMA from live MLS data · own page + syndication · weekly written seller
   report) at `#listing-support` (`page.tsx:65-82,288-318`) · failure: none — constant
   array, always four cards · device: both.
5. **Evaluate the model** · visitor · the four HOW_IT_WORKS blocks at `#how-it-works`
   (keep the client · principal broker on every file · Central Oregon is the whole map ·
   the split is set with you), with the `/housing-market` proof link rendered inline in
   block three (`page.tsx:84-106,324-373`) · side effect: possible exit to the market-data
   proof (`explore-market-knowledge`) · failure: none · device: both.
6. **(Detour) Verify the proof** · visitor · `/sell#marketing-plan` shows the actual seller
   marketing plan; `/team` shows who they would work beside; `/housing-market` shows the
   data they would price from (`page.tsx:267-280,349-364`) · output: returns via nav/back,
   or is lost to the detour — nothing invites them back to `/join` from those consumer
   surfaces (§10 D6) · device: both.
7. **Resolve objections** · visitor · six-item FAQ as a native `<dl>` at `#faq` (new
   licensees, current pipeline, the split, marketing production, geography, how to start —
   `page.tsx:108-139,429-452`), mirrored once as FAQPage JSON-LD (`page.tsx:235`) ·
   failure: none · device: both.
8. **Start the conversation — written leg** · visitor · "Talk about joining" (`page.tsx:264`)
   or "Send a note" in the `#get-in-touch` band (`page.tsx:415`) → `/contact?inquiry=Join%20
   the%20team` · output: the contact page reads `?inquiry` as the select default
   (`app/contact/page.tsx:79-81`), but `'Join the team'` is not in `INQUIRY_OPTIONS`
   (`app/contact/ContactForm.tsx:19-25`) and is handed to the Select as an unlisted
   `defaultValue` (`ContactForm.tsx:136`) · failure: **the recruit's intent is lost at the
   boundary** — whatever the Select submits, the server defaults a missing `inquiryType` to
   `'General Inquiry'` (`app/contact/actions.ts:36`) and `inferAudience` maps any
   non-seller-keyword string to `buyer` (`actions.ts:25-29`), so the recruit is captured as
   an `audience:buyer` consumer lead eligible for the buyer master sequence
   (`lib/crm/enroll.ts:27-32`, buyer rule `:31`) — §10 D1 · device: both.
9. **Start the conversation — phone leg** · visitor · taps "Call 541.703.3095"
   (`page.tsx:418-420`; number `lib/brand/contact.ts:81-82`) · output: a phone call to
   Matt's direct line · system: none — a bare `tel:` anchor with no click event and no
   tracking (§10 D3); the call itself completes inside `broker-direct-call-text` · failure:
   desktop taps dead-end where no telephony app exists · device: mobile-real, desktop-weak.
10. **Completion** · Matt · takes the call or reads the note and has the split/support
    conversation ("There is no script", `page.tsx:411-413`) · artifacts: §7 · failure: on
    the written leg the note arrives as a mislabeled consumer inquiry the broker must
    recognize by reading the message body — nothing marks it as recruiting (§10 D1/D2).

## 6. Decision points

- **Which completion leg** — write vs call vs keep reading: the page offers the written CTA
  twice (`app/join/page.tsx:264,415`) and the phone once (`page.tsx:418-420`); nothing
  gates either. The three proof detours (`/sell#marketing-plan`, `/team`,
  `/housing-market`) are deliberate exits that postpone completion.
- **§0 data-accuracy posture (a designed-in gate):** the page renders **zero numbers** — no
  closing counts, no agent count, no invented split, no production figures; the split is
  framed as a conversation, never a figure (doc-comment contract `page.tsx:26-31`; enforced
  in copy at `page.tsx:103-105,120-123`; hero HUD nulled `page.tsx:251`). Every claim on
  the page is a process fact (48-hour production, weekly report) already made to consumers
  on `/sell` — cross-surface consistency is the check, not a SQL trace.
- **Voice canon:** recruit-facing copy runs the same brand-voice gate as all public text
  (CLAUDE.md §2/§6, `ci:brand-voice` at commit); the page additionally bans smallness
  positioning per its own contract (`page.tsx:26-28`).
- **Fair housing / ODS-IDX / Coming-Soon:** n/a — no listing data, no MLS-derived content,
  no consumer real-estate advertising renders on this page (full read this session).
- **Downstream compliance branches** (SMS consent fail-closed, suppression checks,
  enrollment gates) belong to `contact-form-inquiry` §6 once the written leg crosses the
  boundary — with the D1 caveat that the recruit enters them mislabeled.

## 7. Completion

**Done-when (observable):** the recruit has started the conversation — EITHER a
`/contact` submission originating from the join handoff exists as a `crm_people` row (today:
observable only by reading the message body or the origin note's inquiry field, since no
recruit tag exists — §10 D2) OR a call was placed to the direct line (today: not observable
in any system — §10 D3).

**Artifacts at completion:** the conversation itself (Matt's phone or inbox); on the written
leg, whatever `contact-form-inquiry` produces — a `crm_people` row, broker notification
email, and (defectively, for a recruit) consumer tagging + possible buyer-sequence
enrollment (§5.8).

**Terminal states:** conversation started (success); silent exit after reading (no capture
of any kind — the page has no low-commitment capture, so "interested but not ready to call"
leaves nothing behind); lost-to-detour (step 6 exits with no return path). **Boundaries:**
everything after the form submit is `contact-form-inquiry`; the call is
`broker-direct-call-text`; hiring/onboarding after the conversation is an admin-plane
process, not a public-site one.

## 8. Time & performance

- **Time-to-answer budget:** the headline pitch (what the brokerage does for your listings)
  is answered in the hero at zero scrolls (`app/join/page.tsx:250-258`). The recruit's real
  first question — the split — is deliberately answered as "set with you, no published
  number," but that answer sits two sections deep (HOW_IT_WORKS block 4, `page.tsx:103-105`)
  and again in the FAQ (`page.tsx:120-123`); a split-hunting recruit scrolls most of the
  page to learn there is no number.
- **Server budget:** ISR at 3600s (`page.tsx:47`) with a single cached DAL read
  (`page.tsx:204-208`) — structurally the cheapest kind of page in the repo; no per-request
  data work.
- **Client weight:** the kb shell loads Lenis smooth-scroll plus GSAP footer animation for
  a static brochure page (`page.tsx:40-45`; `KbFooter.client.tsx` GSAP block) — the same
  structural weight flag raised on `/contact`.
- **Core Web Vitals for `/join`: not measured this session — gap** (§11). "Slow" here would
  be a recruit on a phone waiting through smooth-scroll scaffolding for hardcoded text.

## 9. Variants

One route, no params, one rendered experience — no true variants exist in code.

1. **Producing broker vs new licensee** — served by the same page; the only differentiation
   is FAQ item 1 (`app/join/page.tsx:110-113`). No path divergence.
2. **Write vs call completion** — §5 steps 8/9; a leg choice inside one process, not a
   variant (the pitch consumed is identical).
3. **Entry-channel variants** (nav vs footer vs mega menu vs organic) — no divergence; the
   page reads nothing from the arrival.

No split is warranted; the process is materially one path.

## 10. Current implementation map

**Routes:** `/join` only (metadata + canonical `app/join/page.tsx:49-61` via
`lib/site/page-metadata.ts:86,97`; JSON-LD `page.tsx:214-235`; sitemap `app/sitemap.ts:157`).

**Registers (of the 5 design languages):** kb only — SmoothScrollProvider, KbBreadcrumb,
KbHero, KbFooter, KbSectionTracker, `kb.css` (`page.tsx:40-45`) plus module-scope inline
token styles (`page.tsx:141-201`). No shadcn controls; unusually for a public page, a
single-register surface.

**Actions/API/crons:** none of its own. Telemetry via `/api/visitors/track`
(`KbSectionTracker.client.tsx:16`); completion rides `submitContactForm`
(`app/contact/actions.ts:31`) across the process boundary.

**Known defects (each verified this session):**

- **D1 — the completion handoff destroys the recruit's identity.** Both written CTAs pass
  `?inquiry=Join%20the%20team` (`app/join/page.tsx:264,415`), a value absent from
  `INQUIRY_OPTIONS` (`app/contact/ContactForm.tsx:19-25`) and handed to the Select as an
  unlisted `defaultValue` (`ContactForm.tsx:136`) — what the Radix Select renders/submits
  in that state is untested in a browser this session. Server-side, a missing `inquiryType`
  falls back to `'General Inquiry'` (`app/contact/actions.ts:36`) and `inferAudience` has
  no recruit branch — any non-seller string maps to `buyer` (`actions.ts:25-29`) — so the
  recruit becomes `audience:buyer` + `buyer:nurture` and, if the enrollment gates pass, is
  enrolled in the buyer master sequence built for home shoppers (`lib/crm/enroll.ts:27-32`,
  buyer rule `:31`). A licensed-agent job applicant receiving consumer home-buyer drip is
  the machine working against the visitor.
- **D2 — recruiting is invisible to the machine.** No recruit tag, source, or audience
  exists anywhere in the capture path (grep of `app/contact/actions.ts` +
  `lib/canonical-lead-tagger.ts` for join/recruit this session: only `.join()` string
  calls). Completions cannot be counted, recruits cannot be suppressed from consumer
  sequences, and the process has no funnel metric at all.
- **D3 — the phone leg is untracked.** The `tel:` anchor (`app/join/page.tsx:418-420`) and
  all five CTA links on the page are bare links in a server component with no click events;
  only section views are telemetered (`KbSectionTracker.client.tsx:46-49`). The likely
  majority completion leg (call) leaves zero trace, which also makes the registry's "rare"
  cadence unverifiable.
- **D4 — the consumer footer band contradicts the page.** `KbFooter` renders its "A broker
  writes back… Tell us the street" band with the home-valuation + homes-for-sale CTAs on
  this page (`page.tsx:454` passes no `hideCta`; band + CTAs
  `components/site/kb/KbFooter.client.tsx:56-83`) — the strongest CTA block at the bottom
  of the recruiting pitch invites the recruit to request a CMA on their own house. The
  `towns={[]}` prop also blanks the footer's market fine-print line (`KbFooter.client.tsx:47-49`),
  so the shared footer is doubly wrong here: consumer pitch present, local-proof data absent.
- **D5 — the route doc comment has drifted from the rendered page.** The header comment
  promises CTA labels "Start the conversation / See how we market listings / Meet the
  brokers" (`page.tsx:10-16`); the page renders "Talk about joining / Listing marketing
  plan / Broker profiles / Send a note" (`page.tsx:264-280,415`). Harmless to visitors, but
  it propagated into the P1 registry row's completion text — evidence hygiene.
- **D6 — proof detours have no return path.** The pitch depends on `/sell#marketing-plan`,
  `/team`, and `/housing-market` as evidence (`page.tsx:267-280,349-364`), but those
  consumer surfaces contain nothing that routes a recruit back to `/join` or forward to the
  recruiting conversation — the detour is a one-way exit from this process.

**Duplicate/parallel paths that should die:** none — this is the only recruiting surface
(inbound-link sweep + route listing this session found no `/careers`, no recruiting LP).

## 11. Target shape (process-level, not pixels)

**Should this exist?** Yes. Recruiting is a real, permanent business process with a persona
no consumer node serves, and the public site is itself the strongest recruiting artifact the
brokerage owns — the pitch is "look at what the machine does for listings," and the machine
is one click away. Names, groupings, and today's section stack are NOT inherited (design
amnesia); `/join` has sitemap presence, so any P5 rename gets GSC evidence + a 301.

**Ideal shape:** one recruiting destination, structurally an about-the-brokerage node that
sits OFF the consumer exploration graph (its chrome should not sell the visitor a CMA —
D4's inversion): pitch above the fold, proof as doors INTO the live product (the marketing
plan, the team, the market instrument — which ARE the differentiator, provided the detour
carries a way back or forward to the conversation), objections answered, and a completion
leg that arrives intact: the recruit's intent survives the handoff as a first-class value,
the capture is recruit-tagged, consumer sequence enrollment is suppressed for it, and the
principal broker is notified as recruiting, not as a General Inquiry. Whether that leg is a
recruit-aware arrival at the contact destination or a minimal capture step of its own is a
P5 call; either satisfies the process. A low-commitment middle exit ("not ready to call")
is worth considering at P5 given §7's silent-exit terminal state. Both completion legs
become observable (D3). Mobile 390 is truth.

**Data gaps blocking correctness (✗ statements, not designs):**

- ✗ No GSC query/impression data for `/join` pulled this session — the organic-entry claim
  (§2.2) is structural, not evidenced, and P5 cannot judge the URL's search equity without it.
- ✗ No GA4 traffic/device split for `/join` pulled this session.
- ✗ No count of join-originated contact submissions exists or was queried (blocked by D2 —
  there is no marker to count; the nearest proxy is origin notes whose inquiry text
  round-tripped, which D1 makes unreliable).
- ✗ Phone completions: no data exists at all (D3).
- ✗ CWV for `/join` unmeasured this session.

**Destination implication + dual objective stamp:**

- Destination: ONE recruiting destination (named at P5) in the brokerage/about cluster,
  outside the consumer exploration graph, with a recruit-intent completion contract into
  the contact destination (or its own minimal capture). No other recruiting surface exists
  or should.
- `visitor_objective`: "A Central Oregon broker learns what this brokerage does for their
  listings and their business, and what joining looks like, enough to start the
  conversation."
- `machine_objective`: "Recruit conversation started: an identified, recruit-tagged contact
  reaching the principal broker — never a consumer lead, never consumer drip."
- `exits`: → `contact-form-inquiry` (the written leg, intent intact); →
  `broker-direct-call-text` (the call leg); → `plan-a-sale` (`/sell#marketing-plan` — the
  marketing-engine proof); → `contact-a-broker` trust surfaces (`/team`); →
  `explore-market-knowledge` (`/housing-market` — the data proof, linked from the model
  copy).

## 12. Acceptance checks

Persist; never delete. (Live-site HTTP checks need a real browser UA — the WAF blocks
curl's default UA.)

1. **Route serves.** In a browser (or `curl -A "Mozilla/5.0 …"`):
   `https://ryan-realty.com/join` → 200; canonical `https://ryan-realty.com/join`; WebPage
   + BreadcrumbList + FAQPage JSON-LD all present in source; FAQPage carries exactly the
   six visible questions with matching answer strings.
2. **Zero-numbers posture (§0).** The rendered page contains no market statistic, closing
   count, agent count, production figure, or split percentage: grep the rendered HTML for
   `%` and `$` followed by digits → only expected non-claims (none today). The split
   renders as a conversation, not a number.
3. **Discoverability.** `grep -n "'/join'" lib/site-nav.ts lib/site-menu.ts app/sitemap.ts`
   → the About nav group, all footer variants, the mega-menu Connect group, and the sitemap
   row (baseline today: site-nav 167, 252, 325, 384; site-menu 319; sitemap 157).
4. **Phone leg correct.** The rendered call CTA's `href` equals `tel:+15417033095` and its
   label shows `541.703.3095` — both matching `lib/brand/contact.ts:81-82`.
5. **Hero never blanks.** With `asset_library` reachable, the hero `src` is an approved
   A/B-grade hero-tagged asset URL; with the DAL forced to fail (or in a cold environment),
   it is `/images/office/ryan-realty-bend-office-interior-01.jpg`. Never an empty or broken
   image.
6. **Section telemetry lands.** Scroll the full page on 390, then:
   `SELECT event_data->>'section', count(*) FROM visitor_events WHERE event_type='section_view' AND page_url LIKE '%/join%' AND created_at > now() - interval '1 hour' GROUP BY 1;`
   → rows for `join-cta`, `listing-support`, `how-it-works`, `get-in-touch`, `faq`.
7. **Handoff intact (encodes decided behavior; FAILS today — D1).** Clicking "Talk about
   joining" lands on the contact destination with the recruit's intent visibly selected,
   and the resulting submission round-trips that intent into the captured lead. Today
   `Join the team` is not in the option list and the server infers `buyer`.
8. **Recruit never consumer-enrolled (encodes decided behavior; FAILS today — D1/D2).**
   After a join-originated submit with `e2e+join-recruit@ryan-realty.com`:
   `SELECT p.tags, e.sequence_id FROM crm_people p LEFT JOIN crm_sequence_enrollments e ON e.person_id = p.id WHERE p.id = (SELECT person_id FROM crm_contact_points WHERE kind='email' AND value='e2e+join-recruit@ryan-realty.com' LIMIT 1);`
   → tags carry a recruit marker and NO `audience:buyer`/`buyer:nurture`; no enrollment in
   the buyer master sequence exists. Today the row comes back as a buyer nurture lead.
9. **Completion is countable (encodes decided behavior; FAILS today — D2/D3).** A single
   query (by recruit tag/source) returns the count of recruit conversations started in a
   date window, and the call CTA fires a click event so phone-leg starts are estimable.
   Today both queries are impossible.
10. **Footer matches the persona (encodes decided behavior; FAILS today — D4).** The
    recruiting page's closing CTA block addresses the recruit (the conversation), not the
    consumer (a CMA on their own home). Today the shared KbFooter consumer band renders.
11. **ISR freshness.** `grep -n "export const revalidate" app/join/page.tsx` → 3600
    (baseline today: line 47).
12. **Gates green.** `npm run ci:gates` passes with this page in the tree (brand voice,
    design tokens, seo-routes, page-DAL — the page imports `@/lib/data` via
    `getSurfaceImage`, `app/join/page.tsx:36`).
