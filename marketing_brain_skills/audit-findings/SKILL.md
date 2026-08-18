---
name: audit-findings
description: Protocol-only. marketing-audit-run writes analyze:audit_findings rows. This is not a dispatchable producer. Do not author new producers from a deleted Producer Authoring session.
---

# STOP - not a dispatchable producer

`marketing-audit-run` writes `analyze:audit_findings` rows and points `assigned_producer` here. There is no recipe to execute. Read `PROTOCOL.md` for the payload shape only. Do not invent a Producer Authoring session. Do not dispatch new REGISTRY producers from this path.

# audit-findings (protocol, not a writer)

See `marketing_brain_skills/audit-findings/PROTOCOL.md`.
