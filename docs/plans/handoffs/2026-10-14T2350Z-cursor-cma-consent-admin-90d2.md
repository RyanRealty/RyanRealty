# 2026-10-14 (Cursor, CMA consent + person editor)

Surface: Cursor cloud. Branch: `cursor/cma-consent-admin-90d2`.
Time: 2026-10-14T23:50Z.

Done: inbound auto-clear also resets `custom.cmaConsent` and
`sms-consent:no`. STOP still wins. Person page SMS/email/call editor
logs each change. Rule 34 updated.

Leslie 57526: CMA consent was `{sms:false,email:false}`. Set both true.
Timeline 296624: "opt-outs cleared: inbound call 12:24 PM PT Oct 14,
per Matt". Sent nothing.

Next: PR auto-merge, production READY.

Skills read: crm-up-to-snuff, tdd.

Node: none (CRM consent, not a public site queue node)
