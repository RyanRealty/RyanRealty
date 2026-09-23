# funnel — long-form notes (reader: funnel, 2026-09-22, HEAD 83a459c, read-only)

Scratch artifacts in this folder: `probe.json` (company-scoreboard-probe output), `quantify.mjs` + `quantify.out.json` (30-day aggregation in JS through `../lib/sb.mjs`), `sessions.mjs`, `live/*.html` (production pages fetched with a Chrome UA). `git status --short` was empty at finish. No sends, no submits, no MCP calls after the orchestrator's rule change (the earlier `execute_sql` row reads are quoted below with their SQL; every later number comes from the helper script).

## 1. Capture surfaces as they exist live (curl, Chrome UA, 2026-09-22 ~19:40Z)

| Surface | Live evidence | Server action | sendEvent type / source / tags | Sequence | Visitor confirmation |
|---|---|---|---|---|---|
| `/` | 200, 2 forms, `id="alerts"` sheet, "Value my home" x6, "Talk to a broker" x2, tel: brokerage 541-703-3095 + 2 broker lines | alerts sheet → `submitSearchAlertSignup` | `Saved Property Search`, source `ryan-realty.com`, canonical tags `audience:buyer buyer:warm source:idx-registration` (`app/actions/search-alert-capture.ts:116-134`) | Buyer Master (id 2) via `autoEnrollByPersonId(nativeId)` with NO smsConsent (`:160-161`) | `alert:confirmation` email ("Your alert is on") within ~7 s (timeline 64099) |
| `/buy` | 200, 1 form; "Get listing alerts" x2, "Search homes" x8 | `BuyAlertsSheet` → `submitSearchAlertSignup` (propertyType A, email only) | same as above | same | same |
| `/price-drops` | 200, 1 form | `PriceDropAlertsSheet` → `submitSearchAlertSignup` | same | same | same |
| `/sell` | 200, 2 forms (SellValueForm + footer), "Value my home" x17, "Written valuation" x6, SMS-consent checkbox | `submitSellerLPForm` (`app/lp/seller-home-value/actions.ts`) | `Seller Inquiry`, source `resolveLeadSource(utm, 'ryan-realty.com')`, tags `audience:seller seller:<tier> source:seller-lp broker:<slug>`; also inserts `valuation_requests` | Seller Master (id 1) | contact confirmation + CMA build |
| `/communities/tetherow` (place pages) | 200, 2 forms, "Value my home" x8, "Talk to a broker" x2 | `requestPlaceValuation` (`app/communities/[slug]/_v3/place-value-actions.ts:194-355`) | `Seller Inquiry`, source `place-page`, tags `audience:seller source:place-page place:<slug> broker:<slug>`; `createCmaRequest` (writes `marketing_brain_actions`) | Seller Master, `autoEnrollByPersonId(personId,{smsConsent:false})` | `sendPlaceValueConfirmation` email |
| `/contact` | 200, 1 form (V3Ask), inquiry select Buying/Selling/Both/General/Relocation/Join the team, tour-time select, SMS consent, tel: x3, sms: x3, door to `/book` | `submitContactForm` (`app/contact/actions.ts`) | `General Inquiry` (audience null in sendEvent), source `ryan-realty.com`; `after()` → `canonicallyTagLead` audience inferred from inquiryType (`:26-30`, default buyer) → tags `audience:buyer buyer:nurture source:contact-form broker:matt` | Buyer Master unless `Join the team` (→ `tagRecruitJoin`, no audience, no sequence) | `sendContactConfirmation` ("We got your note") within ~6 s; Meta CAPI + GA4 `generate_lead` |
| `/listing/220222277` | 200, 1 form ("Watch" alerts), tel:/sms: 5417033095 (brokerage line), tour link `/contact?listingKey=…&intent=tour`, `?agent=matt` links | tour/question → contact form with listingKey | as contact, message tagged with listing label, geo referral tags | Buyer Master (local) / none (out-of-area) | contact confirmation (tour wording) |
| `/housing-market/bend` | 200, 1 form | `submitMarketPageInquiry` → `submitPageCTA` | `General Inquiry`, tags `audience:buyer source:homepage-cta` | Buyer Master via 15-min sweep (no instant enroll in submitPageCTA) | none in helper |
| `/about` | 200, 1 form (footer) | footer newsletter → `subscribeNewsletterAction` | `ensureNativeLead` source `newsletter`, tags `audience:buyer source:newsletter` | none by design ("No broker task. No send.") but `audience:buyer` makes the 15-min `crm-auto-enroll` sweep eligible (`app/api/cron/crm-auto-enroll/route.ts:64-68` selects post-epoch people) — UNVERIFIED in data: zero `source:newsletter` people exist (see §6) | none |
| `/team` | 200, 0 forms, tel:/sms: for 3 brokers | `/team/[slug]` sets `rr_agent_attribution` cookie (`BrokerAttributionSetter`) | attribution only | — | — |
| `/join` | 200, 0 forms; "Talk about joining" → `/contact?inquiry=Join%20the%20team`; tel | contact form | `recruit:join` tag, stage stays Lead | none | contact confirmation |
| Google sign-in | `app/auth/callback/route.ts:243` `trackSignedInUser` → source `website-signup`, tag `source:website-signup`; comms-door cookie adds newsletter/SMS consent | — | none (enroll.ts:351 classifies as "bare site sign-in", alert says "browsing, low intent") | — |
| Phone/SMS | Twilio webhooks → `findOrCreatePersonByPhone`, source `inbound-call` (34 in 30 d) | — | — | — |

