# Handoff — Sarah phone-line hook exports

- **Surface:** Cursor cloud
- **Time:** 2026-10-15T0205Z
- **Branch:** `cursor/sarah-phone-hooks-a1ab`
- **Skills read:** `.cursor/skills/site-queue/SKILL.md`, `.cursor/rules/git-commit.mdc`

## Done

- #646 merged persona, guardrails, and `lib/sarah` onto `main` (`655eb91c7`).
- This branch re-lands the follow-up that missed that squash: `notifyLiveSession`, `sarahSessionConferenceJoin`, `mattConferenceJoin`, plus conference name helpers. Phone agent imports `@/lib/sarah`. Do not edit `app/api/voice/*`, `app/api/twilio/*`, or `lib/grok/voice-sip.ts`.

## Next

- Land this PR so the phone line can call the helpers.
- Listing teaser stays on `cursor/sarah-listing-teaser-a1ab` (rebase onto main after this lands).
- Alerts PR fills `notifyLiveSession` body (SMS + `/admin/sarah/live/{id}`).

## Blockers

None. `SARAH_OUTBOUND_ENABLED` stays off.

## Import for the phone line

```ts
import {
  notifyLiveSession,
  sarahSessionConferenceJoin,
  mattConferenceJoin,
  sarahLiveConferenceName,
  evaluateSarahTurn,
  buildSarahSystemPrompt,
  sarahGreeting,
} from '@/lib/sarah'
```
