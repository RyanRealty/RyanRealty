# 2026-10-15 (Cursor, Sarah compact panel)

Surface: Cursor cloud. Branch `cursor/sarah-panel-card-cc6f`.
Depends on intro PR #660.

## Landed
Sarah panel is a compact desktop card (380x560, scale/fade from the
launcher) and a phone bottom sheet (85vh, drag to dismiss, safe area).
Header has Sarah plus the resolved broker. Chips: Call, Text, Email, Book
a time. Composer has a mic that shows the voice-recording notice (voice
PR wires Grok eve). Navy/cream; warm stone `--v3-focus` instead of retired
gold. Reduced-motion honored.

## Next
Working xAI chat, page-aware teasers, conversational offers, SMS alerts,
voice WebRTC, CRM audit, outbound flag off.

## Held
Do not edit `app/api/voice/*`, `app/api/twilio/*`, or `lib/grok/voice-sip.ts`.

Skills read: TASTE.md (navy/cream, no elevation), AGENTS.md, sarah-spec.
