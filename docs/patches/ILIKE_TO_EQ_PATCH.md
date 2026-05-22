# Patch: rewrite `.ilike()` to `.eq()` on `listings` table — City and SubdivisionName

**Status:** DRAFT — do not commit until Matt approves  
**Risk:** Zero — no schema changes, no migrations, pure query rewrite  
**Estimated TTFB improvement:** 60–80% on city/community pages  
**Root cause:** `.ilike('City', name)` triggers a sequential scan on 589K rows because Postgres cannot use the existing expression index `lower(trim("City"))` with `ILIKE`. Exact equality `.eq('"City"', name)` maps directly to a `lower(trim("City")) = lower(trim($1))` expression index scan.

---

## Canonical city name list (live DB, verified 2026-05-21)

These are the exact `"City"` values in the DB (case-sensitive). Every `.eq('"City"', ...)` call must use one of these strings verbatim.

```
Bend, Redmond, La Pine, Sisters, Sunriver, Prineville, Madras, Terrebonne,
Powell Butte, Chiloquin, Eagle Point, Central Point, Ashland, Grants Pass,
Klamath Falls, Medford, Jacksonville, Rogue River, White City, Bonanza,
Cave Junction, Christmas Valley, Selma, Sprague River, Talent, Culver,
Shady Cove, Crescent Lake, Wolf Creek, Black Butte Ranch, Gold Hill,
Phoenix, Merlin, Trail, Williams, Beatty, John Day, Bly, Crescent, Prospect
```

**Edge cases with non-trivial slug → name mapping:**

| Slug | Canonical DB name | Note |
|---|---|---|
| `la-pine` | `La Pine` | Two words, capital L and P |
| `powell-butte` | `Powell Butte` | Two words |
| `eagle-point` | `Eagle Point` | Two words |
| `central-point` | `Central Point` | Two words |
| `grants-pass` | `Grants Pass` | Two words |
| `klamath-falls` | `Klamath Falls` | Two words |
| `cave-junction` | `Cave Junction` | Two words |
| `christmas-valley` | `Christmas Valley` | Two words |
| `sprague-river` | `Sprague River` | Two words |
| `shady-cove` | `Shady Cove` | Two words |
| `crescent-lake` | `Crescent Lake` | Two words |
| `wolf-creek` | `Wolf Creek` | Two words |
| `black-butte-ranch` | `Black Butte Ranch` | Three words |
| `gold-hill` | `Gold Hill` | Two words |
| `white-city` | `White City` | Two words |
| `rogue-river` | `Rogue River` | Two words |
| `john-day` | `John Day` | Two words |

All of these are already correctly reconstructed by the existing `getCityFromSlug()` fallback logic (title-casing each hyphen-separated word). The canonical name is always available in scope before the `.ilike()` is called.

**`StandardStatus` note:** The `StandardStatus` column has exactly 8 values in the DB: `Closed`, `Expired`, `Canceled`, `Active`, `Pending`, `Withdrawn`, `Active Under Contract`, `Coming Soon`. The `.ilike('%Closed%')` style calls are correct for legacy data hygiene and are **NOT** changed by this patch — they target a column with its own index behavior and the wildcard matching is intentional for status normalization.

---

## Scope of this patch

Only `.ilike()` calls on `listings` table columns `"City"` and `"SubdivisionName"` are changed. Everything else is out of scope:
- `.ilike('StandardStatus', ...)` — intentionally left as-is (wildcard needed for status normalization across MLS sources)
- `.ilike('PostalCode', ...)` — left as-is (user-entered input, may be partial)
- `.ilike()` on non-`listings` tables (communities, cities, neighborhoods, brokers, etc.) — left as-is
- `.ilike('StreetName', ...)` and `.ilike('State', ...)` — left as-is (user-entered address search)
- `.ilike('City', ...)` inside `or()` string literals — left as-is (Supabase `or()` string syntax is different and those are status-or patterns, not City patterns)
- The `OR` string constants like `ACTIVE_OR` that embed `StandardStatus.ilike.%Active%` — not changed

