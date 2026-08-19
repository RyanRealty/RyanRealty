# Process: lead-ingress — Lead becomes a person

## 0. Meta
- Status: deepened
- Cadence: continuous (system); broker touches it only through downstream processes
- Verdict: KEEP (proposed; P3 decides) — every dollar the response half earns enters here
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
Any human raising a hand anywhere (form, ad, text, portal email, saved search, sign-in) becomes exactly one `crm_people` row with contact points, provenance, and the right downstream reactions fired — instantly and idempotently.

## 2. Inception (what starts it)
- Trigger type: inbound event (8 doors, all system-initiated)
- Concrete doors, each with entry evidence:
  1. LP form — `app/lp/seller-home-value/actions.ts:376` → `sendEvent('Seller Inquiry')`; native fallback `:419` → `ensureNativeLead()`
  2. Meta Lead Ads webhook — `app/api/meta/lead-webhook/route.ts:752-806` (signature verify `:92-125`, `after()` processing `:782`; `createLeadContact()` `:420-498`; dedup `processed_meta_leads` `:511-525`)
  3. Inbound SMS from unknown number — `inbound-sms/route.ts:156-160` → `findOrCreatePersonByPhone()` (`lib/data/crm/findOrCreatePersonByPhone.ts:61,96,107`)
  4. Portal lead email (Zillow/Realtor.com) — `crm-portal-lead-intake/route.ts:94-151` (Gmail scan → `crm_imports` → person)
  5. Saved-search / alert signup — `app/actions/search-alert-capture.ts:103`, `app/actions/saved-searches.ts:182` → `sendEvent()`
  6. Sign-in/sign-up capture — `lib/crm/send-event.ts:147-176` `trackSignedInUser()` → `ensureNativeLead()` `:171`
  7. FSBO detection — `lib/fsbo-processor.ts:66-90` (creates person + task + CMA)
  8. CSV import wizard — `/admin/crm/import*` via `app/actions/crm-import` (createImportJobAction → map → preview → start)
- Preconditions: at least one contact point (email or phone). Postconditions guaranteed by the core (below).

## 3. Actors
- Human: the lead; broker only for CSV import.
- Automated: `sendEvent()` (`lib/crm/send-event.ts:101-136` — name is legacy; it routes to the in-house CRM), `ensureNativeLead()`, webhook handlers, intake crons.
- Accountable: system; Matt as PB for routing rules (`/admin/crm/settings/assignment`, `lead-flows`).

## 4. Systems of record
- `crm_people` — the person. `crm_contact_points` — emails/phones (lookup keys). `crm_timeline` — origin note (`enrichNativeLead` `:387-395`). `crm_tasks` — hot-lead 5-min task (`createNativeTask` `:418-438`). `processed_meta_leads` — webhook dedup. `crm_imports` — import/intake job ledger.
- NOT SoR: FUB (decommissioned 2026-06-24 — `sendEvent` name is vestigial); GA4/visitor sessions (attribution evidence, not identity).

## 5. End-to-end path (inception → completion)
1. **Door receives raw contact** · system · door-specific validation (Meta signature, Twilio signature, form validation) · failure: rejected/ignored · n/a
2. **Normalize + route to core** · system · every door lands on `ensureNativeLead()` directly or via `sendEvent()` · `lib/crm/send-event.ts:129` · n/a
3. **Identity resolution** · system · email-first then phone lookup on `crm_contact_points` (`ensureNativeLead.ts:139-149`); `decideNativeLeadAction` (`:86-111`) picks create vs reuse · → identity-dedup PDS · n/a
4. **Create or enrich** · system · create: insert `crm_people` `:221-225` + contact points `:233-240`; reuse: `mergeReuseEnrichment` `:266-309` unions tags/source/broker · failure: partial insert (person without points) would strand — idempotency via lookup keys · n/a
5. **Enrichment + provenance** · system · `enrichNativeLead()` `:338-400` — tags union, `custom` jsonb merge, `assigned_broker` set `:371-381`, origin note `:387-395` · n/a
6. **Hot-lead task** · system · `createNativeTask()` `:418-438` → 5-min task in `crm_tasks` · n/a
7. **Broker assignment** · system · `assigned_broker` from door context (dialed line, `?agent=` attribution cookie via `readAttributedAgentServer()`, routing rules) · failure class: `assigned_broker` scattered across people/conversation/tasks/deals/alerts (Phase-0 Q4 — 6 role dead-ends) · n/a
8. **Downstream fan-out** · system · `autoEnrollByFubId()` (LP `:604-609`, Meta `:621-624`) → sequence-run; `queueBrokerAlert` → broker-alert; seller+address → `createCmaRequest` (`:611-629`, Meta `:631-652`) → cma-deliver · n/a
9. **Sweep backstop** · system · `crm-auto-enroll` scans 7-day trailing `crm_people` for missed fan-out · `route.ts:63-72` · n/a

