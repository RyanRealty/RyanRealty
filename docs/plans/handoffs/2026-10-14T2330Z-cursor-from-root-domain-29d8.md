# 2026-10-14 (Cursor, Resend From root domain)

Surface: Cursor cloud. Branch: `cursor/from-root-domain-29d8`.
Time: 2026-10-14T23:30Z.

Done: default CRM/tracked Resend From is now
`"Matt Ryan · Ryan Realty" <matt@ryan-realty.com>`. One config:
`SEND_DOMAIN` in `lib/email/broker-identity.ts`. Reply-To unchanged.
`ci:from-domain` in `ci:gates`. AGENTS.md land-path item 9 notes it.
No email wording changed.

Next: land PR with auto-merge. After production READY, one tracked
one-off to `ryanrealty+fromtest@mail.grokbot.com`. Confirm Resend From
and delivered. Send to no client.

Vercel: `RESEND_FROM` exists on production (encrypted; not decrypted).
CRM/tracked sends pass explicit From, so they do not use that env.
If that value still names `mail.ryan-realty.com`, fallback `sendEmail`
paths without From would keep the old domain until it is updated.

Skills read: crm-up-to-snuff (not the grind; send-path only).

Node: none (sender identity, not a public site queue node)
