# 2026-10-14 (Cursor, inbound consent clear)

Surface: Cursor cloud. Branch: `cursor/inbound-consent-clear-90d2`.
Time: 2026-10-14T22:50Z.

Done: inbound call / voicemail / SMS / email-reply clears DNC and no-SMS
flags when the person has a prior CRM-tracked email (`email_events` sent).
STOP never clears and still opts out. Broker flags and email unsubscribe
stay. Timeline note records what was cleared. Rule 34 in AGENTS.md.
Gate: `ci:inbound-consent-clear` in ci:gates always (wiring + vitest).

Next: merge-gate, production READY, then person 57526 backfill if safe
(clear DNC/no-SMS only, timeline note, send nothing).

Skills read: crm-up-to-snuff, tdd.

Node: none (CRM inbound consent, not a public site queue node)
