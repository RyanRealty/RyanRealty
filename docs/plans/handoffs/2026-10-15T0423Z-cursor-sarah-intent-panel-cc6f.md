# 2026-10-15 (Cursor, Sarah panel live-test)

Surface: Cursor cloud. Branch `cursor/sarah-intent-panel-cc6f`. PR #672.

## Landed (on branch, not prod yet)
Intent chips, CRM qualifying flows, draft CMA, no broker header. High-res
`sarah-headshot` 1x/2x/3x srcset. Launcher inset of the scrollbar in the old
phone-dock FAB slot. Auto-scroll on new messages and input focus. Eve mic
asks permission on the click then opens `wss://api.x.ai/v1/realtime`.
"Hi I would like to look at homes here" starts the buyer flow. Cookie
settings gear stays (legal consent). Gate: `ci:sarah-panel`.

## Next
`npm run push`, land #672, production READY, shots 375/1440 opening + buyer
+ voice. Delete leftover sarah-panel branches.

## Held
Do not send emails or CMAs. Do not edit `app/api/voice/*`,
`app/api/twilio/*`, or `lib/grok/voice-sip.ts`.

Skills read: crm-up-to-snuff, AGENTS.md.
