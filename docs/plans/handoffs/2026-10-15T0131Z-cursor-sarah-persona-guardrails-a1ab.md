# 2026-10-15 (Cursor, Sarah persona PR1)

Surface: Cursor cloud. Branch `cursor/sarah-persona-guardrails-a1ab`.

## Landed
Shared Sarah module `lib/sarah`: persona, Counsel greetings, mechanical
guardrails, conversion (one ask, pending times), Addendum A outbound gates
with the flag off, listing teaser helpers (30s, session dismiss, listing
detail only). Matt approved `public/images/sarah/avatar.jpg` as the final
avatar (launcher + her messages). Policy `docs/SARAH_POLICY.md`, phone
hooks `docs/SARAH_PHONE_HOOKS.md`. Did not touch `app/api/voice/*` or
`lib/grok/voice-sip.ts`. Calling window reuses `minuteOfDayInTimeZone`.

Phone line owns `app/api/voice/*`, `app/api/twilio/*`, `lib/grok/voice-sip.ts`.
It should import `notifyLiveSession`, `sarahSessionConferenceJoin`,
`mattConferenceJoin`, `sarahGreeting`, and `evaluateSarahTurn` from `lib/sarah`.

## Next
Land this PR so the phone agent can reuse persona/guardrails. Teaser UI is
on `cursor/sarah-listing-teaser-a1ab`. Then CRM logging and alerts.

## Held
Outbound flag off. Do not edit voice/twilio/SIP files from this workstream.

Skills read: AGENTS.md CORE RULES, Counsel memo, sarah-spec.
