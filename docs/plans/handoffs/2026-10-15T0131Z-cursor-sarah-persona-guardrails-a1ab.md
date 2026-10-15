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

## Next
PR2: listing-detail teaser bubble (desktop photo + copy; mobile badge
only), session dismiss, reduced-motion, `sarah_teaser_shown` /
`sarah_teaser_clicked`. Then CRM logging, alerts, takeover, voice button.

## Held
Outbound flag off. Phone line must import `lib/sarah` (see hook doc).
Do not edit the CI-locked SMS checkbox.

Skills read: AGENTS.md CORE RULES, Counsel memo, sarah-spec.
