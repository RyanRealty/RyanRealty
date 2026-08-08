# Data Atlas — writer → store → reader → outcome chains (P4)

Status: draft-complete 2026-08-04. Scope: KEEP processes only (process lock 2026-08-04).
The 4 true MERGEs are folded into their targets (visitor-escalate→broker-alert,
bpo-deliver→cma-deliver, data-curate→sync-ops, deal-track→tc-close). weekly-sla-review
keeps its own chain; its destination is a P5 decision. Evidence: PDS files in
`processes/` (file:line-cited) + the four P4 investigations recorded at the bottom.
No new schema is proposed except where a chain FAILS (marked ✗); those are gap
statements, not designs.

Chain notation: `writer → store → reader → human outcome`. ✓ chain holds · ✗ chain broken.

---

## 1. broker-alert (incl. visitor-escalate fold)

- ✓ Ingress producers (`queueBrokerAlert`) → `crm_broker_alerts` + `crm_timeline` dedupe row → `crm-alert-drain` (whitelist, CAS claim) → SMS/push in broker's hand with deep link.
- ✗ Gate-drops: opt-in/no-device drops → NOWHERE → invisible. GAP: no drop record (blocks alert-integrity claims; litmus-adjacent).
- ✗ Latency: `sent` stamp exists but no first-broker-action stamp → alert→action latency unmeasurable. GAP (litmus measurement needs it).
- FOLD (visitor-escalate): hot-session scorer → `crm_tasks` + Resend email → Matt only. Post-merge chain: scorer → `queueBrokerAlert(kind:visitor-hot)` → same store/drain/read as above. Today's rail bypass is the defect, not a missing store — no schema needed.
- LOCKED directive (2026-08-04): supervision/health alarm kinds leave this rail → supervision view + digest (chain 10).

## 2. inbound-respond

- ✓ Twilio POST → `crm_timeline` (`sms_in`, sid-deduped) + conversation shadow (`recordConversationMessage`) + unread flag → inbox queue / person thread / dashboard triage → broker reads in context.
- ✓ Reply: composer → `sendGovernedSms` (guards→idempotency) → Twilio + `crm_timeline` `sms_out` + shadow → thread updated; engine's stop-on-reply reads the same timeline → `paused_reply`.
- ✓ Email: Gmail ↔ `crm-gmail-sync` → `crm_timeline` `email_in/out` (≤15 min lag) → inbox.
- ✗ Reply-on-existing-thread → cell-forward only → no alert row → no delivery guarantee, no deep link. LOCKED directive: joins the wake rail — the store (`crm_broker_alerts`) already fits; the missing piece is the producer call, not schema.
- ✗ Reply latency: inbound stamp exists, reply stamp exists, nothing computes/stores the interval per thread. GAP (feeds chain 12).

## 3. cma-deliver (incl. bpo-deliver fold; LITMUS)

- ✓ Request: LP/Meta/kickoff → `cmas` (draft slot, version chain) + `marketing_brain_actions` `content:cma` (open-row unique index) → worker claim.
- ✓ Build: `buildCma` → `cmas.html_content` + `cma_comps` + citations + build_summary → review page → broker judgment.
- ✓ Send: `sendCmaToLead` (suppression fail-closed) → Gmail DWD/Resend → `delivered` + `crm_timeline` + doc-tracker page_views → measurable outcome (`getCmaPerformance`).
- ✗ Signing broker: `resolveBrokerSlug` env-default → every doc signs Matt. LOCKED directive: assigned broker signs. Chain fix is writer logic (resolve `crm_people.assigned_broker` at request time) — columns exist, no schema needed.
- ✗ Killed builds: action `killed` → no reader offers retry → dead end requiring a fresh request. GAP (worklist affordance, not schema).
- ✗ SLA: `predicted_outcome.sla` written → nothing reads it → aging invisible. GAP.
- `cmas.build_state`: constraint live, zero writers/readers on the CMA path → orphan; wire or drop at P7 cleanup.
- FOLD (bpo-deliver): same engine family → `broker_price_opinions` + tracked `/bpo` docs. Post-merge: one valuation worklist reads both stores (or one store, two docTypes — P5/P7 call); no blocking gap.

## 4. prospecting