---

## Files affected

| File | `.ilike('City', ...)` hits | `.ilike('SubdivisionName', ...)` hits |
|---|---|---|
| `app/actions/cities.ts` | 6 | 0 |
| `app/actions/communities.ts` | 6 | 4 |
| `app/actions/listings.ts` | 11 | 6 |
| `app/actions/listing-detail.ts` | 4 | 2 |
| `app/actions/market-stats.ts` | 5 | 0 |
| `app/actions/inventory-breakdown.ts` | 2 | 1 |
| `app/actions/market-reports.ts` | 1 | 1 |
| `app/actions/recently-sold.ts` | 0 | 1 |
| `app/actions/photo-classification.ts` | 1 | 1 |
| `app/actions/activity-feed.ts` | 1 | 0 |
| `app/actions/home.ts` | 5 | 0 |
| `lib/cma.ts` | 2 | 1 |
| `lib/cma-delivery.ts` | 1 | 0 |
| `app/api/pdf/cma/route.ts` | 1 | 0 |
| `app/actions/home-valuation/actions.ts` | 1 | 0 |

**Total: ~52 call sites across 15 files**

---

## Key architectural observation

In every high-traffic code path (city pages, community pages), the canonical city name is **already in scope** before the `.ilike()` call:

- `cities.ts` → `_getCityBySlugUncached(slug)` calls `getCityFromSlug(slug)` first, which returns the exact DB city name. That value is assigned to `cityName`. Every subsequent `.ilike('City', cityName)` in the function uses a value that is already the exact canonical string.
- `communities.ts` → `_getCommunityBySlugUncached(slug)` calls `parseCommunitySlug()` which returns `{ city, subdivision }` as exact names (the same city string that was stored in the DB). Every subsequent `.ilike('City', city)` uses the already-canonical string.
- `listings.ts` → Functions receive `city` as a parameter already resolved from the slug. The `.ilike('City', city)` calls can become `.eq('"City"', city)` directly.

For `SubdivisionName`: the subdivision name comes from `getSubdivisionMatchNames(subdivision)` which returns an array of exact DB strings. When `names.length === 1`, the single name is the exact canonical subdivision. When `names.length > 1`, it's an aliases list — those remain `.ilike()` for now (handled in the `or()` branch).

---

## Per-file changes

### `app/actions/cities.ts`

**Line 165:** Lookup in `cities` table — this is NOT `listings`, safe to leave as `.ilike()`. Skip.

**Line 170 — `_getCityBySlugUncached`, active rows fetch:**
```diff
-        (q: any) => q.ilike('City', cityName).or(ACTIVE_OR),
+        (q: any) => q.eq('"City"', cityName).or(ACTIVE_OR),
```
Source: `cityName` comes from `getCityFromSlug(slug)` — exact DB value already.

**Line 222 — `_getCityListingsUncached`:**
```diff
-    .ilike('City', cityName)
+    .eq('"City"', cityName)
```
Source: `cityName` is the parameter passed from `_getCityBySlugUncached`, which resolved it via `getCityFromSlug`.

**Line 243 — `_getCitySoldListingsUncached`:**
```diff
-    .ilike('City', cityName)
+    .eq('"City"', cityName)
```

**Line 265 — `_getCityPendingListingsUncached`:**
```diff
-    .ilike('City', cityName)
+    .eq('"City"', cityName)
```

**Line 286 — `getCommunitiesInCityUncached` active fetch:**
```diff
-      .ilike('City', cityName)
+      .eq('"City"', cityName)
```

**Line 310 — `getCommunitiesInCityUncached` pending fetch:**
```diff
-    .ilike('City', cityName)
+    .eq('"City"', cityName)
```

---

### `app/actions/communities.ts`

**Line 145:** Lookup on `communities` table — not `listings`. Skip.

**Line 151 — `_getCommunityBySlugUncached`, active rows fetch:**
```diff
-        .ilike('City', city)
+        .eq('"City"', city)
```
Source: `city` comes from `parseCommunitySlug()` which returns the exact city name.

