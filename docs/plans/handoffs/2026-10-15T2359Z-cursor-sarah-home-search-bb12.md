# 2026-10-15 (Cursor, Sarah home search)

Surface: Cursor cloud. Branch `cursor/sarah-home-search-bb12`.

## Landed
Lean home search in `lib/sarah/home-search.ts`. "three bedrooms in
Sisters" parses beds+city, queries `searchListingsAll` (active only),
returns 3-5 cards plus `/homes-for-sale/sisters?beds=3`. Zero-match
widens. One follow-up, then alerts + broker capture with by-Sarah
tags. Voice speaks the short summary; cards stay in chat.

## Next
Land the PR, confirm Vercel READY, live QA at 375 and 1440 with that
phrase.

## Held
Do not edit `app/api/voice/*` or `lib/grok/voice-sip.ts`. Do not send.

Skills read: AGENTS.md CORE RULES, DATABASE_FOR_AI_AGENTS.md §0.
