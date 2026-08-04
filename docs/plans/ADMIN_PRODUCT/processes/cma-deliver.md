# Process: cma-deliver — CMA request → build → review → send

## 0. Meta
- Status: deepened
- Cadence: event-driven (several/week); LITMUS ANCHOR — notification → kickoff ≤3 taps / ≤30s broker-action
- Verdict: KEEP (proposed; P3 decides) — Matt Q1: seller/valuation request is the #1 wake-up
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
A seller asking "what's my home worth" gets a broker-reviewed, accuracy-gated valuation document delivered fast, with the broker doing minutes of judgment work, not hours of assembly.

## 2. Inception (what starts it)
- Trigger type: inbound event | broker action
- Concrete triggers:
  - Seller LP submit → `createCmaRequest` — `app/lp/seller-home-value/actions.ts:611-629`
  - Meta seller lead with address — `lead-webhook/route.ts:631-652`
  - Broker kickoff from person record (`?intent=cma` auto-opens sheet — `CmaKickoffMount.tsx:38`) → `kickoffCmaForContactAction` (`app/actions/crm-cma-kickoff.ts:15-48`) → `kickoffCmaCore()` (`lib/crm/cma-kickoff.ts:98-278`)
  - `/admin/cmas/new` manual form; prospecting doc builds reuse the same engine (`buildProspectDoc` → `buildCma`, docType `expired-audit`/`cma`)
- Preconditions: address with parseable city (kickoff refuses without — `cma-kickoff.ts:113-125`); idempotency key; no existing reviewable doc unless `buildNewVersion:true` (`:176-223`).
- Entry evidence: `lib/cma-request.ts:116-480`; `cmas` row (`status:'draft'`, `html_path:'pending:<slug>'` — `:240-255`); `marketing_brain_actions` `content:cma` row (`:268-339`, open-row unique index attaches collisions to the existing action `:341-395`).

## 3. Actors
- Human: signing broker (review + approve + send) — accountable. Broker resolution defect: `resolveBrokerSlug()` (`lib/cma-request.ts:90-114`) always falls to `CMA_DEFAULT_BROKER_SLUG` (Matt) — TODO at `:98-100`, per-lead assignment unresolved.
- Automated: cma-build-worker cron (14,44 * * * *), `buildCma()` engine, judge/audit/accuracy gates, ready-notify SMS.
- Client: receives the doc; their page views tracked.

## 4. Systems of record
- `cmas` — the document (html_content stored IN DB — `html_path:'db:cmas.html_content:<slug>'`, `lib/cma/build.ts:666-702`); `cma_comps` (`replaceCmaComps` `:707-721`).
- `marketing_brain_actions` — build-job lifecycle. `crm_timeline` — send event (`email_out`, dedupe `cma:sent:<slug>:<ts>` — `lib/cma/send.ts:383-396`).
- NOT SoR: the RETIRED legacy pipeline (`lib/cma-delivery.ts:1-13` "do not add new callers"; `cma_deliveries` table + 3 live routes kept only for pre-cutover rows).

## 5. End-to-end path (inception → completion)
1. **Request lands** · system/human · `createCmaRequest` writes draft slot + action row (never clobbers non-draft — `onlyWhenStatus:'draft'`) · failure: collision attaches to open action · n/a
2. **Broker notified (kickoff origin)** · system · alert deep link `?intent=cma` (broker-alert §5.10) · **phone** · LITMUS entry
3. **Kickoff (broker origin)** · human · sheet on person record; requires address+city; `withSendIdempotency` (`cma-kickoff.ts:133-140`); joins open build's `notify_broker_sms` if one exists · **phone, ≤3 taps target**
4. **Worker claims** · system · drains ≤3 open actions/run; clobber guard kills if row no longer draft (`worker.ts:94-102`); `in_production` (`:107-110`) · failure: retry to `MAX_ATTEMPTS=3` then `killed` (`:196-211`) · n/a
5. **Build** · system · `buildCma()` (`build.ts:119-747`): comps (fail if `<MIN_COMPS` `:173-189`) → LLM comp judge (fail-open `:205-236`) → adjust/price (`:242-274`) → adversarial `auditCma` + one self-repair (`:280-322`) → accuracy contract (hard violations KILL; review violations set `needsReview` `:340-366`) → brand-voice gate (throws-closed `:449-464`) → render (`:500`) · failure: `recordBuildFailure` stamps `build_error`, status unchanged (`:97-117`) · n/a
6. **Ready-notify** · system · action `ready`; `queueCmaReadyAlert` texts `/admin/cmas/<slug>` (canonical host hardcoded — vercel.app strips auth cookies) (`worker.ts:139-156`; `broker-alerts.ts:203-221`) · **phone**
7. **Review + approve** · human · `/admin/cmas/[slug]`; `approveCmaAction` refuses if `needs_review` unless explicitly acknowledged (`cma-admin.ts:186-220`) → `finalized` · desktop-shaped today · failure: silent abandonment (draft sits; no nag)
8. **Prepare + send** · human · `prepareCmaSendAction` preview (`:315-352`); `sendCmaToLeadAction` → `sendCmaToLead()` (`send.ts:304-398`): requires finalized/delivered + client email; suppression fail-closed (`:308-315`); PDF ≤25MB (`:317-328`); Gmail DWD from signing broker's mailbox, Resend fallback (`:343-378`) → `delivered` + `delivered_at` (`:382`) · either device
9. **Client views** · client · `/cma/[slug]` serves `html_content`; non-admin 404 unless finalized/delivered (`route.ts:44-57`); `rr-doc-tracker.js` posts page_view + identity (`:68-75`) · no expiry (status-gated, permanent)
10. **Outcome measured** · system · CMA performance report (`getCmaPerformance`); send→convert stats · n/a

