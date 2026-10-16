# 2026-10-16 (Cursor, Sarah home search landed)

Surface: Cursor cloud. PR #689 merged. `main` @ f39ab2d5b.

## Landed
Sarah home search + navigate are live on https://ryan-realty.com.
"I'm looking for three bedrooms in Sisters" returns 111 active
homes, 5 cards, See all `/homes-for-sale/sisters?beds=3`.
"show me homes in Sisters" `router.push`es that search. Panel
stays open. Voice stays asking/listening and says Taking you
there now. Client imports `home-search-parse`, not the DAL.

Vercel production READY `dpl_9rdYmjuDxrjHwSjrT6G71ESKDKdS`.

## Next
None on this branch. Do not send.

## Held
Do not edit `app/api/voice/*` or `lib/grok/voice-sip.ts`.

Skills read: AGENTS.md CORE RULES, DATABASE_FOR_AI_AGENTS.md §0.
