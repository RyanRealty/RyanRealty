# 2026-10-15 (Cursor, Sarah intent chips)

Surface: Cursor cloud. Branch `cursor/sarah-intent-panel-cc6f`.
Based on `origin/main` @ 32c70a2da (stack #668 merged).

## Landed
Opening asks what brings them here. Chips: looking for a home, thinking of
selling, what's my home worth, I have a question. Buyer: area, budget,
timeline. Seller / home-worth: address, then a draft CMA for Matt (never a
Sarah value). Every flow captures name plus email or phone, CRM write with
existing stages only, by-Sarah audit, assigned broker then Matt. Big Eve mic.
Cookie settings stays the extra FAB. Gate: `ci:sarah-panel`.

## Next
Open PR, land, production shots at 375 and 1440 of the opening state and the
buyer flow.

## Held
Do not send emails or CMAs. Do not edit `app/api/voice/*`,
`app/api/twilio/*`, or `lib/grok/voice-sip.ts`.

Skills read: crm-up-to-snuff, site-queue, DATABASE_FOR_AI_AGENTS (CRM writes
only), AGENTS.md.