`/search` → 308 to `/homes-for-sale`. `/team/matt-ryan` → 301 (slug redirect; not followed).

## 2. The backend contract (code)

- `lib/crm/send-event.ts:65-89`: `sendEvent` forwards ONLY `name,email,phone,source,tags,assignedBroker` to `ensureNativeLead`. `sourceUrl`, `pageUrl`, `pageTitle`, `message`, `campaign` (UTM) are accepted and dropped. Audience derives from the event type; `General Inquiry` → no audience tag (the contact form relies on `canonicallyTagLead` in `after()`).
- `lib/data/crm/ensureNativeLead.ts:158-303`: email-first, then phone dedupe on `crm_contact_points`; create → `buildNativePersonRow` (stage `Lead`, `assigned_broker` default `matt`, `source:<source>` tag). REUSE path (`mergeReuseEnrichment`, `:323-366`) overwrites `crm_people.source` with the latest touch (`update.source = input.source`), so first-touch source is lost on re-submit.
- `lib/crm/enroll.ts:40-184`: post-epoch only (2026-06-10), outreach-list sources never enroll, fleet:test never enrolls, referral-geo block, hard-stop check, rules table (`crm_automation_rules` 4 rows: intent:expired-listing→3, intent:fsbo→4, audience:seller→1, audience:buyer→2), one master sequence per person ever, insert enrollment `running`, then `advanceJourneyStage('sequence-enroll')` → Nurture.
- `lib/crm/enroll.ts:288-413` `autoEnrollByPersonId`: adds `sms` suppression `no-sms-consent` unless the caller passes `smsConsent:true`; queues the broker new-lead text (`queueBrokerAlert`).
- `lib/crm/journey-advance.ts`: entry `Lead`; triggers `sequence-enroll` and `first-outbound` → `Nurture`. `scripts/check-stage-truth.mjs` (ci:stage-truth) locks exactly this.
- `app/api/cron/crm-sequence-engine/route.ts:316-321`: on an SMS step, `isSuppressed(person,'sms')` → `finish({status:'suppressed'})` — the ENROLLMENT ends; later steps never run.
- `lib/crm/broker-alerts.ts:149-219`: every alert routes to `matt` unless the broker has a forwarding phone; per-broker prefs; dedupe by `crm_timeline.dedupe_key`.
- `lib/crm/response-clock*.ts` + `/api/cron/crm-response-clock` (*/5): 5-minute "untouched" text to the assigned broker, 24-hour escalation to Matt; human-touch predicate excludes `source in (automation, sequence, smart-followup, lp-form, broker-alert, auto-enroll, email-tracking, system, response-clock)` and `payload.initiator='system'`.
- `lib/crm/lead-routing.ts:23-25`: "Behavior is all-to-Matt until an owner changes the strategy in /admin/crm/settings/assignment."
- Anti-abuse: `submitSearchAlertSignup`, `subscribeNewsletterAction`, `requestPlaceValuation` have honeypot + fail-closed per-IP limiter. `submitContactForm` has NEITHER (full read of `app/contact/actions.ts`; grep for honeypot|company|limiter|rate returns only tracking lines). No captcha/turnstile anywhere on the capture paths (repo grep hits only `OutOfAreaReferralSheet`, `ListingVideoEmbed`, two publish scripts).

## 3. Scoreboard probe (npx tsx scripts/company-scoreboard-probe.ts, 2026-09-22T19:35:11Z)

