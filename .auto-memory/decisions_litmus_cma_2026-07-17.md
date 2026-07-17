# Matt decisions — CMA litmus (2026-07-17, admin-rebuild v2 Phase-0 micro-batch)

Recorded verbatim from the AskUserQuestion batch. Mirrored into
`docs/plans/ADMIN_REBUILD/01-DECISIONS-AND-RECONCILIATION.md` §D as **D8**.

1. **Litmus shape → KICK-OFF + NOTIFY.** The litmus tap kicks off the standard
   draft-first async CMA build AND texts the broker a review link when the draft
   is ready. Review + send stays exactly as today (draft in /admin/cmas, broker
   sends personally). Nothing is ever auto-sent (§0 holds).
2. **Build engine → FULL buildCma, ASYNC.** No instant-estimate engine. The
   kick-off enqueues the real deterministic builder; the broker-action span ends
   at kick-off, so the 30–60s compute never counts against the tap budget.
3. **Deliverable → SELLER CMA.** "What's my home worth" is a seller signal; the
   one-tap kick-off produces the standard seller CMA. BPO remains a separate
   affordance on the person page.
4. **Budget → ≤3 taps / ≤30s on mobile**, from tapping the phone notification to
   the CMA build kicked off pre-filled (zero manual entry beyond confirming the
   resolved lead + address).
