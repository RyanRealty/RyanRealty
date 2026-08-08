# Coordination with concurrent Claude Code (admin inbox)

## Decision: work in parallel, not wait forever

Waiting until admin “is done” would re-create single-subject freeze of the whole company map.  
Editing admin while Claude has dirty inbox files would cause merge pain and regression risk.

## Ownership

| Owner | Paths / artifacts |
|-------|-------------------|
| **Claude Code** | `app/admin/**/crm/inbox/**`, in-flight `components/admin/v2/{Menu,Sheet,Field,...}`, any ADMIN_PRODUCT progress for inbox unit |
| **Enterprise Map (Grok)** | `docs/plans/ENTERPRISE_MAP/**` only until inbox is committed |
| **Shared later** | G44 register `ENTERPRISE_MAP/` in DEVELOPMENT_PROCESS; handoff fleet block; optional commit of this package alone |

## Rules

1. No commits that mix inbox + ENTERPRISE_MAP.  
2. No `git add -A` while both are dirty.  
3. No rewriting CROSS_AGENT_HANDOFF admin Current to claim map finished — map is PARTIAL.  
4. When Claude finishes inbox: pull/rebase if needed, then register + commit ENTERPRISE_MAP as its own docs commit (or batch with non-admin docs only).  
5. If Claude needs `components/admin/v2` exclusively, Grok does not touch it.

## Why parallel is safe

Enterprise Map is **read-mostly against the repo** + **write only under ENTERPRISE_MAP**.  
It does not require a clean admin UI to enumerate routes, crons, env, plans, or dispositions.
