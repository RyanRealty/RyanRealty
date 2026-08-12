# P3 PROCESS LOCK PACKAGE — Public Product OS

Prepared 2026-08-11 from 34 deepened + adversarially verified PDS files (105-agent run; 32 verified clean, 2 repaired by hand against code and re-checked). Verdicts below are PROPOSALS derived from each PDS §11. **This lock is granted only by a dated entry in decisions.md.**

## Proposed verdict table

| Process | Proposed | Rationale (from PDS §11) |
|---|---|---|
| get-home-value.instant-cma | **MERGE->get-home-value.written-cma** | MERGE->get-home-value.written-cma — same visitor job, same request-of-record (valuation_requests), same seller audience, and Matt's binding "one spine, never fork it" decision; the auto-CMA PDF is a fulfillment variant f |
| evaluate-a-place-poi | **MERGE->evaluate-a-place** | MERGE->evaluate-a-place — same visitor question, step skeleton, and dual objective as geography evaluation; only the data plumbing (registries + point/line/polygon anchors) and entry query shape differ, which under this  |
| hunt-price-cuts | **MERGE->find-a-home** | MERGE->find-a-home — a deal-hunting lens with find-a-home's inventory, actor, and completion set and no artifact of its own (every completion is another process's inception), already half-duplicated by find-a-home's /pri |
| broker-attributed-lead | **MERGE→get-home-value.written-cma** | MERGE→get-home-value.written-cma — the capture leg is a 27-line adapter onto that exact pipeline (zero unique downstream), and the only distinct machinery, the attribution cookie contract, is cross-process and belongs re |
| sms-shortlink-click | **MERGE->track-outbound-engagement** | MERGE->track-outbound-engagement — identical job to the email click tracker (302 to a server-held target + deduped per-person+link crm_timeline engagement row, fed to the same dashboards; shortLinks.ts:11 names itself th |
| compare-homes | **MERGE->find-a-home** | MERGE->find-a-home — every inception and completion already lives on find-a-home surfaces and the process owns zero durable writes; the job survives as an in-browse utility with the share-link exit contract preserved, ex |
| find-a-home | KEEP | the highest-traffic visitor process with three verified completion paths; all ten surfaces are lenses of one funnel (P3 sub-calls: consolidate videos/feed, decide /compare), not separate processes. |
| evaluate-a-place | KEEP | a core standalone visitor journey spanning nine production routes with its own conversion machinery (place-scoped alerts) and a distinct destination implication; nothing else covers the geography ladder. |
| refer-out-of-area | KEEP | unique inception (out-of-market query actively routed OUT of the in-market graph) and unique completion (hard-gated no-drip lead awaiting manual handoff + referral_receivables terminal); it delegates lead creation to the |
| plan-a-sale | KEEP | (PROPOSAL for the P3 package, not a lock) - it is the organic feeder of the E2 KPI and its completion IS get-home-value's inception; sub-proposal: re-decide the three orphaned /sell/[intent] landers at P5 with GSC eviden |
| explore-market-knowledge | KEEP | Matt-directed first-class pillar with a real, §0-disciplined, competitor-unfakeable data plane; defects are consolidation work (feed merge, URL-space collapse, narrative-plane unification, register convergence), not exis |
| get-home-value.written-cma | KEEP | it is the E2 KPI spine and the most instrumented conversion path on the site; the parallel /sell/valuation instant-CMA fork should MERGE into it rather than survive beside it (a PROPOSAL for the P3 package, not a lock). |
| plan-a-purchase | KEEP | the only surface converting not-ready-to-browse buyer researchers into named leads with segment + timeline; affirm the run-the-numbers split, and carry two P3/P5 riders: fold the /lp/buyer-listing-alerts duplicate into o |
| save-and-return.portal | KEEP | the destination-bearing member of the save-and-return family; propose P3 treats save-and-return.search-alerts as its machine recall loop and guest-alert-capture as its anonymous on-ramp (one family, one destination), not |
| run-the-numbers | KEEP | one process, three audience variants with identical shape and completion class; the only surface answering money questions with zero ask, feeding CRM intent and three capture processes; consolidations (orphan component d |
| save-and-return.search-alerts | KEEP | it is the L2 litmus artifact and the exploration graph's only recurring no-spend return loop; boundary condition for P3: crown ONE owner of the shared send-engine truth, folding the deliver-alerts machine row's engine se |
| contact-form-inquiry | KEEP | the only general written-contact chokepoint and the completion leg of every listing tour/question CTA; sub-proposal: P5 decides whether tour requests stay folded here or attach to the listing node (this is a PROPOSAL for |
| save-and-return.guest-alert-capture | KEEP | the only anonymous→identified conversion on the highest-intent browse surfaces and structurally distinct from both siblings (no-account spam-hardened lead-gen capture vs the signed-in portal loop vs the machine engine);  |
| broker-direct-call-text | KEEP | the only process completing in a live human conversation, on a webhook-driven capture plane no other process touches; it shares only the person-create substrate (findOrCreatePersonByPhone deliberately mirrors ensureNativ |
| read-content | KEEP | the word-form trust engine earning organic/AI-citation entry with real §0 discipline; defects are wiring (FAQ-slug discovery, duplicate reader path, vestigial dynamic pin), not existence, and the /resources annex carries |
| deliver-alerts | KEEP | the one machine-side send engine for all five inception channels (one table, one cron, one send path); sibling save-and-return.search-alerts §5 steps 6-15 merge here at P3 per the already-proposed boundary. |
| arrive-from-ad | KEEP | the paid/outreach arrival job is real and distinct from the exploration graph; internally MERGE the Tetherow form fork onto the one canonical capture contract (with a real deliverable queue), keep sell-your-home as a var |
| earn-search-traffic | KEEP | the only process producing the organic/AI entry channel every visitor process lists at inception; unique inception (crawler fetch) and completion (per-class GSC-indexed URL), shared with nothing, and killing it removes t |
| capture-and-attribute | KEEP | the one machine spine every door converges on (26 sendEvent sites verified: 24 site doors + Meta webhook + one dead caller, plus the portal door), with the sub-proposal that P3/P4 ratify attribution-and-consent-in-the-ch |
| measure-search-traffic-gsc | KEEP | it is THE LOOP's measure step for the search channel and the only durable record of per-day/per-query/per-URL search truth; nothing else can prove earn-search-traffic's completion (proposal only; locks at P3). |
| serve-legal-pages | KEEP | (PROPOSAL for the P3 package, not a lock) — legally mandatory surfaces whose URLs are pinned by external systems (A2P carrier campaign, OAuth consent screens, Meta/Google data-deletion config); the defect list is P4/P9 r |
| sign-transaction-documents | KEEP | the only pure client-service process in the registry (a party executing legal documents, not a lead); no sibling shares its job, tables, or persona; killing it kills the TC system's signature leg. Rider: P5 may not renam |
| cookie-consent | KEEP | legally required switchboard for four tracker stacks plus the first-party intent pipeline; cannot merge into serve-legal-pages (content vs runtime state machine); the defect list (D1 withdrawal gap foremost) is P4/P9 rep |
| view-client-valuation-doc | KEEP | the consumption half of the valuation loop (door, read, consent, telemetry) serving three document families the written-CMA funnel never touches; one P3 scope correction proposed (the /api/cma-document/[token] inception  |
| newsletter-lifecycle | KEEP | the site's one recurring outbound edition of the market-knowledge pillar: one list, one queue, one drain, one ledger, one unsubscribe surface, with two other products already riding its compliance rails instead of buildi |
| pwa-offline-resilience | KEEP | the recovery half is live infrastructure no other process covers, but the P3 package must carry one named binary sub-decision: (A) wire the offline worker for real (one worker serving offline+push, retire/allowlist the e |
| track-outbound-engagement | KEEP | (proposal) — and absorb sms-shortlink-click into this process, whose own deepened PDS already proposes MERGE→track-outbound-engagement; one job ("engagement on a message we sent becomes a person-level signal; the recipie |
| ods-idx-attribution | KEEP | a licensing obligation with its own enforcement (G54) and its own failure owner (Matt's broker license), independent of any visitor journey; the ten §10 defects, including the newly confirmed indexable /sold destination, |
| join-the-brokerage | KEEP | distinct persona (a licensed agent evaluating a workplace) no other process serves, one completion is worth a book of business, and contact-form-inquiry is only this process's completion leg, not a merge target; conditio |

## Net shape if approved

34 processes -> 28 (6 merges). Full detail per process: docs/plans/PUBLIC_PRODUCT/processes/{id}.md — each carries the dual objective (visitor + machine + exits) its pages inherit at P5.

## Open questions (answer these to grant the lock)

1. **The six merges** — approve all six MERGE rows above, or name exceptions?
2. **Video browse duplication** — /videos (grid with city chips) and /feed (vertical feed) browse the same video-listing inventory. Carry ONE forward as canonical (which?), or keep both?
3. **PWA offline** — (A) wire the offline worker fully as a real capability, or (B) keep minimal recovery only (the PDS found the recovery half live, the offline half unwired)?
4. **Client-service scope** — sign-transaction-documents and view-client-valuation-doc serve existing clients, not lead gen. KEEP them governed by this program's IA/visual system (proposal), or DEFER their redesign to the TC program?
5. **Thin personas** — refer-out-of-area and join-the-brokerage are real but tiny. KEEP as thin standalone processes (proposal), or DEFER their pages to after the main wave?

## What must be true before P4/P5

- Lock recorded in decisions.md (dated section + verdict table), state.json locks.process set, awaiting_lock cleared.
- Merged processes' PDS files get a MERGED banner pointing at the survivor; registry rows -> locked.
- P4 builds data chains for KEEP set only; P5 derives destinations + dual objectives from KEEP set under amnesia (GSC evidence before any URL cut).
