# 2026-10-15 (Cursor, Sarah compact panel)

Surface: Cursor cloud. Branch `cursor/sarah-panel-card-cc6f`. PR #663.

## Landed
Sarah panel is a compact desktop card (380x560, scale/fade from the
launcher) and a phone bottom sheet (max 85vh, drag to dismiss, safe
area). Header has Sarah plus the resolved broker. Chips: Call, Text,
Email, Book a time. Composer has a mic. Navy/cream; warm stone
`--v3-focus` instead of retired gold. Reduced-motion honored. Phone
sheet stacks above the scrim so it stays cream.

Local shots: `/opt/cursor/artifacts/sarah-panel-open-1440.png` and
`sarah-panel-open-375.png`. Drag-to-dismiss verified at 375.

## Next
Working xAI chat, page-aware teasers, conversational offers, SMS alerts,
voice WebRTC, CRM audit, outbound flag off.

## Held
Do not edit `app/api/voice/*`, `app/api/twilio/*`, or `lib/grok/voice-sip.ts`.

Skills read: TASTE.md (navy/cream, no elevation), AGENTS.md, sarah-spec.
