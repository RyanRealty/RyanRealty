# 2026-10-15 (Cursor, Sarah listing teaser)

Surface: Cursor cloud. Branch `cursor/sarah-listing-teaser-a1ab`.
Depends on PR #646 (`cursor/sarah-persona-guardrails-a1ab`).

## Landed
Listing-detail teaser on `V3SarahAssistant`: after 30s, desktop bubble with
Sarah's photo and "Questions about this home? I can help."; phone is a
launcher badge only. Session dismiss. Reduced-motion in CSS. Events
`sarah_teaser_shown` / `sarah_teaser_clicked`. Panel opens only on click.
Approved avatar on launcher, teaser, and her messages.

## Next
CRM log + Grok replies. Then alerts, takeover, voice button.

## Held
Outbound flag off. Do not edit `app/api/voice/*` or `lib/grok/voice-sip.ts`.

Skills read: TASTE.md (public surface), AGENTS.md CORE RULES, sarah-spec teaser.
