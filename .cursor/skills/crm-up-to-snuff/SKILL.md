---
name: crm-up-to-snuff
description: >-
  Grind loop that brings the in-house CRM up to snuff from the 2026-08-03 full
  audit pack. Re-verifies punch-list claims, fixes integrity/compliance/e2e
  classes automatically, stops cold at Matt-gated IA/UI redesign. Use when Matt
  says "/crm-up-to-snuff", "run the CRM fix loop", "keep fixing the CRM audit",
  or when /loop carries this protocol.
---

# /crm-up-to-snuff — CRM remediation grind

You execute the plan in
[`docs/plans/ADMIN_REBUILD/FULL-AUDIT-2026-08-03.md`](../../../docs/plans/ADMIN_REBUILD/FULL-AUDIT-2026-08-03.md).
You do **not** invent a new redesign. You do **not** ask permission for reversible
integrity fixes once Phase 0 is answered. You stop when blocked on Matt or when
the punch list is clear.

Companion role brief (process/data/UI ownership if redesign resumes):
[`docs/plans/ADMIN_REBUILD/ROLE-BRIEF-PROCESS-DATA-UI.md`](../../../docs/plans/ADMIN_REBUILD/ROLE-BRIEF-PROCESS-DATA-UI.md).

Engine guardian (health battery only): [`.claude/skills/crm-e2e/SKILL.md`](../../../.claude/skills/crm-e2e/SKILL.md)
or the preserved copy under `docs/plans/PROGRAM_2026-07-21/preserved-skills/crm-e2e/`.

---

## Invocation

```
/crm-up-to-snuff
/loop /crm-up-to-snuff
/loop 15m /crm-up-to-snuff
```

Under `/loop`, use grind semantics: chain iterations until blocked, green, or
context spent. Sleep only when blocked on Matt/external. Green → 30–60m. Just
fixed → 10–15m. Blocked → 60m heartbeat, do not invent UI work.

---

## Hard gates (never violate)

1. **Phase 0 answers required** before any IA cut, nav shrink, or visual redesign.
   If `docs/plans/ADMIN_REBUILD/PHASE-0-ANSWERS.md` is missing or incomplete,
   create/update that file with the five questions unanswered and **stop after
   Phase 1 integrity-only work** (or after reporting Phase 0 needed if even that
   is done).
2. **Phase 3 IA must be Matt-signed** (explicit “lock IA” / “approved cut list”)
   before deleting mobile forks, collapsing destinations, or building Spec 03
   SendPanel as a product rewrite.
3. **CLAUDE.md §1** — no outbound to real people, no social publish, no ad spend,
   no OAuth grants without per-action yes.
4. **Suppression fail-closed** on every send path you touch.
5. **Never mass-enroll** the historical book (`ENROLLMENT_EPOCH` in `lib/crm/enroll.ts`).
6. **Draft-first** for CMA/BPO/newsletters — never auto-send to the lead.
7. Ship on `main` per AGENTS.md when you fix something; `npm run deploy:verify`
   when app code changed. Update `CROSS_AGENT_HANDOFF.md` Current before stop.
8. Fix the **class**, then add/adjust a gate or e2e check so it cannot silently
   regress.

---

## Lane model (what the loop may touch)

| Lane | Auto without Matt? | Examples |
|---|---|---|
| **A — Integrity** | YES | Stale e2e asserts, RBAC scope on reads/writes, double-send/idempotency, suppression holes, conversation reply targeting bugs, dead FUB wiring, orphan cron registration, OREA re-verify tooling if mechanical |
| **B — Litmus / engine** | YES to keep green | Re-run litmus recipe; fix regressions that break ≤3 taps / ≤30s CMA kickoff; cron failures; alert deep-link `?intent=cma` |
| **C — IA / cut list** | NO — propose only | Destination count, delete 59→N pages, kill FUB-parity chrome |
| **D — UI rebuild** | NO until Phase 3 signed | One responsive person tree, Unified SendPanel, inbox mobile/desktop merge |
| **E — Metric SoT / analytics** | Propose + fix only if single wrong reader is proven | “new leads” multi-definition — fix reader to one DAL after proof |

Default iteration: pick highest open item in **A then B**. Never start **D** from a loop tick.

---

## Phase 0 file (Matt fills once)

Create if missing: `docs/plans/ADMIN_REBUILD/PHASE-0-ANSWERS.md`

