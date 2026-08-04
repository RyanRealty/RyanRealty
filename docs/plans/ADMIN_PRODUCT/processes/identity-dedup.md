# Process: identity-dedup — Person identity resolution

## 0. Meta
- Status: deepened
- Cadence: event-driven (every ingress) + rare broker-triggered merges
- Verdict: KEEP (proposed; P3 decides) — correctness substrate for compliance (suppression follows the person) and for trust in every count
- Last evidence pass: 2026-08-04 · commit 21e2c63b

## 1. Purpose
One human = one `crm_people` row, no matter how many doors, emails, or phone numbers they arrive through — so history, suppressions, and attribution never fragment.

## 2. Inception (what starts it)
- Trigger type: inbound event (contact point arrives) | broker action (manual merge)
- Concrete triggers:
  - Every ingress door resolves identity before create — `ensureNativeLead.ts:139-149` (email-first, then phone, against `crm_contact_points`)
  - Phone-only inbound — `findOrCreatePersonByPhone.ts:61-107`
  - Broker merge from the person record — `mergePeopleCore` (memory: THE one merge path; all merge UI routes through it)
  - CSV import preview dedup stage — `app/actions/crm-import`
- Preconditions: normalized contact point (email lowercased, phone E.164).
- Entry evidence: `crm_contact_points` unique lookups; `decideNativeLeadAction` `ensureNativeLead.ts:86-111`.

## 3. Actors
- Human: broker for manual merges (accountable for merge correctness).
- Automated: resolution logic inline in every ingress; enrichment union.
- Accountable: system for automatic resolution; the merging broker for manual merges.

## 4. Systems of record
- `crm_people` — canonical person. `crm_contact_points` — the identity index (email/phone → person).
- `crm_timeline` — survives merges attached to the winner.
- NOT SoR: any door's local notion of identity (Meta lead id, import row id, FUB legacy id — mapping keys only, `fub_legacy_id` resolved at `enroll.ts:273-288`).

## 5. End-to-end path (inception → completion)
1. **Contact point arrives** · system · from any door · input: email/phone + context · n/a
2. **Email-first lookup** · system · `crm_contact_points` by email · `ensureNativeLead.ts:139-144` · failure: miss → step 3 · n/a
3. **Phone fallback lookup** · system · by phone `:145-149` · failure: miss → create · n/a
4. **Decide** · system · `decideNativeLeadAction` `:86-111` — create | reuse-enrich · n/a
5. **Create path** · system · `crm_people` insert `:221-225` + points `:233-240` · failure: point insert fails after person insert → person without index (re-arrival would dupe) — verify transactionality in P4 · n/a
6. **Reuse path** · system · `mergeReuseEnrichment` `:266-309` — union tags/source/broker; add NEW contact points to the same person · n/a
7. **Manual merge** · human · broker picks winner/loser → `mergePeopleCore` moves points, timeline, tasks, enrollments, suppressions to winner; loser retired · device: desktop · failure: partial move = fragmented history (why ONE path only)
8. **Downstream integrity** · system · suppressions and enrollments keyed by person id follow the winner; `fub_legacy_id` continues resolving · n/a

## 6. Decision points
- Email hit? → reuse. Phone-only hit? → reuse. Both miss? → create.
- Conflicting hits (email → person A, phone → person B)? — **NOT resolved automatically; no auto-merge in code.** Left as two people until a broker merges. Deliberate (auto-merge is riskier than dupes) but invisible today — no dupe-candidate queue.
- Import dupes? → preview stage decision before write.

## 7. Completion
- Done-when: contact point maps to exactly one live person; on merge, loser unreachable and every child row re-pointed.
- Artifacts: point rows on winner; merge audit (verify existence in P4).
- Signals: none (background). Merge is broker-visible only in the moment.
- Terminal states: resolved-to-one · pending-human-merge (undetected dupes).

## 8. Time & SLA
- Resolution: synchronous ms at ingress. Manual merges: no SLA (no queue exists).
- "Late" = dupes accumulating unmeasured; 22,951 contacts with unknown dupe rate. Gap.

## 9. Variants
- Automatic (ingress inline) vs manual (broker merge) vs bulk (import preview). One process.

## 10. Current implementation map
- Routes: person record merge affordance (`/admin/crm/[id]`); import preview.
- Libs: `ensureNativeLead.ts`, `findOrCreatePersonByPhone.ts`, `mergePeopleCore`.
- Known defects: (a) no dupe-candidate detection/queue (cross-channel A/B split invisible); (b) create-path transactionality between person and points unverified; (c) no merge audit trail confirmed.
- Duplicate paths: none — merge path is deliberately singular (memory: mergePeopleCore is the ONE merge path).

## 11. Target shape (process-level, not pixels)
- Should exist: YES, as background automation + a rare-use merge review lane.
- Ideal: nightly dupe-candidate scan (same phone, same email-domain+name, same address) feeding a small review queue; transactional create; merge audit row.
- Data gaps: dupe-candidate table; merge audit.
- UI destination implication: no destination; a review lane inside the person tooling, surfaced only when candidates exist.

## 12. Acceptance checks
- [ ] Same email via two doors → one person (row count unchanged on second arrival).
- [ ] Same person, email door then phone door with different values → two people today (documents the gap); after target shape: candidate flagged.
- [ ] Manual merge → loser's timeline/tasks/enrollments/suppressions all on winner (SQL per child table), loser 404s.
- [ ] Suppressed loser merged into clean winner → winner inherits suppression (compliance-critical).
- [ ] Import preview marks known-email rows as enrich, not create.
