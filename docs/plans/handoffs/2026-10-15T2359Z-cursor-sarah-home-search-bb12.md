# 2026-10-15 (Cursor, Sarah home search)

Surface: Cursor cloud. Branch `cursor/sarah-home-search-bb12`.

## Landed
Lean home search in `lib/sarah/home-search.ts`. "three bedrooms in
Sisters" parses beds+city, queries `searchListingsAll` (active only),
returns 3-5 cards plus `/homes-for-sale/sisters?beds=3`. Zero-match
widens. One follow-up, then alerts + broker capture with by-Sarah
tags. Voice speaks the short summary; cards stay in chat.

Merged `origin/main` (#688 Sarah one-tap voice) into this branch. Kept
their voice loop; re-applied home-search hooks (cards, speakExact,
spoken "three bedrooms in Sisters").

Navigate tool in `lib/sarah/navigate.ts`. "show me homes in Sisters"
uses `router.push('/homes-for-sale/sisters')`. Panel and Eve stay up.
Voice says "Taking you there now". Prompt no longer claims she cannot
change pages.

CI build failed: the client panel imported `home-search.ts`, which
pulls `searchListingsAll` → `next/headers`. Parse, See-all href, and
the follow-up flow now live in `lib/sarah/home-search-parse.ts`. The
panel, cards, and navigate import that file only.

## Next
Land PR #689 after the split build is green, confirm Vercel READY,
live QA text + voice at 375 and 1440.

## Held
Do not edit `app/api/voice/*` or `lib/grok/voice-sip.ts`. Do not send.

Skills read: AGENTS.md CORE RULES, DATABASE_FOR_AI_AGENTS.md §0.
