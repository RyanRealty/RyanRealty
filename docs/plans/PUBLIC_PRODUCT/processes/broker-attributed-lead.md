> **MERGED -> get-home-value.written-cma (P3 lock, Matt 2026-08-11).** This PDS is evidence for the survivor; do not build surfaces from it directly.

# Process: broker-attributed-lead — Choose-your-broker attributed lead (broker landing page / ?agent=)

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (a cookie write on entry into broker context; a form submit
  whenever a visitor converts inside that context; the 90-day cookie makes the context
  durable across sessions)
- Verdict (**PROPOSAL, not a lock — P3 decides**): **MERGE→get-home-value.written-cma** —
  the capture leg is byte-for-byte the seller-home-value pipeline (`submitBrokerSellerLead`
  is a 27-line adapter onto `submitSellerLPForm`; every write, tag, queue row, and cron
  downstream is that process's), and the only genuinely distinct machinery is the
  attribution cookie itself, which is not seller-specific: the same cookie overrides
  routing in FIVE other LP actions, personalizes listing-detail contact cards, and is
  re-stamped by every outbound CRM link. Propose: fold the broker-page form into
  `get-home-value.written-cma` as its attributed-inception variant, and record the cookie
  mechanism (write points, parse, override contract) under the machine process
  `capture-and-attribute`, where its cross-process reach actually lives. The broker
  profile page survives as a trust surface with a dual objective either way — killing this
  registry row loses nothing observable, because both halves land in processes that keep it.
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

A visitor who has chosen a specific broker — landed on that broker's page, clicked that
broker's ad, or clicked a link that broker sent — judges that broker's real track record
and starts a home valuation with them by name, and is answered by that broker personally
rather than a routing pool. The machine outcome is **valuation started (the E2 KPI)
assigned to the chosen broker**: because the page proves the specific human (verified
closings, filtered reviews, direct phone line), asking that human for a CMA is the natural
next step, and the 90-day `rr_agent_attribution` cookie guarantees the resulting
`crm_people` row (and any later conversion this visitor makes) carries
`assigned_broker = <that broker>` instead of the default all-to-Matt routing.

## 2. Inception (what starts it)

Trigger: the visitor enters a specific broker's context. Three concrete entry mechanisms,
each ending in a client-side write of the `rr_agent_attribution` cookie (90-day max-age,
`path=/`, `SameSite=Lax`, JSON `{slug, capturedAt}` — last touch wins):

- **Broker profile page `/team/[slug]`** — internal (About menu → `/team` roster,
  `lib/site-nav.ts:164`; roster cards link each canonical slug,
  `components/site/kb/KbTeam.client.tsx:50`), organic (both `/team` and every
  `/team/[slug]` are sitemap-emitted, `app/sitemap.ts:98,444`), or direct/ad. The page
  resolves the broker (`getAgentBySlug`, alias-tolerant via `BROKER_SLUG_ALIASES` →
  canonical row, `lib/data/brokers/getBrokers.ts:144-156`; unknown slug → `notFound()`,
  `app/team/[slug]/page.tsx:202-204`), derives the 3-value attribution slug
  (`normalizeAgentSlug(slug)` with an email-map fallback for canonical web slugs the
  attribution namespace lacks, `app/team/[slug]/page.tsx:281-285`), and mounts
  `BrokerAttributionSetter`, which writes the cookie on every visit — the broker's own
  page always wins last-touch (`components/BrokerAttributionSetter.tsx:19-26`; null slug
  no-ops, `:21`).
- **Any URL carrying `?agent=<slug>`** — `AgentAttributionBridge` is mounted site-wide
  (inside `IdentityBridges`, used by `RootProvider`,
  `components/site/providers/IdentityBridges.tsx:19-27`; `RootProvider` in
  `app/layout.tsx:135`) and writes the raw lowercased param into the cookie unvalidated
  (`components/AgentAttributionBridge.tsx:12-17`). Producers of these URLs proven in code:
  the admin ad-link factory `/admin/broker-links` building
  `${base}/lp/${lp.slug}?agent=${b.slug}` for 3 brokers × 5 LPs
  (`app/admin/(protected)/broker-links/page.tsx:8,24-36,86`), and every outbound CRM
  email/SMS, whose site links are idempotently stamped with the assigned broker's
  `?agent=` at send time (`attributeSiteLinks`, `lib/crm/merge.ts:313-330`;
  wrap rules `lib/crm/attributed-links.ts:14-27`) — so a lead clicking any link their
  broker sent re-enters that broker's context.
- **Listing-detail sticky random assignment** — a visitor with NO cookie, no `?agent=` in
  the URL, and no Ryan Realty listing agent on the page gets a RANDOM broker written into
  the same cookie so unassigned third-party listings distribute
  (`components/site/listing-detail/ListingBrokerCTA.client.tsx:92-109`, write at
  `:55-70`). This is an inception nobody chose — see §6 and §10.

Preconditions: JavaScript (both writers are client effects); for the conversion leg, the
broker page must render its inline seller form (`LeadCaptureBlock variant="seller"`,
`app/team/[slug]/page.tsx:447-455`). The P1 note that paid per-broker ads point at
`/team/[slug]` is a docblock claim (`components/BrokerAttributionSetter.tsx:9-17`); the
only in-repo ad-URL factory builds `/lp/*?agent=` links, not `/team/*` — recorded as
stated, not as verified ad traffic.

## 3. Actors

- **Visitor segment:** sellers (and owner-curious) who care WHO they work with — they
  arrived through a specific human's page, ad, or message. The same cookie also silently
  covers visitors who never chose anyone (the listing-page random write). Device split for
  `/team/*` was NOT pulled this session (named gap, §11); program law is mobile-first,
  390 is truth (decisions.md 2026-08-11).
- **The three brokers** as subjects: the attribution namespace is exactly
  `{matt, rebecca, paul}` (`lib/agent-attribution.ts:24-34`), mapped to FUB user ids 1/2/3
  (`:62-66`) and emails (`:68-72`).
- **Automated actors (all shared with the valuation spine):** `crm-auto-enroll` catch-all
  cron, `crm-sequence-engine` + `crm-scheduled-sends` (sequence touches render AS the
  attributed broker — merge context is built from `person.assigned_broker`,
  `lib/crm/enroll.ts:262`), `cma-build-worker` building the queued CMA draft.
- **Accountable for completion:** the ATTRIBUTED broker — the origin note names them and
  records `assignmentReason: 'agent attribution cookie'`
  (`app/lp/seller-home-value/actions.ts:541-543`), and the confirmation copy promises
  "Your broker will reach out personally" (`app/team/actions.ts:38`).

## 4. Systems of record

| Artifact | SoR |
|---|---|
| The attribution itself (durable, per-lead) | `crm_people.assigned_broker` + the `broker:{slug}` tag, written by `enrichNativeLead` (`app/lp/seller-home-value/actions.ts:486-491,546-552`) — NOT the cookie |
| The assignment ledger (dashboards) | `public.marketing_assignments` via the ONE upsert `recordMarketingAssignment` — grain `(fub_person_id, audience, source)`, broker updated in place on re-assignment (`lib/data/crm/recordMarketingAssignment.ts:13-31`; called at `actions.ts:222-241,570-576`) |
| The lead | `crm_people` + `crm_contact_points` via `sendEvent`→`ensureNativeLead` (`actions.ts:376-411`, fallback `:417-433`) |
| Why it routed this way | `crm_timeline` origin note (`assignmentReason`, `actions.ts:525-552`) |
| The valuation request | `public.valuation_requests` (`actions.ts:341-361`; email is required on this form so the row always lands) |
| The queued CMA | `public.cmas` (draft) + `public.marketing_brain_actions` `content:cma` row via `createCmaRequest` (`actions.ts:611-629`) |
| Pre-conversion browser state | the `rr_agent_attribution` cookie — deliberately NOT a SoR: client-JS-writable by three components, unvalidated at write time, validated only at server parse (`lib/agent-attribution.ts:78-88`); it is a routing hint that becomes truth only when a submit stamps `crm_people` |

Explicitly NOT a SoR: GA4 (`assigned_broker` user property + `broker_slug` param are
analytics mirrors, `actions.ts:749,756-758`), Meta CAPI `assigned_broker` customData
(`actions.ts:708`), the rendered page.

## 5. End-to-end path (inception → completion)

1. **Enter broker context** · visitor · arrives via roster/organic/ad/CRM-link/listing
   page · URL · a broker-context page render · `app/team/[slug]/page.tsx:202-204`
   (resolve + 404 guard) or any route with `?agent=` or a listing detail ·
   garbage `/team/` slug → real 404 · any device.
2. **Cookie write** · client effect · one of the three writers stamps
   `{slug, capturedAt}`, 90-day, last-touch · broker context · `rr_agent_attribution`
   cookie · `components/BrokerAttributionSetter.tsx:19-26` /
   `components/AgentAttributionBridge.tsx:12-17` /
   `components/site/listing-detail/ListingBrokerCTA.client.tsx:55-70,92-109` · JS off →
   no cookie → default routing later; the bridge writes RAW unvalidated slugs (an unknown
   value parses to null downstream) · any.
3. **Broker page answers "who is this?"** · server (ISR `revalidate = 60`,
   `app/team/[slug]/page.tsx:105`) · hero + bio + §0-honest proof: own closings (verified
   list/buyer keys, out-of-area zips excluded, `:222-244`), brokerage record fallback
   (`:247-256`), reviews filtered so no OTHER broker's praise appears (`:154-175,271-274`),
   live facts only (`:288-294`) · DAL reads · rendered trust surface ·
   `KbSectionTracker pageType="broker"` measures sections (`:364`) · any.
4. **Form fill** · visitor · inline "A CMA from {firstName}" `LeadCaptureBlock
   variant="seller"`: name (required), email (required), phone (optional), address
   (required), timeline (free text), notes (optional) + the A2P SMS-consent checkbox
   renders (`components/site/LeadCaptureBlock.tsx:206-272,313`; mount
   `app/team/[slug]/page.tsx:447-455`) · abandonment = terminal (d) in §7 · any.
5. **Submit → adapt** · `submitBrokerSellerLead` server action · variant/address/name/email
   validation; timeline + notes folded into `motivation`; `source: 'seller-lp'` ·
   typed payload · a `SellerLPSubmission` · `app/team/actions.ts:17-35` · invalid →
   inline error, retry · any. **Defect:** the folded `motivation` field is DECLARED but
   never read by the pipeline (`app/lp/seller-home-value/actions.ts:48-49` is its only
   appearance) — the visitor's typed timeline and notes are silently dropped (§10-1).
6. **Delegate to the valuation spine** · `submitSellerLPForm` · UTM/referer parse,
   identity-cookie resolve, `valuation_requests` insert, `sendEvent('Seller Inquiry')` →
   native `crm_people` id with `ensureNativeLead` fallback so the lead is never dropped ·
   `app/lp/seller-home-value/actions.ts:261-433` · email missing AND no identity cookie →
   hard error (cannot happen here; the form requires email) · server.
7. **Attribution override — the step this process exists for** · `assignSellerLead` →
   `readAttributedAgentServer` → `cookies()` → `parseAgentAttributionCookie` →
   `normalizeAgentSlug` against the 6-variant map · the cookie · `{broker, userId}` or
   null → `{matt, 1}` default · `actions.ts:214-220`;
   `app/actions/agent-attribution-read.ts:20-33`; `lib/agent-attribution.ts:27-40,78-88` ·
   unparseable/unknown slug → silent Matt default · server.
8. **Enrich + ledger** · server · tags `audience:seller`, `seller:nurture` (timeline enum
   is never passed so `classifyTimeline(undefined)` → nurture, `actions.ts:181-197` —
   §10-2), `source:seller-lp`, `broker:{slug}`, paid-attribution tags; custom fields;
   origin note with `assignmentReason: 'agent attribution cookie'`; geocode
   fire-and-forget; `marketing_assignments` upsert · `actions.ts:486-576` · hard-stopped
   person skips enrichment/enrollment (`:457-460`) · server.
9. **Auto-enroll, SMS fail-closed** · server · `autoEnrollByFubId` resolves the native id
   and enrolls the seller sequence; SMS is suppressed unless the action passed
   `smsConsent: true` — the adapter never passes it, so every broker-page lead is
   sms-suppressed even when the visitor checked the box (§10-3) ·
   `actions.ts:604-609`; `lib/crm/enroll.ts:268-306` (fail-closed block `:290-305`) ·
   suppression failure logs, never blocks capture · server.
10. **Queue the CMA + alert** · server · `createCmaRequest` → `cmas` draft +
    `content:cma` brain-action row; always-on Matt alert email; Meta CAPI Lead $500 with
    `assigned_broker`; GA4 MP `generate_lead` with `broker_slug` + `assigned_broker` user
    property · `actions.ts:611-629,637-670,672-715,740-759` · all fire-and-forget except
    `createCmaRequest`; failures log · server.
11. **Confirm** · client · "Got it. Your broker will reach out personally with a
    valuation." · `app/team/actions.ts:38` rendered by the block's status line
    (`components/site/LeadCaptureBlock.tsx:319-330`) · any.
12. **Attributed follow-through (background, shared tail)** · crons · sequence touches
    render as the attributed broker (`lib/crm/enroll.ts:262`); `cma-build-worker` builds
    the draft; broker reviews at `/admin/cmas` — the rest is
    `get-home-value.written-cma`'s §5 from its step "CMA build" on · **← process
    completion (§7)** · server/admin.

## 6. Decision points

- **Which writer wins:** last touch. The broker's own page ALWAYS overwrites
  (`BrokerAttributionSetter` runs on every render, `:19-26`); the bridge overwrites on any
  `?agent=`; the listing-page random write fires ONLY when no cookie exists, no `?agent=`
  is in the URL, and the listing is not a Ryan Realty listing agent's own
  (`ListingBrokerCTA.client.tsx:99-108`).
- **Parse-or-default:** `SLUG_NORMALIZE` accepts exactly 6 variants
  (`lib/agent-attribution.ts:27-34`); anything else — including the CANONICAL web slug
  `matthew-ryan` that the listing-page writer stores for Matt — parses to null and routes
  to the Matt default (`accidentally correct for Matt, structurally wrong as a contract`;
  Rebecca/Paul web slugs ARE in the map). The team page pre-empts this for its own writes
  via the email fallback (`app/team/[slug]/page.tsx:281-285`).
- **Attributed vs default routing:** cookie present+parseable → that broker; else Matt
  (`actions.ts:214-220`, per the 2026-05-17 directive quoted at `:199-213`). Manual
  reassignment in the CRM UI remains possible regardless.
- **Random-assignment contradiction (for P3, not resolved here):** the seller action
  documents "No round robin. I will get all listings and leads" as the default
  (`actions.ts:203-204`), while `ListingBrokerCTA` deliberately random-distributes
  unattributed visitors on third-party listings and persists it for 90 days
  (`ListingBrokerCTA.client.tsx:99-108`) — so a visitor who browsed one listing before
  any seller form is routed by lottery, not by default-Matt. Both behaviors are
  intentional per their comments; they cannot both be the product rule.
- **Compliance gates:** A2P consent checkbox rendered on the form
  (`LeadCaptureBlock.tsx:313`; carrier-verified sentence,
  `components/site/SmsConsentDisclosure.tsx:8-24`) with fail-closed SMS suppression at
  enroll (`lib/crm/enroll.ts:290-305`); compliance hard-stop gate before any enrichment
  (`actions.ts:457-460`); the cookie is publicly disclosed on `/cookies`
  (`app/cookies/page.tsx:76`); §0 holds on the trust surface feeding the form — closings
  are verified MLS keys with out-of-area exclusion, reviews are attribution-filtered,
  no fabricated stats (`app/team/[slug]/page.tsx:222-244,271-274,287-294`); voice canon on
  all form/confirmation copy (fact-then-stop, no em dashes).

## 7. Completion

Done-when (observable): a `crm_people` row exists with
`assigned_broker = <attributed broker>`, tags containing `audience:seller` +
`broker:{slug}` + `source:seller-lp`, an origin note on `crm_timeline` whose
`assignmentReason` reads `agent attribution cookie`, one `marketing_assignments` row
(`audience='seller'`, that broker), one `valuation_requests` row, a `cmas` draft +
`content:cma` `marketing_brain_actions` row queued, an active seller-sequence enrollment,
and an `sms` suppression row (`no-sms-consent`) — and the visitor saw the "Your broker
will reach out personally" confirmation.

Artifacts at completion: the rows above + Matt alert email + CAPI/GA4 mirror events
carrying the broker slug.

Terminal states:

- **(a) Attributed lead** — cookie parsed to `rebecca`/`paul` (or explicit `matt`);
  `assigned_broker` is that broker. The process's reason to exist.
- **(b) Default-routed lead** — no cookie, or an unparseable slug; identical rows with
  `assigned_broker='matt'` and `assignmentReason: 'default routing to Matt'`
  (`actions.ts:541-543`). Indistinguishable to the visitor.
- **(c) Attributed-but-not-here** — cookie set, visitor converts on ANOTHER surface (any
  of the 5 LP forms, `cma-download`) — completion belongs to that surface's process; the
  attribution carries (§9).
- **(d) Context only** — cookie written, no conversion; 90 days of personalized broker
  CTAs (`ListingBrokerCTA` swap-in) and then expiry. No lead exists.
- **(e) Rejected submit** — adapter or pipeline validation error surfaced inline; retry.

## 8. Time & performance

- **Time-to-answer budget:** the visitor's question ("is this broker any good, and will
  they value my home?") is answered by the first two viewports of `/team/[slug]` — hero
  identity + live proof line (`heroLead`, `app/team/[slug]/page.tsx:297-299`) — with the
  conversion form one scroll below the track record. The page is ISR (`revalidate = 60`,
  `:105`) over three parallel DAL reads (`:222-228`); nothing aggregates raw `listings`
  at request time.
- **Cookie write cost:** a client effect, no network; attribution adds ONE server-side
  cookie parse to the submit path (`readAttributedAgentServer`) — negligible against the
  pipeline's sequential writes.
- **Submit latency reality:** the visitor waits on the awaited chain
  (`valuation_requests` insert → `sendEvent` → `enrichNativeLead` →
  `recordSellerAssignment` → `autoEnrollByFubId` → `createCmaRequest`,
  `actions.ts:341-629`); geocode, backfill, alert email, CAPI, GA4 are fire-and-forget.
  "Slow" = a multi-second pending state on the submit button
  (`LeadCaptureBlock.tsx:308-310`); no timeout guard exists on the awaited chain.
- **Core Web Vitals for `/team/*`:** NOT measured this session — named gap. No CWV number
  is claimed here (§0).

## 9. Variants

The attribution mechanism is ONE contract (cookie → `readAttributedAgentServer` →
override-or-Matt) consumed by many capture surfaces. Variants by inception:

- **Broker-page inline form (this spine):** `/team/[slug]` → `submitBrokerSellerLead` →
  seller pipeline.
- **Attributed LP conversions:** the same cookie overrides routing in
  `app/lp/fsbo/actions.ts:86`, `app/lp/expired-listing/actions.ts:53`,
  `app/lp/buyer-listing-alerts/actions.ts:84`, `app/lp/tetherow/heath/actions.ts:82`, and
  the seller LP itself — those conversions belong to `arrive-from-ad` /
  `get-home-value.*`; only the attribution is shared.
- **CMA download door:** `app/actions/cma-download.ts:106` reads the same cookie.
- **CRM re-attribution loop:** every outbound CRM message stamps `?agent=` on site links
  (`lib/crm/merge.ts:313-330`), so an existing lead clicking through re-arms the cookie —
  retention, not acquisition.
- **Server-to-server (no cookie possible):** Meta Instant Forms leads attribute by
  parsing the broker's name from the campaign/ad-set text — `brokerSlugFromText`
  (`lib/agent-attribution.ts:49-59`; used because the webhook is server-side,
  `app/api/meta/lead-webhook/route.ts:59,372`). Same namespace, different carrier.
- **NOT a variant — the gap:** the `/contact` form ignores the cookie entirely (its
  action never imports `readAttributedAgentServer`; routing goes through the lead-routing
  engine) — a visitor in Rebecca's context who uses `/contact` is assigned by the engine,
  not by their chosen broker. Cross-process inconsistency recorded for P3/P4.

No split warranted: every variant re-converges at the identical
`assigned_broker`-stamping contract.

## 10. Current implementation map

- **Routes:** `/team` (roster, `app/team/page.tsx`), `/team/[slug]`
  (`app/team/[slug]/page.tsx`), `/admin/broker-links` (URL factory, admin v2);
  attribution consumers across `/lp/*` and listing detail (§9).
- **Registers:** `/team/[slug]` mixes TWO of the design languages on one page — the kb
  register for every section (`KbHero`/`KbAbout`/`KbFeatured`/… ,
  `app/team/[slug]/page.tsx:48-58`) plus the `primitives`-register `LeadCaptureBlock`
  (`components/site/LeadCaptureBlock.tsx:4-12`) and a hand-rolled inline-styled
  "Direct line" section (`:460-493`). A fact about the floor being replaced, not a shape
  to inherit.
- **Actions/DAL:** `submitBrokerSellerLead` (`app/team/actions.ts`) → `submitSellerLPForm`
  (`app/lp/seller-home-value/actions.ts`); `lib/agent-attribution.ts` (pure, unit-tested:
  `lib/agent-attribution.test.ts`); `app/actions/agent-attribution-read.ts`;
  `lib/data/crm/recordMarketingAssignment.ts`; `lib/crm/enroll.ts`. Crons: none of its
  own — the shared seller tail (auto-enroll sweep, sequence engine, sends, cma-build)
  belongs to `get-home-value.written-cma`.
- **Known defects (evidence, this run):**
  1. **Visitor's words are dropped:** the adapter folds timeline + notes into
     `motivation` (`app/team/actions.ts:33`), a field `SellerLPSubmission` declares but
     `submitSellerLPForm` never reads (`app/lp/seller-home-value/actions.ts:48-49` is its
     only occurrence). "Ready to sell in September, roof is new" never reaches the CRM,
     the origin note, or the CMA payload.
  2. **Tier is always nurture:** the typed `timeline` enum is never passed, so every
     broker-page lead classifies `unknown` → `seller:nurture` (`actions.ts:181-197`) —
     no lead from a broker's own page can ever be `seller:hot`, so the 5-minute hot-call
     task (`actions.ts:580-589`) can never fire here, even for "ready now" text the
     visitor typed (which defect 1 then discards).
  3. **Consent shown, never captured:** `LeadCaptureBlock` renders the A2P checkbox
     (`components/site/LeadCaptureBlock.tsx:313`) but builds its payload from React state
     with no `smsConsent` field (`:61-69,170-176`) and the adapter passes none — so
     `autoEnrollByFubId` fail-closes and suppresses SMS for every broker-page lead
     (`lib/crm/enroll.ts:290-305`), including visitors who checked the box. Compliant
     (fail-closed) but the captured consent is discarded and the checkbox is decorative.
  4. **Source attribution mislabeled:** no `pagePath` is passed, so `sanitizePagePath`
     defaults the sourceUrl, origin-note landing page, and CAPI eventSourceUrl to
     `/lp/seller-home-value` (`actions.ts:74-76,282-283,528,681-683`) — a broker-page
     lead is indistinguishable in the CRM from a paid-LP lead except by the
     `assignmentReason` line.
  5. **No session stitch:** `sessionId` is never passed, so the anonymous-history
     backfill (`actions.ts:442-450`) cannot run for broker-page leads.
  6. **Attribution-namespace hole:** `SLUG_NORMALIZE` omits the canonical web slug
     `matthew-ryan` (`lib/agent-attribution.ts:27-34`) that `ListingBrokerCTA`'s random
     writer stores (`ListingBrokerCTA.client.tsx:107` writes `b.slug`); it parses to
     null → Matt default. Correct outcome by coincidence for Matt only.
  7. **Writer inconsistency:** `ListingBrokerCTA.writeAttribution` omits the `Secure`
     attribute the other two writers set (`ListingBrokerCTA.client.tsx:59-66` vs
     `BrokerAttributionSetter.tsx:23`).
  8. **Orphan component:** `components/site/AttributedBrokerCard.client.tsx` reads the
     cookie but is imported by nothing (repo-wide grep this run matched only its own
     definition) — dead consumer.
- **Duplicate/parallel paths that should die:** the broker-page seller form is a THIRD
  seller-capture surface (after `/sell#get-value` and `/sell/valuation`) with its own
  field set (free-text timeline vs the LP's enum; single step vs the locked 2-step) —
  the parallel-form drift is the direct cause of defects 1–3. The random-assignment
  writer (§6) is a second, contradictory routing policy living in a client component.

## 11. Target shape (process-level, not pixels)

**Should this exist? As a mechanism, yes; as a standalone process, no.** Choose-your-broker
attribution is real product value (the accountability pitch — "the broker you call is the
broker who works the deal" — is the roster page's own thesis, `app/team/page.tsx:41-44`)
and the E2 KPI needs the broker page converting. But the process is a routing overlay plus
an entry surface on the valuation spine, not a distinct pipeline — the ideal shape is:
ONE seller-capture spine (the locked 2-step contract: address → email required, no orphan
saves — decisions.md 2026-08-11 absorbed block) rendered IN broker context with
attribution preserved, replacing the parallel one-step form so defects 1–3 become
structurally impossible. The attribution contract to preserve through any rebuild:
explicit broker context always beats default routing; last-touch; 90-day durability;
server-side parse against one canonical namespace (close the `matthew-ryan` hole); the
visitor is never shown whether they are attributed. The random-assignment policy needs a
Matt decision at P3 — it contradicts the recorded no-round-robin default and should either
become a recorded product rule or die.

**Destination implication:** NOT a destination of its own. `/team` + `/team/[slug]` are
trust-proof nodes of whatever P5 names the about/trust destination, with the conversion
moment embedded; the attribution mechanism itself has no page at all — it is
`capture-and-attribute` machinery that P5 records as context persisting across edges (the
continuity directive: the chosen broker is exactly the kind of established context that
must follow the visitor through the graph instead of resetting).

**Dual objective stamped on its pages (`/team/[slug]`):**

- `visitor_objective`: "Judge this specific broker — their verified sales, their reviews,
  their direct line — and start a valuation or a conversation with them by name."
- `machine_objective`: "Valuation started (E2) assigned to the chosen broker, with 90-day
  durable attribution so this visitor's later conversions route to the same human."
- `exits`: inline CMA form (the conversion), `tel:`/`sms:` direct line
  (→ broker-direct-call-text), `/team` (roster siblings), track-record tiles →
  `/listing/*` (→ find-a-home), sell CTA → the valuation spine (→ get-home-value).

**Data gaps blocking correctness:** none blocking — the chain (cookie → override →
`crm_people.assigned_broker` → `marketing_assignments` → attributed sequence sends) is
complete and observable. Named measurement gaps: GA4 device split + CWV for `/team/*` not
pulled this session; no per-broker conversion count was queried (the GA4
`broker_slug` param and `marketing_assignments.broker` make both queryable); whether any
paid ad actually targets `/team/[slug]` was not verified operationally.

## 12. Acceptance checks

Persist; never delete. Run against production (`ryan-realty.com`) unless noted.

1. **Broker page renders the machinery:**
   `curl -sL https://ryan-realty.com/team/rebecca-peterson | grep -c 'A CMA from Rebecca'`
   ≥ 1; the same fetch contains the SMS-consent sentence (A2P surface present) and
   `grep -c 'Direct line'` ≥ 1.
2. **Alias tolerance:** `curl -s -o /dev/null -w '%{http_code}' https://ryan-realty.com/team/rebecca`
   → `200`, and its rendered canonical link points at `/team/rebecca-peterson`
   (`grep -o '<link rel="canonical"[^>]*'`).
3. **Cookie write (browser, not curl):** load `/team/rebecca-peterson`, then in devtools
   `document.cookie` contains `rr_agent_attribution` decoding to `{"slug":"rebecca",...}`;
   load any page with `?agent=paul` and confirm the cookie now decodes to `paul`
   (last-touch).
4. **Normalization unit-proof:**
   `npx vitest run lib/agent-attribution.test.ts` — green (slug variants → canonical
   short slugs; junk → null).
5. **Attributed capture E2E (test email, then clean up):** with the cookie set to
   `rebecca`, submit the broker-page form; then verify in one pass —
   `SELECT id, assigned_broker, tags FROM crm_people ORDER BY created_at DESC LIMIT 1`
   → `assigned_broker='rebecca'`, tags contain `audience:seller`, `broker:rebecca`,
   `source:seller-lp`; with that id as `:pid`:
   `SELECT body FROM crm_timeline WHERE person_id=:pid ORDER BY created_at LIMIT 1`
   contains `agent attribution cookie`;
   `SELECT broker FROM marketing_assignments WHERE fub_person_id=:pid AND audience='seller'`
   → `rebecca`; `SELECT count(*) FROM valuation_requests WHERE email=<test email>` → 1;
   `SELECT count(*) FROM cmas WHERE lead_email=<test email>` → 1.
6. **Default routing control:** clear the cookie, repeat check 5 → `assigned_broker='matt'`
   and the origin note reads `default routing to Matt`.
7. **Fail-closed SMS held:** for the check-5 lead,
   `SELECT count(*) FROM crm_suppressions WHERE person_id=:pid AND channel='sms' AND reason='no-sms-consent'`
   → 1 (until defect §10-3 is fixed, this fires even when the box was checked; after the
   fix, re-point this check at consent-true → 0 rows / consent-false → 1 row).
8. **Attributed sequence sender:** for the check-5 lead,
   `SELECT count(*) FROM crm_sequence_enrollments WHERE person_id=:pid AND status='active'`
   → 1, and the first rendered touch signs as Rebecca (merge context from
   `assigned_broker`, `lib/crm/enroll.ts:262`).
9. **Defect regressions (flip these when fixed):** grep-level —
   `grep -c 'motivation' app/lp/seller-home-value/actions.ts` → currently 2 (declaration
   only; a fix makes it consumed or deletes the adapter's fold);
   `grep -n 'smsConsent' components/site/LeadCaptureBlock.tsx` → currently no payload
   field (a fix threads the checkbox into the payload and adapter).
10. **Random-assignment behavior is decided, not accidental (P3 follow-up):** on a
    third-party listing detail page with no cookie and no `?agent=`, devtools shows the
    cookie being written with a random broker web slug
    (`ListingBrokerCTA.client.tsx:99-108`); once P3 rules, this check asserts the decided
    behavior (either the write is gone, or it is recorded in decisions.md).