- ✓ Detect: deltaSync execute-mode → `expired_listings` (dedup on listing_key) / fsbo cron → `fsbo_listings`; skip-trace inline → owner contact + compliance flags on the row + tags on `crm_people`.
- ✓ Work: `listProspects` buckets (sent/needs-audit/no-phone/sendable/excluded) → weekly pass.
- ✓ Send: guard chain → claim RPCs (`prospect_send_claim` / email twin, durable at-most-once) → Twilio / `sendCmaToLead` → `outreach_*_status='sent'` + `crm_timeline` → first-touch truth.
- ✓ Inbound loop: `/lp/expired-listing` form → `crm_people` (tags, CMA queue, hot task) → response half takes over.
- ✗ `fsbo_listings.status='off_market'`: readers exist (`compliance.ts:204`), writers ZERO → exclusion branch dead. GAP: one writer missing (detect pass should set it) — justified fix, no new schema.
- ✗ Staleness: no last-reviewed/aging stamp → "what's new since my last pass" unanswerable. GAP (P5 surface need; could derive from `first_seen_at` without schema).

## 5. suppression-guard

- ✓ Keywords/UI/enroll-consent → `crm_suppressions` (channel+reason) → `isSuppressed` (fail-closed) inside every governed send path → block/allow with artifact status.
- ✓ A2P: Twilio status → engine gate → visible queue rows on non-VERIFIED. Quiet hours: pure function, no store.
- ~~✗ Group MMS path: inline suppression only, bypasses `sendGovernedSms` idempotency → double-send window.~~ **CORRECTED + CLOSED 2026-08-07.** The original reading was wrong in one direction and right in another. It is TRUE that the group branch never calls `sendGovernedSms` — a carrier group is not person-keyed. But it is NOT unguarded: it runs `requirePersonInScope` and a fail-closed `isSuppressed` per member, quiet hours are checked once for the whole action (`crm.ts:792`, above the branch), and the branch sits INSIDE `performSend`, which the action wraps in `withSendIdempotency`. So there was no blanket bypass. The REAL window was narrower: `SmsComposer` renders `idempotencyKey` blank on SSR and first paint (a value there would be a hydration mismatch) and fills it after mount, and the action read `if (!idempotencyKey) return performSend()` — so a submit landing before hydration reached Twilio with no ledger row, and server-action forms post without JS. Closed by deriving a fallback key from the send itself (primary person + body + recipient ids + phones + attachments + a 60s bucket); the unwrapped branch is gone, so every send now holds a lease.
- ✗ Block reasons outside sequences (manual/bulk drops) → log lines only, no queryable row. GAP: per-attempt block ledger missing — blocks send-integrity auditing. Minimal fix is a reason column/row on existing artifacts, flag for P7.

## 6. sequence-run

