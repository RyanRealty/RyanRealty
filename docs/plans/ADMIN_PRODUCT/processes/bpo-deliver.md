# Process: bpo-deliver — Broker price opinion path

## 0. Meta
- Status: deepened
- Cadence: rare (institutional/lender requests)
- Verdict: KEEP as a docType, MERGE surface with cma-deliver (proposed; P3 decides) — structurally a CMA twin
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
A requested broker price opinion gets built, finalized, and delivered with the same accuracy machinery as a CMA.

## 2. Inception (what starts it)
- Trigger type: broker action
- Concrete: `/admin/bpo/new` (`listActiveBrokersForCma` — shared broker resolution with CMA); worklist `/admin/bpo` (`listBposForAdmin`), detail `[slug]` (`getBpoAdminRowBySlug`).
- Entry evidence: `broker_price_opinions` store (build_state migration `20260725150000` was BPO-parity motivated); actions `finalizeBpoAction`, `sendBpoDeliverable`.

## 3. Actors
- Human: signing broker (accountable). Requester (lender/institution) receives.
- Automated: build engine (CMA-shared pattern), doc tracker on `/bpo` docs (memory: CRM send tracking E2E covers /cma+/bpo).

## 4. Systems of record
- BPO rows + rendered doc; `crm_timeline` for the send; valuation-accuracy architecture shared with CMA (memory: judge→adversarial).
- NOT SoR: the requester's portal.

## 5. End-to-end path
1. **Request entered** · human · new form with subject + requester · desktop
2. **Build** · system · valuation build (CMA-class gates: comps, accuracy, voice) · failure: build failure states on row · n/a
3. **Review + finalize** · human · detail page; `finalizeBpoAction` · desktop
4. **Send** · human · `sendBpoDeliverable` → tracked doc to requester · n/a
5. **Views tracked** · system · doc-tracker page views · n/a

## 6. Decision points
- Accuracy review needed? → same class of gate as CMA needs_review (verify parity depth in P4).
- Suppression: requester is usually institutional — confirm gate posture in P4.

## 7. Completion
- Done-when: delivered (send logged, doc viewable) or abandoned.
- Terminal states: delivered · abandoned draft · archived.

## 8. Time & SLA
- Requester deadlines are external; no in-system SLA (rare enough that broker memory suffices — acceptable).

## 9. Variants
- Standalone BPO vs prospecting FSBO doc (docType `cma`) vs expired audit — all one build engine, three docTypes.

## 10. Current implementation map
- Routes: `/admin/bpo` triad — near-identical page code to `/admin/cmas` triad (route-inventory evidence: "structurally identical worklist+detail+new").
- Known defects: (a) surface duplication with CMA (two triads, one job shape); (b) build_state wiring divergence between the twins (CMA side orphaned).
- Duplicate paths: the triad twinning.

## 11. Target shape (process-level, not pixels)
- Should exist: YES as a document type; NOT as a separate destination — one valuation-docs worklist serving cma/bpo/expired-audit (all `buildCma`-family products).
- UI destination implication: merged into the CMA worklist destination.

## 12. Acceptance checks
- [ ] New BPO → built with comps + accuracy trail; finalize → send → delivered; tracker records requester views.
- [ ] Voice/accuracy gates fire identically to CMA (spot-check one banned word + one hard violation in test).
- [ ] After merge (target): one worklist lists both docTypes with type filter.