- crm: people 23,001 (deleted=false, fleet:test excluded); byStage Nurture 20,401 · Lead 203 · Sphere 2,338 · Active Client 12 · Engaged 9 · Past Client 32 · Trash 2 · Vendor 1 · `lead` 3; createdLast7d 96.
- sequences 7; search: listingAlerts 55 (51 active, 55 with person), savedSearchesLegacy 2; identity: identityMap 378 / mappedToCrm 244, emailEvents7d 3,560 (opens 105, clicks 16), visitorEvents7d 11,592; join visits7d 48, conversions7d 4; newsletter subscribers 5,351; brokers 3; ledger rows 20 (openWindows 8, expiredUnlearned 7).

## 4. Row reads made before the rule change (SQL + result excerpts)

- `SELECT id, created_at, stage, source, tags, assigned_broker … FROM crm_people ORDER BY created_at DESC LIMIT 30` → sources: `expired-listing-cron` (stage Lead, `contact:do-not-call`), `ryan-realty.com` with `source:contact-form` or `source:idx-registration` (stage Nurture, tag `response-clock:untouched` on every one), `recruit:join` (Lead), `inbound-call` (Nurture). `assigned_broker = matt` on all 30. `custom->>'utm_source'` and `landingPage` null on all 30.
- `SELECT id, name, emails->0->>'value', … WHERE source IN (site sources) LIMIT 25` → names such as `wriGVtBlPLxMRdxYUpcvg`, `bJSKIwsurKTralgVeDiGblO`, `EXkQqQIiphkRmtSNFSBGgRnT`, `QKlvETWISqnRlVJW`; emails such as `k.el.v.f.ee@gmail.com`, `ny.s.h.ro.c.k@gmail.com`, `jordyaprobertsgxi97@gmail.com`, `francogaflatleycvp84@gmail.com`. All 25 have source `ryan-realty.com`.
- `crm_sequences` (7 rows): 1 Seller Master (active, 4 steps), 2 Buyer Master (active, 3 steps), 3 Expired (active), 4 FSBO (active), 5/6/7 paused. Buyer steps: 0 email "Your Bend home search is set, %first%" body "…Your listing alerts are live and the f…", 1 sms delay 30, 2 task confirm:true. Seller steps: 0 email "We have your home value request", 1 sms +30 with %cma_link%, 2 task confirm, 3 email confirm.
- `crm_sequence_enrollments … LIMIT 20` → 18 of 20 are sequence 2 with status `suppressed`, step_index 1; timeline row for 64105: `Sequence "Buyer Lead — Master Workflow" halted — suppressed (sms:no-sms-consent,…)`.
- `crm_broker_alerts … LIMIT 25` → all broker `matt`, all `sent` within ~30 s of `created_at`; bodies: "Untouched 1 day: <bot name> asked for to talk to a broker", "Untouched 11 hr 44 min: Lead jordyaprobertsgxi97@gmail.com asked for listing alerts", "New lead: bJSKIwsurKTralgVeDiGblO", "300 tasks need attention (299 overdue, 1 due today)", "[crm-health:inbound-webhook-stale] …", "CMA ready: 4337 Salmon, Redmond" (person 64108 = expired-listing-cron).
- Timeline of 64105 (contact form, 17:21:35.9): lead_created → note "Lead origin" (+1.4 s) → auto-enroll (+3.3 s) → `Stage: Lead → Nurture` (+4.1 s) → `email_out` "We got your note" initiator=system purpose=contact:confirmation (+5.4 s) → email_open/click (+13 s; a bot fetching links) → sequence `email_out` "Your Bend home search is set, bJSKIwsurKTralgVeDiGblO" (+7 min) → response-clock untouched-5m (+8.5 min) + broker alert → new-lead alert (+13 min) → sequence halted suppressed (+52 min). No human touch.
- Timeline of 64099 (alerts, 03:20:55): same shape; `custom.first_broker_action_at = 03:21:02`, `kind = email_out` — that is the system `alert:confirmation` email, stamped as the first broker action.
- Human touches (kind in call/voicemail/sms_out/mms_out/email_out, non-machine source, initiator≠system) `ORDER BY ts DESC LIMIT 20` → all 20 are Gmail-synced escrow/title threads on persons 9289/57300/6561/8183 plus one Twilio inbound call; none on a site lead.
- `sync_logs WHERE endpoint ILIKE '%crm%' OR '%enroll%' OR '%sequence%' OR '%alert%' LIMIT 40` → 0 rows (second shape after the specific-name query also returned 0). CRM crons do not log to `sync_logs`.
- Lanes counter-query (UNION of LIMIT subqueries): seller sources (`seller-lp`,`list-now-lp`,`place-page`,`home-valuation`) → 0 rows by `source`; by tag `source:seller-lp|place-page` → 63952 (2026-09-14, source "Website booking") and four `fleet:test` rows from `ryanrealty.vercel.app` (2026-09-08). `newsletter` → 0 rows by source and by tag. portal → last `realtor.com` 2026-08-01, `zillow` 2026-07-15. fb tags → 0 rows. `hot-anonymous` → last 2026-09-04. `website-signup` → 3 on 2026-09-15.
- `crm_tasks WHERE completed_at IS NULL ORDER BY due_at LIMIT 12` → `fub-import` tasks due 2025-10-27 and 2026-01-05 ("Add buyer, seller… tag for automation - see cheat sheet"), assigned rebecca/matt.
- `stage = 'lead'` → ids 63543-63545, `buyer-lp`, tags `test:email-harness`, 2026-08-25.