## 6. Decision points
- Existing reviewable doc? → refuse rebuild unless `buildNewVersion:true`.
- `<MIN_COMPS` / hard accuracy violation / banned word? → build fails (accuracy outranks delivery — §0).
- `needs_review`? → approval requires explicit acknowledgment.
- Suppressed client? → send blocked (fail-closed).
- 3 build failures or clobber → `killed`; **no retry UI** — a fresh request is the only path (defect).
- Origin decides notify channel: LP → email flow; crm-kickoff → broker SMS only (`notifyLead:false` — `cma-kickoff.ts:225-240`).

## 7. Completion
- Done-when: `delivered` with timeline event, or broker abandoned (draft/finalized shelf), or `killed`/`archived` (reversible — `unarchiveCmaAction` `cma-admin.ts:248-264`).
- Artifacts: cmas row + comps + citations + build_summary; timeline event; tracker views.
- Signals: ready-notify SMS; `alreadySent` guard in send preview.
- Terminal states: `delivered` (practical success) · `archived` (shelf) · action `killed`.

## 8. Time & SLA
- Stated SLA: `predicted_outcome.sla:'1 business day'` (`cma-request.ts:335`) — advisory, NOT enforced by any timeout/alert (defect).
- Build latency: ≤30 min to worker pickup + build time. Broker-action budget: LITMUS ≤3 taps/≤30s for kickoff; review+send has no budget today.
- "Late": invisible — no draft-aging surface, no SLA breach alarm.

## 9. Variants
- docType: `cma` (seller) · `expired-audit` (prospecting) · BPO is a SEPARATE parallel process (bpo-deliver) sharing the engine pattern.
- Origin: LP · Meta · crm-kickoff · manual form · prospecting build. Same engine; notify behavior differs by origin. No split.

## 10. Current implementation map
- Routes: `/admin/cmas` (+`[slug]`, `/new`); public `/cma/[slug]`; person-record kickoff sheet.
- Crons/libs: cma-build-worker; `cma-request.ts`, `cma/build.ts`, `cma/worker.ts`, `cma/send.ts`, `crm/cma-kickoff.ts`.
- Known defects: (a) broker assignment TODO — everything signs as Matt; (b) killed builds unrecoverable from UI; (c) `cmas.build_state` column orphaned (constraint exists, no writers on CMA path — migration `20260725150000`); (d) retired legacy pipeline still live for old rows (`cma_deliveries` + 3 routes); (e) no SLA enforcement/draft-aging.
- Duplicate paths: legacy delivery pipeline (retired-but-live).

## 11. Target shape (process-level, not pixels)
- Should exist: YES — litmus anchor.
- Ideal: kickoff→delivered visible as ONE worklist with age + SLA state; review possible on phone; killed builds retryable in place; signing broker = assigned broker (fix the TODO); legacy pipeline fully retired.
- Data gaps: SLA/aging stamp surfaced; broker assignment; build_state either wired or dropped.
- UI destination implication: one CMA worklist destination (shared shape with BPO + prospecting docs — all `buildCma` products).

## 12. Acceptance checks
- [ ] LP submit with address → cmas draft + open `content:cma` action within 60s; duplicate submit attaches, not dupes.
- [ ] Worker run → draft built with comps ≥ MIN, citations present, status still `draft`, action `ready`, kicking broker got SMS with working authed deep link.
- [ ] `needs_review` doc → approve refused without acknowledgment; with ack → `finalized`.
- [ ] Send to suppressed email → blocked; to clean email → `delivered`, timeline `email_out` row, client URL 200, tracker fires page_view.
- [ ] Non-admin fetch of a `draft` slug → 404.
- [ ] TIMED (P8 re-prove): alert SMS → person record → kickoff sheet → confirmed request in ≤3 taps / ≤30s.
- [ ] Force 3 build failures → action `killed`; document the no-retry gap until fixed.
