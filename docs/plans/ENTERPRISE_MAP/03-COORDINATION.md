# Coordination with concurrent Claude Code (admin)

## Critical distinction (Matt 2026-08-08)

| Concept | Meaning |
|---------|---------|
| **In scope** | Admin is **always** part of the comprehensive enterprise map (CAP-011/024/025, A-001, all admin routes, process registry, 11F, P12). Nothing is left off because another session is grinding it. |
| **Path ownership (temporary)** | Only **who edits which files right now** to avoid merge pain — not a scope exclusion. |

Parallel session = concurrent execution on one plane of the universe.  
When their commit lands, the map **re-verifies and absorbs** it — it does not discover admin later.

## Decision: work in parallel, not wait forever

Waiting until admin “is done” freezes other map planes.  
Blindly editing the same dirty inbox files causes merge pain.  
**Both:** keep **mapping and planning** admin fully; avoid stomping in-flight **edit** ownership.

## Ownership (edit rights only)

| Owner (edits) | Paths |
|---------------|--------|
| **Claude (while dirty)** | `app/admin/**/crm/inbox/**`, in-flight admin v2 islands for that unit, ADMIN_PRODUCT progress for that unit |
| **Map session** | `docs/plans/ENTERPRISE_MAP/**` + non-colliding code; **always** inventory/evidence/plan for **all** of admin |
| **After unit lands** | Any session re-census admin, update CAP cells, continue remaining 11F from inventories + ADMIN_PRODUCT queue |

## Rules

1. Admin CAP rows and A-001 stay **ACTIVE / required** on the map at all times.  
2. Prefer separate commits when another agent has uncommitted inbox work.  
3. No `git add -A` while foreign dirty admin paths exist.  
4. Map session may **read** admin and **write map evidence** about admin anytime.  
5. On land: pull → re-run Q-admin v2 census → EVIDENCE-LOG → CAP-011/025 → next 11F targets from without-v2 list + work-queue.  
6. Handoff: Fleet/map block **alongside** admin Current — never erase admin subject.

## Why this is still comprehensive

The enterprise system **includes** admin.  
A parallel Claude session is **how** that slice moves forward right now, not a reason to omit it from “everything.”