## 5. 30-day quantification (quantify.mjs, JS aggregation; window 2026-08-23..09-22)

- `crm_people` created ≥ d30, deleted=false: 287 rows read; 278 after excluding `fleet:test`.
  - bySource: expired-listing-cron 142 · ryan-realty.com 76 · inbound-call 34 · website-signup 9 · Manual entry 6 · buyer-lp 3 · fsbo-cron 2 · vault-deal 2 · Website booking 2 · hot-anonymous 1 · expired-outreach-queue 1.
  - byStage: Lead 161 · Nurture 113 · Engaged 1 · lead 3. byBroker: matt 277 · paul 1.
  - Site doors (88 rows carrying a site door tag): contact 47 · alerts 30 · join 7 · seller 2 · signin 1 · Website booking 1. Stage of those 88: Nurture 79 · Lead 8 · Engaged 1. `response-clock:untouched` on 75 of 88.
  - Bot heuristic (random-letter mixed-case name ≥12 chars with no spaces, or gmail local part with ≥3 dots, or ≥14 letters + 2-3 digits): 65 of 88 (74%). The 23 "human" rows are almost all alerts-lane emails (kwagnera@hotmail.com, marilynjessen03@gmail.com, chris@centralvalleycoalition.com, brett.whitney@pets-global.com …). The heuristic is a heuristic; the direction is not in doubt (see the name samples above).
- `crm_sequence_enrollments` created ≥ d30: 80 rows. sequence 2: suppressed 73 · running 2 · stopped 1 (74 at step 1, 2 at step 0). sequence 1: stopped 4 (all at step 0).
- `crm_broker_alerts` created ≥ d7: 253 rows, all `matt`, all `sent` → 36.1 per day. byKind: untouched 123 · new-lead 63 · cma-ready 24 · health 22 · reply 10 · task-digest 7 · looking-at 3 · other 1.
- Human touches on the 88 site leads (30 d): 160 outbound timeline rows read; 3 of 88 leads have a non-machine touch (1 email_out/app, 1 voicemail/twilio, 1 call/twilio, 1 email_out/gmail).
- `crm_tasks` open: 1,006 rows; overdue 1,005; byOrigin lp-form 507 · fub-import 251 · smart-followup 172 · twilio 41 · dual-write 23 · sequence 10 · app 2; byBroker matt 968 · rebecca 15 · null 23. (The daily digest text says "300 tasks need attention (299 overdue)" — which filter the digest applies is UNVERIFIED.)
- `listing_alerts`: 59 rows; active 54; origin/source user/idx-registration 50 · user/user 5 · broker/broker-assigned 3 · broker/neighborhood-default 1; created ≥ d30: 40; every row has `crm_person_id` and `last_notified_at`; 13 bot-heuristic emails.
- `newsletter_subscribers`: latest rows are `crm-bulk-assign` 2026-08-25 (5) and `test`/`one-off` 2026-07-30 (unsubscribed); created ≥ d30: 5, all `crm-bulk-assign`. No site-originated subscriber in 30 days.
- `valuation_requests`: 16 in 30 d; latest 6 = 2026-09-14 `https://ryan-realty.com/sell` (real) + 5 × `https://ryanrealty.vercel.app/sell` on 2026-09-08 (fleet tests).
- `marketing_brain_actions` (where `createCmaRequest` writes): 225 in 30 d; ready 165 · killed 50 · pending 9 · executed 1; latest six are the CMA requests for expired-listing-cron rows.
- `visitor_sessions` for 10 known site-lead ids: 12 rows; columns include `utm_source/medium/campaign/content/term, referrer, landing_page, gclid, fbclid, identified_via, crm_person_id`. Sample (64064): landing `/open-houses`, utm_source `direct`, identified_via `form_submit`; later sessions from alert emails (`utm_campaign=listing-alerts`, engagement 29). So first-touch attribution exists ONLY here, keyed by `rr_vid`, and `referrer` was null on every sampled row.

## 6. Lane-by-lane read

