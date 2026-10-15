# 2026-10-15 (Cursor, Sarah persona PR1)

Surface: Cursor cloud. Branch `cursor/sarah-persona-guardrails-a1ab`.

## Landed
Shared Sarah module `lib/sarah`: persona, Counsel greetings, mechanical
guardrails, conversion (one ask, pending times), Addendum A outbound gates
with the flag off, listing teaser helpers (30s, session dismiss, listing
detail only). Matt approved `public/images/sarah/avatar.jpg` as the final
avatar (launcher + her messages). Policy `docs/SARAH_POLICY.md`, phone
hooks `docs/SARAH_PHONE_HOOKS.md`. Did not touch `app/api/voice/*` or
`lib/grok/voice-sip.ts`.

## Next
PR2 web chat widget, CRM logging, lead create. Then alerts, takeover,
voice button, recaps/spam/Spanish/facts, barge-in + outbound dialer,
compliance log + weekly review.

## Held
Outbound flag off. Phone line must import `lib/sarah` (see hook doc).
Do not edit the CI-locked SMS checkbox.

Skills read: crm-up-to-snuff (partial), AGENTS.md CORE RULES, Counsel memo,
sarah-spec.
