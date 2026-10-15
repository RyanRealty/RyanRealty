# 2026-10-15 (Cursor, Sarah public records)

Surface: Cursor cloud. Branch `cursor/sarah-public-records-4f3b`.

## Landed
Sarah looks up permits, zoning, ADUs, lot rules, and outbuildings.
Stored `listings.parcel_number` is the Deschutes DIAL account. Zoning
comes from LandFD plus `data/zoning/definitions.json`. DIAL HTML is one
user-initiated page (robots Disallow: /, cached 6h). Crook GIS taxlots
where practical. Jefferson has no public layer. Prompt 1.1.0: let me
try and find out, cite the source, verify, no legal determination,
broker offer. CI fixtures in `lib/sarah/public-records.test.ts`.

## Next
Land the PR, Vercel READY, live QA: Zenith shop permit and a Bend ADU
question. Delete the branch after merge.

## Held
Do not edit `app/api/voice/*`, `app/api/twilio/*`, or `lib/grok/voice-sip.ts`.
Phone imports `LOOKUP_PUBLIC_RECORDS_TOOL` from `lib/sarah`. Do not send.

Skills read: database-canonical-reference, AGENTS.md CORE RULES.