**Buyers.** Two real doors: the alerts sheet (/, /buy, /price-drops, listing "Watch") and the contact form (listing Tour/Ask lands here). The alerts lane is the only one producing plausible humans (alerts fire, people click back, engagement scores rise). Every buyer enrollment then dies at step 1 (SMS, no consent) — 73/76 in 30 d — so the confirm-task step that would put a real buyer on a broker's list never runs, and the one email they get claims "Your listing alerts are live" even when they came through the contact form.

**Sellers.** /sell, place pages, /housing-market, and the sticky "Value my home" ask (5-17 occurrences per page) produced 2 site seller people in 30 d (one real /sell submit on 2026-09-14). All 24 "CMA ready" texts in 7 d and every recent Seller-sequence enrollment are `expired-listing-cron` prospecting rows (outreach list, do-not-call tags, no auto-enroll). The seller lane's follow-up machinery is exercised by prospecting, not by site visitors.

**Broker-seekers.** No dedicated capture; `/join` sends to `/contact?inquiry=Join the team`; 7 in 30 d, sample names are bot strings; probe counts 4 join conversions in 7 d from the same rows. A recruit lands as stage Lead with `recruit:join`, no owner path beyond one "New lead" text.

**Broker attribution.** `?agent=` cookie works in code (`readAttributedAgentServer` in every door); in data, 277 of 278 arrivals are assigned to Matt.

**Follow-up.** The machine half works: confirmation email in ≤ 7 s, sequence email in ~7 min, broker text in ~30 s, response-clock at 5 min and 24 h, alert delivery 100% `sent`. The human half does not: 3 of 88 site leads touched in 30 d; 123 "Untouched" texts in 7 d; 1,005 overdue tasks. The rail is saturated by bot leads (74%), health alarms and task digests on the same phone.

## 7. Gaps and leaks list

1. Contact form: no honeypot, no rate limit, no captcha (`app/contact/actions.ts`). Alerts sheet: honeypot + limiter only; 13/59 alert emails look synthetic.
2. `sendEvent` drops `sourceUrl/pageUrl/message/campaign`; `crm_people.source` = host name for every site door; overwritten on re-touch; `source_url` column always null. Attribution survives only in `visitor_sessions` via `rr_vid`.
3. Stage advances Lead→Nurture on machine enroll (4 s); `custom.first_broker_action_*` is stamped by the system confirmation email.
4. Buyer sequence halts on the SMS step for everyone who did not tick consent; place-page passes `smsConsent:false` explicitly; alerts sheet passes nothing.
5. Buyer step-0 email says alerts are live to contact-form leads; subject merges the raw name.
6. Every 5-minute `lp-form` call task is created for bot leads too: 507 open.
7. Newsletter: zero site signups in 30 d; zero `source:newsletter` people. Whether the footer form is present/wired live is UNVERIFIED (page HTML contains the word once; not confirmed as a form).
8. Portal intake: nothing since 2026-08-01; Meta lead ads: no tagged rows at all. Whether feeds are intentionally off is a question for Matt.
9. CRM crons leave no `sync_logs` rows; `tmp/crm-e2e-latest.json` absent; Vercel logs not read (rule change) → cron error state UNVERIFIED.
10. Test residue: 3 `lead`-stage `test:email-harness` rows, 5 fleet-test valuation_requests from `ryanrealty.vercel.app`, 9 fleet:test people in 30 d (excluded by the probe, not by every count).
11. Docs drift: `docs/AUTH_AND_CRM.md` still describes `CRM_WEBHOOK_URL`/Zapier and `saved_searches`; `docs/MARKETING_LEAD_FLOW.md` Path D cites `submitExitIntentLead` (removed per `app/actions/lead-capture.ts:72-74`) and Path C `/home-valuation`; `join-the-brokerage.md` D1 is partly fixed by `tagRecruitJoin`.

## 8. The three-lane funnel: as it is vs as it should be

As it is: one host-labelled source, one broker, one alert phone, one buyer drip that stops after one email, a seller ask on every page that nobody organic answers, and a bot flood that makes the real handful invisible.

As it should be (shortest list): (1) bot gate on the contact form + suspect-tag quarantine so bots never enroll, never text, never task; (2) first-touch `{door, landing_page, referrer, utm}` frozen on the person at create, `source` = door; (3) sequence engine skips a suppressed channel step instead of halting, so the broker task fires; (4) stage advances on a human action or a reply, not on machine enroll; (5) one text per real lead, health/task noise off the lead rail, routing to the three brokers; (6) weekly scoreboard rows: site leads by door, bot-filtered, human-touched-within-5m %, seller submits, alerts created.