## 6. Decision points
- Existing identity? → enrich, never duplicate (3–4).
- Seller intent + address? → CMA request too (8).
- SMS consent absent? → `no-sms-consent` suppression at enroll (sequence-run §2).
- Broker's own cell texting in? → agent branch, never a lead (`inbound-sms:128-144`).
- Meta lead already processed? → dedup drop (`:511-525`).
- Import row conflicts? → wizard preview stage resolves before start.

## 7. Completion
- Done-when: person exists with ≥1 contact point, origin note, assigned broker, and every applicable downstream fired (task, alert, enrollment, CMA request).
- Artifacts: rows in §4 tables.
- Signals: broker-alert (its own process); dashboard recent-leads.
- Terminal states: created · enriched-existing · rejected-at-door (invalid/forged) · agent-branch-dropped.

## 8. Time & SLA
- Door → person: real-time (webhooks, forms, SMS); portal email ≤ 15 min; FSBO daily.
- Fan-out: instant inline; sweep catches misses ≤ 15 min later (7-day window).
- "Late": a lead with no first touch — surfaced by speed-to-lead report; the 5-min task encodes the intended SLA.

## 9. Variants
- 8 doors (above) sharing one core. Only door-specific stages differ; NO split — the shared core is the process. CSV import is the one broker-driven variant (bulk, preview-gated).

## 10. Current implementation map
- Routes: `/admin/crm` (list), `/admin/crm/new`, `/admin/crm/import*` (5), settings: assignment, lead-flows, ponds, brokers.
- Actions/crons: per §2; `crm-geo-resolve` cron backfills neighborhood/subdivision on people (`route.ts:50,73`).
- Known defects: (a) `sendEvent`/FUB naming throughout live code (vocabulary debt, breeds "two CRMs" confusion); (b) `assigned_broker` scatter (Q4); (c) door inventory has no single registry — each new LP must remember the fan-out (auto-enroll sweep is the only backstop).
- Duplicate paths: none live (console/people bridges are redirects).

## 11. Target shape (process-level, not pixels)
- Should exist: YES — but as background automation, not a destination.
- Ideal: one documented door registry; fan-out declared per door; assignment resolved in ONE place; FUB vocabulary retired from code paths.
- Data gaps: unified `assigned_broker` semantics; door-level ingress metrics (per-door conversion, currently reconstructed in analytics).
- UI destination implication: NO daily destination. People list is a lookup tool (Matt Q2: not weekly), not a worklist.

## 12. Acceptance checks
- [ ] Same email through 2 different doors → ONE person, provenance unioned, no dupe.
- [ ] LP submit → person + contact point + origin note + task + enrollment + alert, all within 60s (SQL per table).
- [ ] Meta webhook replay (same leadgen id) → no second person (processed_meta_leads holds).
- [ ] Unknown-number SMS → person created with phone point; broker alert queued.
- [ ] Import wizard 100-row CSV with 10 dupes → 90 creates, 10 enrichments, ledger accurate.
- [ ] Kill inline enrollment (feature-flag a door) → sweep enrolls within 15 min.