- ✓ Enroll: doors → `crm_sequence_enrollments` (eligibility gates) → engine (lease) → `crm_sequence_sends` claim (unique enrollment+step) → Gmail/Twilio → `crm_timeline` mirror → touches delivered.
- ✓ Parked: `awaiting_broker_next` → **RESOLVED P4: visible** via broker-dashboard "Needs your action" (`getBrokerActionQueue` — `app/actions/crm.ts:1739`, confirm/skip at `:1869`) and person right-rail (`getContactActionPlanProgress`). Corrects the P2 gap-candidate.
- ✗ Residual visibility gaps: `getWorkflowAnalytics` computes `awaitingBroker` and the sequences page DISCARDS it (`page.tsx:165-186`); `daily-broker-digest` cron reads it but is UNREGISTERED (orphan baseline). GAP: monitoring surface (Matt's weekly job) still lacks the ran/broke/parked rollup — data exists, projection missing.

## 7. lead-ingress

- ✓ 8 doors → `sendEvent`/`ensureNativeLead` → `crm_people` + `crm_contact_points` + `crm_timeline` origin + `crm_tasks` hot task → fan-out (enroll, alert, CMA) → sweep backstop.
- ✗ Door registry: fan-out is convention per door, recorded nowhere → each new LP must remember; only the sweep catches misses. GAP (doc/registry, not schema).
- ✗ `assigned_broker` scatter (Q4): person, conversation, tasks, deals, alerts each carry their own → role dead-ends. GAP: one resolution rule needed; columns exist, semantics don't. Blocks correct scoping in every downstream chain.

## 8. identity-dedup

- ✓ Contact point → email-first/phone lookup → create or `mergeReuseEnrichment`; manual merge → `mergePeopleCore` (the ONE path) → children re-pointed.
- ✗ Dupe candidates: cross-channel conflicts (email→A, phone→B) → no store, no queue → invisible until a human stumbles on them. GAP: candidate table justified (KEEP process cannot be correct without detection — compliance follows identity).
- ✗ Merge audit: no confirmed audit row for merges. GAP (verify at P7; likely a small ledger).
- ? Create transactionality (person insert then points insert): unverified failure window — flagged for a targeted test at P8, not schema.

## 9. content-approve

- ✓ Brain/inbox/agent → `marketing_brain_actions` (status machine) → runtime builds + QA → `ready` → queues → stamp → publisher-sweep → `executed` → performance pulls → `measured`; costs in `marketing_cost_ledger`; agent trail in `broker_agent_turns`.
- ✗ Approval latency: `ready` timestamp exists, stamp time not stored distinctly → aging invisible. GAP (derivable from status history if kept; verify at P7).
- ✗ Two queues read the same store (`/admin/approval-queue` raw client, `/admin/crm/approvals` actions) → divergence risk. P5 collapses the surface; no schema.

## 10. sync-ops (incl. data-curate fold)

- ✓ Fleet writes (`sync_state`, `sync_logs`, MV refreshes, cache tables) → checkers (crm-health-check, loop-health-check, market-stat-consistency, deploy-health) → alarms → broker.
- ✗ Accepted-issue ledger: none → repeat alarms indistinguishable from new. GAP.
- ✗ FOLD (data-curate) — **CHAIN BROKEN, resolved P4:** broker edit → `updateAdminEditableListingRow` writes `ListPrice`/`StandardStatus`/`details` (remarks, admin_overrides) DIRECTLY onto `listings` → next delta sync rebuilds `details` from Spark with NO merge (`sparkToListingRow` — `lib/listing-mapper.ts:419-467`) and flat-upserts (`syncWrites.ts:104-116`) → **edit silently reverts** on any active listing whose ModificationTimestamp advances. Survives only if `is_finalized` (sync skips — `deltaSync.ts:219-223`) or the field is `media_suppressed` (own column, never in the sync payload). GAP JUSTIFIED (KEEP process cannot be correct): admin overrides need a sync-proof home — either an overlay the read path merges, or the sync upsert must exclude/merge admin-owned keys. Schema/code decision at P7; the atlas only records the failed chain.
- LOCKED directive: supervision alarms land here (view + digest), off the wake rail.

## 11. listing-alert-care

- ✓ Signup → `listing_alerts` (criteria+geo+cadence) + person via lead-ingress → hourly scan → event detect → Resend send → `email_events` → engagement back to person.
- ✗ Send-then-mark: `markListingAlertNotified` after send; failure = duplicate next run (logged loudly, not prevented). GAP: needs claim-before-send or transactional mark — same at-most-once pattern prospecting already has (`prospect_send_claim`) — justified fix.
- ✗ Approval backlog aging: pending groups have no age surface. GAP (projection).

## 12. weekly-sla-review

- ✓ Feeder chains: `crm_timeline` → speed-to-lead/agent reports; `crm_tasks` → overdue; enrollments → parked (chain 6). All broker-scoped.
- ✗ Review ledger: the ritual writes NOTHING → done vs skipped indistinguishable. GAP: one stamp row (justified — completion criterion of the process is otherwise unobservable).
- ✗ Missing feeds: unanswered-inbound >Nh (derivable from timeline, no reader computes it) and reply-latency (chain 2 gap). Projections, not schema.
- Destination: P5 decision (registry note stands).

## 13. reporting-truth

- ✓ DAL fns = definitions → caches → report pages/digests; `market-stat-consistency` cross-checks daily.
- ✗ One definition, N renders: `getLeadIntake` ×5; builder ×3; 6 analytics pages bypass the DAL entirely (raw `createClient`) → untraceable figures. GAP: definition registry + DAL migration of the 6 pages (P7/P9 work; no new schema).
- ✗ Digest/page parity unverified: digests compute independently → drift possible. Acceptance check exists (PDS §12).

## 14. newsletter-run

- ✓ Draft (monthly cron/manual) → audience build FAIL-CLOSED (cohort read error aborts) → send queue → drain (*/2, re-checks suppression at send) → reconcile (finalize/reset/flag) → `email_events` + delivery summary + postmaster metrics. Healthiest chain in the admin; no blocking gaps.
- ✗ Audience doors ×3 (newsletters/subscribers, crm/subscriptions, settings/segments) → one concept, three writers. P5 surface collapse; stores are consistent underneath.

## 15. market-report-deliver

- ✓ Weekly build (§0-gated pipeline) → `market_reports` + Storage → cadence matcher (4×/day) reads `crm_report_subscriptions` → suppression-gated send → `email_events`; per-person rollup exists (`getContactReportSubscriptions`).
- ? Latest-vs-dated semantics on a skipped build week: unverified — flagged for a targeted check at P8 (does the cadence send re-send the stale report or skip?). Not schema.

## 16. tc-close (incl. deal-track fold)

- ✓ TC core: deal facts → `tc_deals` (uuid, `property_key`) → `tc_cycles` (jsonb buyers/sellers, FK deal_id) → `tc_documents`/`tc_checklist_items`/`tc_events`; envelopes → sign → seal; commissions per cycle; PB sign-off queue. Vault is SoR (§8).
- ✗ **RESOLVED P4 — no CRM↔TC bridge exists:** `crm_deals` has `person_id` + `crm_deal_people` junction + free-text `assigned_broker`/`listing_key`; `tc_deals` has only `property_key` + DEAD `fub_person_ids` (FUB decommissioned; resolved nowhere); `tc_deal_contacts`/`tc_cycles` parties are unlinked jsonb/rows with no `crm_people` FK; zero code paths connect the stores (grep-proven both directions). GAP JUSTIFIED by the one-deal-entity lock: needs a net-new bridge (FK direction TBD), a contact-resolution step (tc parties → `crm_people` by email/phone via the identity core), and ONE stage vocabulary (both are free text today). Design lands with P5 IA + P7; the atlas records the missing link only.
- ✗ **Third store discovered:** `/admin/deals` dashboard (`getDealDashboard` — `app/actions/deals.ts:123,137-138`) reads `skyslope_transactions`/`skyslope_dashboard_meta` — the pre-Vault legacy mirror — NOT `tc_deals`. The TC landing page renders legacy-mirror data while detail pages read `tc_deals`. GAP: dashboard must move to `tc_deals` (and both TC readers live in `app/actions/`, not `lib/data/` — DAL migration flag for P7).
- ✗ PB sign-off backlog → no supervision-class signal → feeds chain 10's view (projection).

## 17. site-content-ops (thin)

- ✓ Blog/guides/help/media/settings: CRUD → Supabase rows/Storage → live site (ISR) → published. Banner scan→generate closed loop.
- ✗ **RESOLVED P4 — place copy:** pipeline regenerates cities (3/run) + neighborhoods (5/run) UNCONDITIONALLY weekly (Sun 4am, not nightly — `vercel.json:82-85`); communities alone have a skip-if-present check (`place-content-pipeline.ts:246,254`); **no admin UI edits these columns and no manual-edit marker exists** — the P2 clobber concern resolves to "there is nothing to clobber; manual editing is impossible." GAP only IF manual place-copy editing becomes a requirement (then: marker column + skip logic). Not blocking; P5 decides whether the surface should exist.
- ✗ No post-publish verification loop (projection/check, not schema).

---

## P4 investigation record (the four unknowns — resolved 2026-08-04)

1. **Listing-edit sync survival: NO for every editor field except `media_suppressed`; YES once finalized.** Mechanism: `sparkToListingRow` rebuilds `details` with no merge + flat upsert; `is_finalized` rows skipped; `media_suppressed` never in the sync payload. (Chain 10 ✗, evidence cited there.)
2. **`awaiting_broker_next` visibility: VISIBLE** on broker-dashboard action queue + person right-rail; sequences page computes-and-discards; digest cron unregistered. (Chain 6.)
3. **Place-copy precedence: unconditional overwrite for cities/neighborhoods, skip-check for communities, and no manual surface exists at all.** (Chain 17.)
4. **CRM↔TC link: none exists; plus `/admin/deals` reads the legacy SkySlope mirror, not `tc_deals`.** Minimal merge needs: bridge FK, party→person resolution, one stage vocabulary. (Chain 16.)

## Gaps that block LITMUS or send integrity (rollup)

- **Send integrity:** ~~group-MMS idempotency bypass (5)~~ **CLOSED 2026-08-07 — and the finding was partly mis-stated; see §5** · listing-alert send-then-mark duplicate window (11) · FSBO off_market dead branch (4) · per-attempt block ledger absent (5).
- **Litmus:** alert drop invisibility + no alert→action latency (1) · CMA signs as wrong broker (3) · killed-build dead end (3).
- **Correctness substrate:** listing-edit revert (10) · no CRM↔TC bridge + legacy-mirror dashboard (16) · `assigned_broker` scatter (7) · dupe-candidate blindness (8).

PDS corrections recorded this pass: sequence-run §7/§10 (parked visibility better than assessed); deal-track/tc-close (third store: `skyslope_transactions` behind `/admin/deals`).
