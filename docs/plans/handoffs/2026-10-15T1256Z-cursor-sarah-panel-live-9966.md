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
at 375 and 1440 (closed, open, buyer, voice) plus the shop question on
4722 Zenith.

## Page-aware replies (2026-10-15)
Root cause: production web chat has no chat route and no page context.
`evaluateSarahTurn` returns `reply: null`; the panel printed `WEB_HELP_EN`.
Fix: listing facts + area/community registry into `answerSarahChat`.
Zenith 220222095: no shop year; home 2020; remarks 20x30 shop; offer Matt.
CI fails on WEB_HELP_EN or the same reply twice in a row.

## Held
Do not edit `app/api/voice/*`, `app/api/twilio/*`, or `lib/grok/voice-sip.ts`.
Do not send emails or CMAs.

Skills read: AGENTS.md CORE RULES, TASTE.md not re-audited (Matt directed).