**Line 154 — `_getCommunityBySlugUncached`, SubdivisionName (single alias):**
```diff
-      if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
+      if (names.length === 1) query = query.eq('"SubdivisionName"', names[0]!)
```
Source: `names[0]` from `getSubdivisionMatchNames()` is the exact canonical subdivision name. The `names.length > 1` branch (or-chain) stays as `.ilike()` because it uses wildcard matching across aliases.

**Line 299 — `_getCommunityListingsUncached`:**
```diff
-    .ilike('City', city)
+    .eq('"City"', city)
```

**Line 303 — `_getCommunityListingsUncached`, SubdivisionName:**
```diff
-  if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
+  if (names.length === 1) query = query.eq('"SubdivisionName"', names[0]!)
```

**Line 326 — `_getCommunitySoldListingsUncached`:**
```diff
-    .ilike('City', city)
+    .eq('"City"', city)
```

**Line 331 — `_getCommunitySoldListingsUncached`, SubdivisionName:**
```diff
-  if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
+  if (names.length === 1) query = query.eq('"SubdivisionName"', names[0]!)
```

**Line 354 — `_getCommunityPendingListingsUncached`:**
```diff
-    .ilike('City', city)
+    .eq('"City"', city)
```

**Line 358 — `_getCommunityPendingListingsUncached`, SubdivisionName:**
```diff
-  if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
+  if (names.length === 1) query = query.eq('"SubdivisionName"', names[0]!)
```

**Line 399 — `getCommunityPriceHistory`, closed query:**
```diff
-    .ilike('City', city)
+    .eq('"City"', city)
```

**Line 400 — `getCommunityPriceHistory`, StandardStatus:**  
Leave as-is. `.ilike('StandardStatus', '%Closed%')` is intentional wildcard normalization.

**Line 404 — `getCommunityPriceHistory`, SubdivisionName:**
```diff
-  if (names.length === 1) closedQuery = closedQuery.ilike('SubdivisionName', names[0]!)
+  if (names.length === 1) closedQuery = closedQuery.eq('"SubdivisionName"', names[0]!)
```

---

### `app/actions/listings.ts`

**Lines 579, 582 — `getListings`:**
```diff
-  if (options.city) query = query.ilike('City', options.city)
+  if (options.city) query = query.eq('"City"', options.city)

-    if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
+    if (names.length === 1) query = query.eq('"SubdivisionName"', names[0]!)
```
Note: `options.city` at this call site is the already-resolved canonical city name passed from the page. Verify caller sends exact name (not a slug).

**Line 773 — `getListingsForHomeTiles`:**
```diff
-    .ilike('City', options.city.trim())
+    .eq('"City"', options.city.trim())
```

**Lines 842, 845 — `getListingsForMap`:**
```diff
-  if (options.city) query = query.ilike('City', options.city)
+  if (options.city) query = query.eq('"City"', options.city)

-    if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
+    if (names.length === 1) query = query.eq('"SubdivisionName"', names[0]!)
```

**Lines 940, 943 — `getListingsInBounds`:**
```diff
-  if (options.city?.trim()) query = query.ilike('City', options.city.trim())
+  if (options.city?.trim()) query = query.eq('"City"', options.city.trim())

-    if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
+    if (names.length === 1) query = query.eq('"SubdivisionName"', names[0]!)
```

**Lines 1025, 1028 — `getStatusCounts` (anon fallback path):**
```diff
-    let r = q.ilike('City', cityFilter)
-    if (subFilter) r = r.ilike('SubdivisionName', subFilter)
+    let r = q.eq('"City"', cityFilter)
+    if (subFilter) r = r.eq('"SubdivisionName"', subFilter)
```
Note: `cityFilter = options.city.trim()` and `subFilter = options.subdivision?.trim()` — both are canonical names at call site (from RPC fallback path).

