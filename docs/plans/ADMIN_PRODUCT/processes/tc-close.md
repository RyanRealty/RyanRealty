# Process: tc-close — Transaction coordination to close

## 0. Meta
- Status: deepened
- Cadence: event-driven (per accepted offer; weeks-long lifecycle each)
- Verdict: KEEP (proposed; P3 decides) — real money, real compliance, live engine (TC e-sign shipped — memory)
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
An accepted offer becomes a closed, compliant Oregon transaction: documents anticipated and executed, signatures sealed, commissions computed, principal-broker oversight recorded.

## 2. Inception (what starts it)
- Trigger type: broker action (accepted offer)
- Concrete: TC deal created → `/admin/deals` dashboard (`getDealDashboard`); detail `[key]` composes `getTcDeal`, `getAnticipatedDocuments`, `getDealContacts`, `getCommissionsForCycles`, `getEnvelopesForCycle`.
- Preconditions: deal facts (property, parties, price, dates); broker access scoped (memory: each broker sees own deals; Matt all).
- Entry evidence: TC DAL functions above; e-sign engine (envelope→sign→seal→notify — memory: project_tc_esign_shipped); smart-docs anticipation (memory: project_tc_smart_docs).

## 3. Actors
- Human: listing/buyer broker (owns the deal), clients + other parties (sign), Matt as PB (sign-off queue — `getPrincipalSignOffQueue`). Accountable: deal broker; PB for supervision.
- Automated: anticipated-docs engine, envelope engine (tokenized per-recipient email-first signing — memory), email ingest classification (deal-relevance — memory), comms log/email watch.

## 4. Systems of record
- **Vault is the SOLE transaction SoR** (CLAUDE.md §8 — SkySlope is a workflow tool, never reconciled against).
- TC tables behind the DAL (deals, documents, envelopes, commissions, contacts); `crm_timeline`/comms log for per-deal communications.

## 5. End-to-end path
1. **Deal created** · human · facts entered → dashboard row · desktop
2. **Docs anticipated** · system · smart-docs list what this deal shape requires (Oregon forms — OREF library knowledge per skyslope-compliance lessons) · failure: missing anticipation → caught at sign-off · n/a
3. **Forms prepared** · human/system · agent-driven form prep (brokers never build forms — memory: instantiate from templates) · `/admin/forms` library · n/a
4. **Envelopes out** · system · sequential signing order + tokenized email links (parity: signing order + financials — memory) · `/admin/signing` (+`[envelopeId]`) · failure: bounced/self-stalled envelope visible on envelope overview · n/a
5. **Signatures sealed** · system · seal + notify on completion · n/a
6. **Commissions computed** · system/human · `getCommissionsForCycles` → `/admin/commissions`, `/admin/financials` rollups · n/a
7. **PB sign-off** · Matt · `/admin/sign-off` queue — supervision record (OREA duty) · desktop · failure: queue backlog invisible outside the page (no alert class — supervision view per Q1)
8. **Close** · human · terminal state recorded in Vault-backed truth · n/a

## 6. Decision points
- Deal shape → anticipated doc set (representation, property type, financing).
- Signing order → sequential enforcement.
- Missing/incomplete doc at sign-off? → PB blocks until cured.
- Broker scope → own deals only; Matt everything (Q4).

## 7. Completion
- Done-when: closed with complete doc set, sealed envelopes, computed commissions, PB sign-off recorded.
- Artifacts: Vault record, sealed PDFs, commission rows, sign-off entry.
- Terminal states: closed · fell-through (verify explicit state in P4) · terminated.

## 8. Time & SLA
- Deadline-driven per contract (inspection, financing, closing dates) — calendar/supervision notifications exist (memory: TC supervision + notifications + calendar).
- "Late": contract-date breach; visibility via deal detail + notifications.

## 9. Variants
- Listing side vs buyer side vs dual; cash vs financed (doc-set variants); FSBO-sourced deals join here post-acceptance.

## 10. Current implementation map
- Routes: `/admin/deals` (+`[key]`), `/admin/signing` (+`[envelopeId]`), `/admin/sign-off`, `/admin/financials`, `/admin/commissions`, `/admin/forms` (+ redirect `/admin/transactions`).
- Known defects: (a) no link from CRM person/deal-track → TC deal (the two-stores split); (b) PB sign-off backlog has no supervision-class signal; (c) TC architecture backlog is a live plan doc (TC_ARCHITECTURE_REVIEW.md) — items tracked there, not re-derived here.
- Duplicate paths: deal-track overlap (see its PDS).

## 11. Target shape (process-level, not pixels)
- Should exist: YES — untouched in shape; it is the most process-complete system in the admin.
- Ideal: single deal entity linked to CRM person; sign-off backlog feeds the supervision view; six routes likely compose into one deal-centric destination with lenses (financials/commissions/signing are projections of deals).
- Data gaps: CRM↔TC link; fell-through state clarity.
- UI destination implication: ONE deals destination (TC-rooted); financial rollups as views within it.

## 12. Acceptance checks
- [ ] Create a test deal → anticipated docs list matches its shape; envelope round-trip signs + seals; commission math verified against the contract numbers.
- [ ] Non-owner broker cannot open another broker's deal; Matt can.
- [ ] PB sign-off blocks on a missing required doc.
- [ ] Every closed deal this year exists in Vault-backed truth (never reconciled against SkySlope).
