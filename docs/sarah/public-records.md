# Sarah public-records lookup

Sarah answers permit, zoning, ADU, lot-rule, and outbuilding questions from stored MLS fields first, then documented public endpoints. She does not crawl, log in, or invent a permit, zone, or year.

## What we already store

Per `docs/DATABASE_FOR_AI_AGENTS.md` §4 and §2:

| Need | Where |
|---|---|
| Deschutes DIAL account | `listings.parcel_number` (same id as Dial2_Taxlots `ACCOUNT_ID`) |
| County | `listings.county` |
| Coordinates | `listings.Latitude`, `listings.Longitude` |
| Lot polygon | `public.taxlots` via `taxlots_near_point()` (Deschutes, Crook, and three other counties; not Jefferson) |
| City / county ADU and lot rules | `data/zoning/definitions.json` via `resolveZoning` |
| CMA site intelligence (not called on the chat hot path) | `lib/cma/county.ts`, `lib/cma/assessor.ts`, `lib/cma/development-rules.ts` |

MLS `details.Zoning` is often masked (`********`). Do not treat that as a zone.

## Live sources (user-initiated, cached 6 hours)

| Source | Endpoint | Used for |
|---|---|---|
| Deschutes County GIS zoning | `https://maps.deschutes.org/arcgis/rest/services/OpenData/LandFD/MapServer/3` | Zone at the listing point |
| Deschutes County DIAL | `https://dial.deschutes.org/Real/Permits/{account}` | Permit table for that account |
| Crook County GIS | `https://gis.crookcountyor.gov/server/rest/services/CC_Taxlots_Helion/FeatureServer/0` | Map-taxlot + `PSO_Link` |
| City / county development codes | URLs on each `definitions.json` row (Bend, Redmond, Sisters, La Pine, Deschutes, Crook, Jefferson) | ADU and lot-rule citations |

`dial.deschutes.org/robots.txt` is `User-agent: * Disallow: /`. Sarah does not spider DIAL. She fetches one public permit page when a visitor asks about a parcel we already hold an account for, identifies as `RyanRealty-Sarah/1.0`, and caches the page. ArcGIS REST is the default for parcel and zoning.

Jefferson County publishes no public taxlot or permit layer. Sarah says so and offers the broker.

## Reply rules

Web answers are 2 to 4 short sentences, no repetition:

1. The fact, in plain English. Zone names once (`RS, standard density residential`).
2. One brief caveat: "The city can confirm for this lot."
3. One source link at the end (`Source: …`).
4. The broker offer: "Want me to connect you with {name}?"

On the phone she says "Let me check" while the lookup runs, then the same facts with no URL, and "Want me to text you the source, and connect you with {name}?" If nothing is found, she says so plainly. Property facts only. No neighborhood demographics. Owner names on DIAL pages are stripped and never spoken.

## Code

- Classify / answer / phone tool: `lib/sarah/public-records.ts` (`LOOKUP_PUBLIC_RECORDS_TOOL`)
- Fetch + cache: `lib/sarah/public-records-lookup.ts`
- Parsers: `lib/sarah/public-records-parse.ts`
- Recorded fixtures: `lib/sarah/fixtures/public-records/`
- Web chat: `app/actions/sarah-chat.ts`
- Phone: `lib/grok/voice-sip.ts` registers the tool and runs `handleSipPublicRecordsCall` (spoken format, `Let me check` filler). Does not transfer or ring anyone.