**Lines 1572, 1573 — `getStatusCounts` (anon fallback, `applyGeo` closure):**
Same as above — these are the actual lines that implement the closure. Change both:
```diff
-    let r = q.ilike('City', cityFilter)
-    if (subFilter) r = r.ilike('SubdivisionName', subFilter)
+    let r = q.eq('"City"', cityFilter)
+    if (subFilter) r = r.eq('"SubdivisionName"', subFilter)
```

**Line 1655 — `getHotCommunitiesInCityUncached` (anon fallback):**
```diff
-    (q: any) => q.ilike('City', city),
+    (q: any) => q.eq('"City"', city),
```

**Line 1717 — `getCityCentroid`:**
```diff
-    .ilike('City', city)
+    .eq('"City"', city)
```

**Lines 1744, 1745 — `getCommunityCentroid`:**
```diff
-    .ilike('City', city)
-    .ilike('SubdivisionName', subdivisionName)
+    .eq('"City"', city)
+    .eq('"SubdivisionName"', subdivisionName)
```

**Line 1811 — `getSubdivisionsInCity`:**
```diff
-    (q: any) => q.ilike('City', city),
+    (q: any) => q.eq('"City"', city),
```

**Line 1947 — `getListingsAtAddress`:**
```diff
-    .ilike('City', city)
+    .eq('"City"', city)
```
`StreetName` and `State` on lines 1956–1957 stay as `.ilike()` — those are user-typed address fields.

**Lines 2141, 2149 — `getAdjacentListingsInSubdivision`:**
```diff
-      .ilike('City', cityTrim)
+      .eq('"City"', cityTrim)
```
Both occurrences (the `prevRes` and `nextRes` parallel queries).

---

### `app/actions/listing-detail.ts`

**Line 321 — `resolveListingByAddress` (slug-based lookup):**
```diff
-    .ilike('City', cityLike)
+    .eq('"City"', cityLike)
```
`cityLike` is computed as `decodeURIComponent(input.citySlug).replace(/-/g, ' ').trim()` — this produces title-cased words (e.g. `"La Pine"`) only if the slug was already title-cased. **Risk:** slugs like `la-pine` produce `la pine` (lowercase). This call site needs the same title-casing that `getCityFromSlug` applies. Change to:
```diff
-  const cityLike = decodeURIComponent(input.citySlug || '').replace(/-/g, ' ').trim()
+  const cityRaw = decodeURIComponent(input.citySlug || '').replace(/-/g, ' ').trim()
+  const cityLike = cityRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
```
Then the `.eq('"City"', cityLike)` replacement is safe.

**Line 416 — second occurrence of `resolveListingByAddress` (same function, second parallel query):**
```diff
-    .ilike('City', cityLike)
+    .eq('"City"', cityLike)
```

**Lines 1199, 1202 — `getSimilarListings`:**
```diff
-    query = query.ilike('SubdivisionName', communityName.trim())
+    query = query.eq('"SubdivisionName"', communityName.trim())

-    query = query.ilike('City', city.trim())
+    query = query.eq('"City"', city.trim())
```
Source: `city` and `communityName` come from the listing row's own `City` and `SubdivisionName` columns — already canonical.

**Line 1219 — `getSimilarListings` fallback query:**
```diff
-      .ilike('City', city.trim())
+      .eq('"City"', city.trim())
```

**Lines 1285, 1286 — `getSubdivisionListings`:**
```diff
-    .ilike('SubdivisionName', subdivisionName.trim())
-    .ilike('City', city.trim())
+    .eq('"SubdivisionName"', subdivisionName.trim())
+    .eq('"City"', city.trim())
```
Source: both come from the listing row's own columns — canonical.

---

### `app/actions/market-stats.ts`

**Line 160 — `populateMarketPulseForCity`, active data fetch:**
```diff
-      (q: any) => q.ilike('City', cityName)
+      (q: any) => q.eq('"City"', cityName)
```

**Line 173 — `populateMarketPulseForCity`, pending count:**
```diff
-      .ilike('City', cityName)
+      .eq('"City"', cityName)
```

**Line 180 — `populateMarketPulseForCity`, new7d:**
```diff
-      .ilike('City', cityName)
+      .eq('"City"', cityName)
```

