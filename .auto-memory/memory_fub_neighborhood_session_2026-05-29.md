# FUB Neighborhood Tagging + Nurture Session — 2026-05-29 handoff

## DONE & VERIFIED (live FUB, all 18,165 contacts)
- **Neighborhood-tag coverage: 9,197 → ~9,743** (session gain ~+546, all verified via per-contact API pulls)
- **#1 legacy-tag normalize** (scripts/_fub-legacy-tag-normalize.mjs): 633 tagged, 0 err.
  CalderaSprings→neighborhood:caldera-springs, OldBend→neighborhood:bend-old-bend, WestHills→subdivision:west-hills
- **#2 + all-source geocoder** (scripts/geocode-all-untagged.mjs, APPLY=1): walks ALL people w/ no neighborhood tag + a usable address (addresses[].street → customSellerPropertyAddress → background-phrase). Final run: 116 tagged, 32 property-addresses written, 1520 no_match (genuinely OUT of Bend — Portland/Seattle/Redmond/OOS, correctly skipped), 182 centroid_reject, 0 err. FIXED bugs in it: pagination must use _metadata.nextLink (NOT &next= token, collapses w/ fields=allFields); added centroid-rejection guard (accept only street_address/premise/ROOFTOP/RANGE_INTERPOLATED; reject locality/APPROXIMATE).
- **#3 background recovery** (scripts/recover-bg-addresses-and-tag.mjs): property address was embedded in `background` field outreach text ("...selling your home at <ADDR>"). FUB DISPLAYS customSellerPropertyAddress as an IDX-style property card (BatchData beds/baths enrichment) which made it LOOK like a viewed listing — it is actually the OWNED property. Confirmed via code: customSellerPropertyAddress written by 5 flows (seller LP, expired LP, FSBO detector, expired processor, county-assessor import) — all OWNED, never IDX. Recovered + wrote ~128 addresses + tags.

## KEY DATA TRUTHS
- Of 8,538 with no neighborhood tag: ~1,819 HAVE a street address but only ~116 are actually IN Bend (rest live elsewhere — out-of-area mailing). ~6,558 have NO street anywhere (empty addresses[] = {street:"",city:"Bend"}).
- `city:bend` tag is POLLUTED: ~1,400 county-assessor records are Tumalo/Terrebonne/unincorporated, NOT Bend. Any smart list keyed on city:bend over-includes them. FIX: re-base lists on geo:local (geocode-verified). NOT YET DONE — flagged to Matt.
- Slug schemes inconsistent: city districts = neighborhood:bend-* ; resorts/NWX/AwbreyGlen = bare slug. Cosmetic, not yet normalized.

## BLOCKED — needs Matt
- **IgniteRE farm CSVs**: Matt logged in but on a DIFFERENT browser/profile than the MCP-driven "mac mini chrome" (deviceId deb95298-0353-4203-be38-27ac39834b22), which still shows logged-out. To proceed: Matt must either (a) log into Ignite IN the mac mini chrome window the MCP drives, OR (b) export Farming→Saved Farms CSVs himself to ~/Downloads. Then: name-match against the ~6,558 addressless FUB contacts → backfill addresses → geocode. OAuth link Matt sent was single-use PKCE (consumed).
- Original Farm + Expired import CSVs (June 2025) would also solve the ~6,558 addressless backfill.

## OTHER OPEN (pre-existing)
- Task #20: Expired (AP 71)/FSBO (AP 72) crons use applyActionPlan → lands "Paused" = silent no-op. Real shipped bug.
- Seller/buyer nurture automations #109/#110 BUILT in FUB but DISABLED — Matt must explicitly enable (emails real leads).
- 3 smoke-test contacts tagged zzz-smoketest-delete-20260529 (26993/4/5) can be deleted.

## SCRIPTS (kept, reusable)
- scripts/geocode-all-untagged.mjs (LIMIT=n, APPLY=1)
- scripts/geocode-bend-fub-population.mjs (city:bend only)
- scripts/recover-bg-addresses-and-tag.mjs (reads out/fub-nurture/bg-address-candidates.json)
- scripts/_fub-legacy-tag-normalize.mjs
All use X-System header, _metadata.nextLink pagination, lookup_address_geo RPC (Supabase dwvlophlbvvygjfxcrhm).
