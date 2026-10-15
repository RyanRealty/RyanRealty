# 2026-10-15 (Cursor, Sarah web intro)

Surface: Cursor cloud. Branch `cursor/sarah-intro-cc6f`.

## Landed
Web chat intro is Matt's short line plus "Chats are saved so our team can
follow up." Unlicensed status is off the intro; Sarah says it on price,
contract, or advice. Phone greeting unchanged. `{broker}` helper defaults to
Matt for the next broker-desk PR.

## Next
1. Broker lookup + fold V3PhoneDock/disc into Sarah (reuse PR #657).
2. Working xAI chat: CRM log, conversational Call/Text/Email/Book offers,
   page-aware teasers, voice button (eve, ephemeral token).
3. SMS alerts, takeover, CRM audit, outbound flag off, compliance log.

## Held
Do not edit `app/api/voice/*`, `app/api/twilio/*`, or `lib/grok/voice-sip.ts`.
Outbound flag stays off.

Skills read: AGENTS.md CORE RULES, sarah-spec, Counsel memo greeting.
