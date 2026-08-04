# Process: deal-track — CRM sales pipeline (pre-close)

## 0. Meta
- Status: deepened
- Cadence: rare (Matt Q2: Deals is NOT weekly; ~21 rows total)
- Verdict: MERGE→tc-close or KILL-as-destination (proposed; P3 decides) — the data says nobody runs this process as built
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
(As built) Track a prospective transaction from interest to accepted offer on a stage board.

## 2. Inception (what starts it)
- Trigger type: broker action
- Concrete: broker creates a deal on `/admin/crm/deals` board (`listDealsBoard`, `getCrmDeal`, `getDealPipelines`, `lib/crm/deal-scope`); pipelines configured at `/admin/crm/deals/pipelines`.
- Entry evidence: ~21 rows across SIX surfaces split over TWO stores (Phase-0 Q2, corrects FULL-AUDIT §0): CRM store (`/admin/crm/deals*` × 3) vs TC store (`/admin/deals*` — tc-close); `/admin/crm/reporting/deals` redirects (report deferred); `/admin/crm/referrals` reads receivables.

## 3. Actors
- Human: broker (would be accountable — in practice barely used).
- Automated: none meaningful (no cron advances deals).

## 4. Systems of record
- CRM deal tables (via `getCrmDeal`/`listDealsBoard`) for THIS process; **Vault-backed TC truth is tc-close's SoR and the company's real transaction record** (CLAUDE.md §8: never SkySlope, and by extension not this board).

## 5. End-to-end path
1. **Create deal** · human · board or person record · desktop · failure: mostly never happens (21 rows vs 22,951 people)
2. **Stage advance** · human · drag/edit through pipeline stages · desktop
3. **Accepted offer** · human · handoff to tc-close (NO wiring exists — a TC deal is created separately; nothing links the two stores) · failure: double entry or, in practice, CRM deal never created
4. **Closed/lost** · human · terminal stage (self-reported)

## 6. Decision points
- Which store? — the confusion itself: same word "deals," two systems (route family evidence). No code bridges them.
- Referral attached? → receivables tracked separately (`referralReceivables`).

## 7. Completion
- Done-when: deal closed/lost on the board — but real completion truth lives in tc-close/Vault.
- Terminal states: closed · lost · abandoned-row (most likely state).

## 8. Time & SLA
- None defined; none observed (rows too few to matter).

## 9. Variants
- Buyer vs seller deals; pipelines configurable — unused generality.

## 10. Current implementation map
- Routes: `/admin/crm/deals` (+`[id]`, `/pipelines`), redirect from reporting; referrals adjacent.
- Known defects: (a) near-zero adoption (21 rows / 6 surfaces); (b) no link between CRM deal and TC deal — the one join that would make a pipeline useful; (c) pipeline config generality nobody uses; (d) naming collision confuses every conversation about "deals."
- Duplicate paths: vs tc-close (the real record).

## 11. Target shape (process-level, not pixels)
- Should exist? — P3 question with data on the table: either (a) KILL the standalone board and let pre-close interest live as person-stage + tasks until a TC deal exists, or (b) MERGE: one deal entity whose pre-close phase is a thin stage field and whose post-acceptance phase is tc-close. Evidence leans (a)/(b), not status quo.
- Data gaps: CRM↔TC deal link (if merged); closed-deal reporting feed either way.
- UI destination implication: NOT a primary destination (Q2: not weekly; tab bar currently spends a tab on it).

## 12. Acceptance checks
- [ ] Count rows + last-touched dates on both stores (SQL) — adoption evidence for the P3 verdict.
- [ ] Trace one real recent transaction: does it exist on this board at all? (Predicted: no — TC only.)
- [ ] After P3 verdict: whichever shape survives, one "deals" word maps to one store.