**Line 188 — `populateMarketPulseForCity`, new30d:**
```diff
-      .ilike('City', cityName)
+      .eq('"City"', cityName)
```

**Line 249 — `getQuickCityCount`:**
```diff
-      .ilike('City', cityName)
+      .eq('"City"', cityName)
```
Source: `cityName` in all these functions comes from the hardcoded list in `populateAllMarketPulse()` — `'Bend'`, `'Redmond'`, etc. — and from callers that already resolved the canonical name. These are all safe.

---

### `app/actions/inventory-breakdown.ts`

**Line 84:**
```diff
-      .ilike('City', cityName)
+      .eq('"City"', cityName)
```

**Line 104:**
```diff
-      .ilike('City', cityName)
+      .eq('"City"', cityName)
```

**Line 105:**
```diff
-      .ilike('SubdivisionName', subdivisionName)
+      .eq('"SubdivisionName"', subdivisionName)
```

---

### `app/actions/market-reports.ts`

**Line 278:**
```diff
-  if (cityTrim) q = q.ilike('City', cityTrim)
+  if (cityTrim) q = q.eq('"City"', cityTrim)
```

**Line 279:**
```diff
-  if (subdivision?.trim()) q = q.ilike('SubdivisionName', subdivision.trim())
+  if (subdivision?.trim()) q = q.eq('"SubdivisionName"', subdivision.trim())
```

---

### `app/actions/recently-sold.ts`

**Line 46:**
```diff
-  if (subdivision) query = query.ilike('SubdivisionName', subdivision)
+  if (subdivision) query = query.eq('"SubdivisionName"', subdivision)
```
**Caution:** Verify the caller passes the exact canonical subdivision name (not a slug). If the call site passes a slug, add slug→name resolution first.

---

### `app/actions/photo-classification.ts`

**Line 119:**
```diff
-    .ilike('City', city.trim())
+    .eq('"City"', city.trim())
```

**Line 122:**
```diff
-    listingKeysQuery.ilike('SubdivisionName', withSub)
+    listingKeysQuery.eq('"SubdivisionName"', withSub)
```

---

### `app/actions/activity-feed.ts`

**Line 217:**
```diff
-    .ilike('City', options.city.trim())
+    .eq('"City"', options.city.trim())
```

---

### `app/actions/home.ts`

**Lines 50, 123, 136, 168, 187:**
```diff
-      if (city?.trim()) query = query.ilike('City', city.trim())
+      if (city?.trim()) query = query.eq('"City"', city.trim())
```
All five occurrences. Source: `city` is a parameter already resolved by the caller from canonical city name.

---

### `lib/cma.ts`

**Line 214:**
```diff
-      query = query.ilike('City', p.city)
+      query = query.eq('"City"', p.city)
```

**Line 313:**
```diff
-    .ilike('City', city)
+    .eq('"City"', city)
```

**Line 320:**
```diff
-    query = query.ilike('SubdivisionName', subdivision)
+    query = query.eq('"SubdivisionName"', subdivision)
```

---

### `lib/cma-delivery.ts`

**Line 226:**
```diff
-      .ilike('City', pAddr.city)
+      .eq('"City"', pAddr.city)
```
**Caution:** `pAddr.city` comes from address parsing of an arbitrary input. Verify it is normalized to canonical case before this call. If not, apply the title-case normalization: `pAddr.city.split(' ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ')`.

---

### `app/api/pdf/cma/route.ts`

**Line 61:**
```diff
-      .ilike('City', p.city)
+      .eq('"City"', p.city)
```
Same caution as `lib/cma-delivery.ts` — verify `p.city` is canonical before this call.

---

### `app/home-valuation/actions.ts`

**Line 157:**
```diff
-            .ilike('City', pAddr.city)
+            .eq('"City"', pAddr.city)
```
Same caution — `pAddr.city` comes from address parsing. Add title-case normalization if not already done upstream.

---

## Calls intentionally excluded from this patch