```md
# Phase 0 — Matt answers (CRM up to snuff)

1. Notification that wakes me / what I do next:
2. Weekly vs never (Inbox / People / Deals / Tasks / Sequences):
3. Phone must-haves beyond CMA kickoff:
4. Broker scope (own book only vs all-book):
5. Alert SMS path (Twilio serverless vs mac-mini relay) — confirm env:
6. Process marks (KEEP / MERGE / KILL / DEFER) — paste or link:
7. IA lock (fill later): unlocked | locked YYYY-MM-DD — cut list:
```

Until 1–5 are filled, Lane C/D are closed.

---

## One iteration (always this shape)

### 1. Load state

- Read `FULL-AUDIT-2026-08-03.md` punch list + this skill.
- Read `PHASE-0-ANSWERS.md` if present.
- Read `tmp/crm-up-to-snuff-state.json` if present (create/update each iteration).

### 2. Battery

```bash
node scripts/crm-e2e-verify.mjs
```

Capture pass/warn/fail. Fix Lane A e2e fails first (including retiring
`wiring.static` / `mirrorPersonFromFub` if FUB is still decommissioned).

### 3. Pick next punch item

Order (skip Matt-gated):

1. L4 stale FUB e2e wiring  
2. L3 OREA re-verify (mechanical if scripted; else surface to Matt)  
3. L5 confirm `CRM_SMS_ALERTS` in prod env — document, do not guess  
4. S4 RBAC GAP-0 / GAP-W (broker cannot load/mutate out-of-scope person)  
5. S3 conversation vs timeline reply targeting (group/1:1 silent drop)  
6. S8 / composer double-send re-proof + fix if regressed  
7. B litmus regression  
8. S7 single wrong metric reader if proven  
9. Stop and report if only C/D remain and IA unlocked  

### 4. Re-verify the claim before coding

For the chosen item: prove fail with file:line + command/SQL/browser. If already
fixed, mark closed in state JSON and pick next.

### 5. Fix the class

Minimal diff. Prefer DAL/action guards over UI. Add/adjust
`scripts/crm-e2e-verify.mjs` or a `ci:*` gate when the class is integrity.

### 6. Prove

Re-run the specific probe + full e2e when send/auth/cron touched. Browser or
scripted litmus when person/send path touched.

### 7. Ship

Commit scoped files. Push `main` when the unit is coherent. `deploy:verify` if
app runtime changed. Update state JSON + `CROSS_AGENT_HANDOFF.md` Current.

### 8. Stop conditions

Stop the iteration (and say why) when:

- Phase 0 incomplete and Lane A/B empty  
- Only Lane C/D left → write IA proposal one-pager, wait for “lock IA”  
- External blocker (Twilio, OAuth, Matt approval class)  
- Context nearly spent → handoff + spawn instruction  

When green on A/B and Phase 0+3 locked with D unfinished → next iteration builds
Lane D per Spec 03 / locked cut list only.

---

## State file schema

`tmp/crm-up-to-snuff-state.json` (gitignored via tmp/):

```json
{
  "updatedAt": "ISO",
  "phase0Complete": false,
  "iaLocked": false,
  "lastE2e": { "pass": 0, "warn": 0, "fail": 0, "at": "ISO" },
  "closed": ["L4"],
  "open": ["S1", "S2", "S3", "S4", "S5"],
  "blockedOn": null,
  "lastFix": { "id": "L4", "sha": "", "note": "" }
}
```

---

## Paste-ready system prompt (alternate to skill load)

If another session lacks this skill file, paste:

```
Load and obey .cursor/skills/crm-up-to-snuff/SKILL.md end to end.
Canon: docs/plans/ADMIN_REBUILD/FULL-AUDIT-2026-08-03.md.
Run one grind iteration now: e2e → highest Lane A/B punch item → prove → fix
class → prove → ship. Do not redesign UI or cut nav unless
PHASE-0-ANSWERS.md is complete and Matt has locked IA. Update
tmp/crm-up-to-snuff-state.json and CROSS_AGENT_HANDOFF.md before stop.
If only Matt-gated work remains, write the IA proposal and stop.
```

---

## What “done” means for this loop

- crm-e2e: no fails except known externals Matt accepts  
- Punch L* and S3/S4/S8 closed with evidence  
- Litmus still ≤3 taps / ≤30s on phone  
- Phase 0 answered; Phase 3 IA locked; Lane D either shipped per cut list or
  explicitly deferred by Matt  
- Handoff Current points at state JSON + last SHA  
