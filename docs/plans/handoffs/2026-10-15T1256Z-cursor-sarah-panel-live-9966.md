# 2026-10-15 (Cursor, Sarah live panel)

Surface: Cursor cloud. Branch `cursor/sarah-panel-live-9966`.
Reuses #672 (`cursor/sarah-intent-panel-cc6f`, conflicting) from main.

## Landed
Approved panel: opening question, four intent chips, one disclosure,
no broker header/row. Buyer/seller/home-worth/question flows write CRM
(existing stages, no downgrade, by-Sarah audit) and draft CMA via
`lib/cma/build.ts`. Eve mic mints an xAI realtime token. Launcher uses
2x/3x Sarah srcset, face-centered cover crop, scrollbar gutter.
Auto-scroll on message and input focus. Cookie gear stays (consent).
`ci:sarah-panel` fails if the old Call/Text/Email/Book row returns.

## Next
Close #672 as superseded. Land this PR, confirm Vercel READY, live QA
at 375 and 1440 (closed, open, buyer, voice).

## Held
Do not edit `app/api/voice/*`, `app/api/twilio/*`, or `lib/grok/voice-sip.ts`.
Do not send emails or CMAs.

Skills read: AGENTS.md CORE RULES, TASTE.md not re-audited (Matt directed).