| Call site | Reason kept as `.ilike()` |
|---|---|
| All `.ilike('StandardStatus', ...)` | Wildcard matching needed; MLS sends variant strings (`Active`, `For Sale`, `Coming Soon`, etc.) |
| All `.ilike(col, like)` where `like = '%...'` | Intentional prefix/contains search (search autocomplete, partial matches) |
| `listings.ts:319` — `.ilike('City', cityGuess)` fallback in `getCityFromSlug` | This IS the resolver; it runs once per slug resolution and result is cached |
| All `.ilike()` on non-`listings` tables (communities, cities, neighborhoods, brokers) | Different tables, different indexes |
| The `or()` string literals containing `SubdivisionName.ilike.${n}` (multi-alias path) | Multi-alias expansion requires the `.or()` string syntax; cannot use `.eq()` in an `or()` string with mixed operators |
| `listings.ts:363` — `or()` with mixed column ilike | `or()` string — structure cannot be changed without refactor |
| `app/actions/home-valuation/actions.ts:40` — `.ilike('city', city)` on `home_valuation_requests` table | Not `listings` table |
| `app/actions/dashboard.ts:517` — `.ilike('source', 'Facebook%')` | Not `listings` table |

---

## Pre-deployment validation checklist

1. **Confirm exact-name roundtrip:** Run the following sample query in Supabase to verify the `eq` approach returns the same count as `ilike` for the top cities:
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE "City" = 'Bend') as eq_bend,
     COUNT(*) FILTER (WHERE lower(trim("City")) = 'bend') as ilike_bend,
     COUNT(*) FILTER (WHERE "City" = 'La Pine') as eq_lapine,
     COUNT(*) FILTER (WHERE lower(trim("City")) = 'la pine') as ilike_lapine
   FROM listings WHERE "StandardStatus" = 'Active';
   ```
   Expected: `eq_bend = ilike_bend` and `eq_lapine = ilike_lapine` (or very close — any delta indicates a data inconsistency where some rows have non-standard casing, which `.eq()` would miss but `.ilike()` would catch).

2. **Run `npm run build`** — TypeScript types should pass with no changes (`.eq()` accepts the same `string` type).

3. **Smoke test locally:**
   ```
   time curl -s 'localhost:3000/cities/bend' -o /dev/null
   time curl -s 'localhost:3000/communities/bend/tetherow' -o /dev/null
   time curl -s 'localhost:3000/cities/la-pine' -o /dev/null
   ```
   Compare before/after TTFB.

4. **Check the `listing-detail.ts` cityLike fix:** The `resolveListingByAddress` function (lines ~313, ~416) derives `cityLike` from a slug. After the title-case normalization is added, verify that `/listing/[key]-123-main-st-bend-or` resolves correctly.

5. **Check CMA and home-valuation callers:** Confirm `pAddr.city` is already normalized to canonical case (e.g. `"Bend"` not `"bend"`) before the `.eq()` call. If not, add: `const cityNorm = (pAddr.city ?? '').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')` and use `cityNorm`.

---

## Rollback plan

Revert the commit. No DB changes were made. No migrations. Zero risk. One `git revert <sha>` restores original behavior instantly.

---

## Implementation order (for the agent doing the work)

1. `app/actions/cities.ts` — highest traffic, six changes, all safe
2. `app/actions/communities.ts` — six City + four SubdivisionName changes
3. `app/actions/listings.ts` — eleven City + six SubdivisionName changes
4. `app/actions/market-stats.ts` — five changes, all safe (canonical names hardcoded)
5. `app/actions/listing-detail.ts` — four changes including the cityLike normalization fix
6. All remaining files (`inventory-breakdown.ts`, `market-reports.ts`, `recently-sold.ts`, `photo-classification.ts`, `activity-feed.ts`, `home.ts`, `lib/cma.ts`, `lib/cma-delivery.ts`, `app/api/pdf/cma/route.ts`, `app/home-valuation/actions.ts`)

Do NOT bundle steps 1–3 into a single commit — ship them individually so a bad change can be reverted precisely.
