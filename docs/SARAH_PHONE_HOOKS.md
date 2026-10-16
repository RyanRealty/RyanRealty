# Sarah phone-line hook points

Persona, guardrails, and public-records copy live in `lib/sarah`. The xAI phone session in `lib/grok/voice-sip.ts` registers those tools. Do not edit `app/api/twilio/*` for this lookup.

## On inbound answer

1. Greeting: `sarahGreeting('voice')` (Counsel verbatim). Replace `RECEPTIONIST_GREETING`.
2. Model instructions: `buildSarahSystemPrompt({ channel: 'voice', listingFreshness })`. Replace `RECEPTIONIST_PROMPT`. Drop the qualify-the-caller interview.
3. Live alert: `notifyLiveSession({ channel: 'voice', sessionId, deskBrokerSlug, ... })` (`notifySarahLiveSession` is the same function). `deskBrokerSlug` is the CRM assigned broker, Matt when unassigned.
4. Barge-in: put the SIP/AI leg in Twilio conference `sarahLiveConferenceName(sessionId)` using `sarahSessionConferenceJoin(sessionId)` (starts and ends the conference). Matt joins with `mattConferenceJoin(sessionId, 'listen' | 'coach' | 'barge')`. Use existing `referSipCall` only as the transfer path.

## During the call

5. Recording objection: `evaluateSarahTurn` mode `stop-recording`. End the AI session. Do not keep recording. Take a callback number.
6. Urgent: warm transfer to Matt via the existing transfer tool and `receptionist-refer` allowlist. If no answer in about 25 seconds, take a message and send Matt an URGENT SMS.
7. Guardrails: run `evaluateSarahTurn` on each caller turn (or post-filter with `findGuardrailViolations`) so a model slip cannot quote a price opinion or steer.
7a. Public records: `voice-sip` registers `LOOKUP_PUBLIC_RECORDS_TOOL` and runs `handleSipPublicRecordsCall`. She says "Let me check" while it runs, then the spoken answer (no URL; offer to text the link). Do not invent a permit, zone, or year. Do not ring anyone for a records lookup.

## On hangup

8. Keep `logReceptionistCall`. Then the shared Sarah CRM recap pipeline (later PR): note, field updates attributed "by Sarah", recap SMS or email.

## Outbound

9. Dial only through `evaluateOutboundDial` then a later `placeSarahOutboundCall`. `SARAH_OUTBOUND_ENABLED` stays off. Never dial banned lead sources. Speak within 2 seconds of answer. 10-second opener includes "say stop or press 9".
