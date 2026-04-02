# Next Session Brief

**Date:** April 2, 2026
**PR:** #15 — 22 commits, needs merge to main
**Branch:** `cursor/launch-readiness-audit-14c9`

---

## RULES FOR THE NEXT AGENT (READ THIS FIRST)

### How to not be a piece of shit

1. **NEVER say something is done without verifying it with real data.** Don't grep for a string and call it verified. Actually query the database, count the rows, compare to what the page shows. If you say "all 6,580 listings are in the sitemap," you better have run `curl /sitemap.xml | grep -c "<url>"` and seen 6,580.

2. **Supabase returns MAX 1,000 rows per query.** This is the single biggest gotcha in this codebase. Every `.limit(5000)` or `.limit(10000)` is a LIE — you get 1,000 rows max regardless. Use `lib/supabase/paginate.ts` → `fetchAllRows()` for any query that could return >1,000 rows. Use `{ count: 'exact', head: true }` for counts.

3. **Before you say a page "works," open it in a real browser and scroll the entire thing.** Take a screenshot. Check that real data renders — not skeletons, not empty sections, not placeholder text. Check mobile too.

4. **When you find a bug in one place, search for the same pattern everywhere.** The 1,000-row truncation was in 15+ files. The missing OG images were on 22 pages. The `ryanrealty.vercel.app` fallback was in 3 files. ONE instance is never the whole story.

5. **Don't report issues and ask permission. Fix them.** The owner doesn't want a list of problems — he wants them fixed. If you find it, fix it, verify it, commit it, push it.

6. **Commit after EVERY change. Push immediately.** Not in batches. Every single fix gets its own commit with a descriptive message.

7. **The owner has spent $1,000+ on agents who keep finding problems they should have caught the first time.** Don't be that agent. Do it right the first time or don't do it at all.

8. **Be efficient. Don't waste tokens.** Build the server ONCE at the start. Don't start 16 servers across a session. Don't do shallow passes that require re-doing the same work 4 times. Go deep the FIRST time — check every page, every query, every table, every route. One thorough pass beats four lazy passes, and costs 1/4 as much.

9. **See things end to end.** Don't just check that a component exists — trace the entire path: Does the data query return correct results? Does the component receive the data? Does it render? Does it show REAL data, not zeros or empty arrays? Does it look right on desktop AND mobile? Does the user interaction work (click, submit, save)? If any link in the chain is broken, the feature is broken. Period.

10. **Think like a competitor.** Before calling any page done, ask: "If I were a homebuyer comparing this to Zillow, would this page make me stay or leave?" If the answer is leave, it's not done. This is a real business. Every page either wins or loses customers.

11. **Check table row counts FIRST.** Before writing any code, run `select count(*) from every relevant table`. Know what data actually exists. Don't build features on empty tables and then say "it works." It doesn't work if there's no data. Flag empty tables immediately so the owner knows what's a code problem vs a data pipeline problem.

---

## WHAT'S BEEN DONE (PR #15)

### Merge PR #15 first, then continue.

The PR has 22 commits. Key changes:

- **Sitemap pagination:** All Supabase queries in `app/sitemap.ts` use `fetchAllRows()`. Went from 74 listing URLs to 6,580 (all active listings). Total sitemap: 25,125 URLs.
- **Data truncation fix:** 15+ server actions across `listings.ts`, `cities.ts`, `communities.ts`, `market-stats.ts` now paginate or use count queries instead of hitting the 1,000-row cap.
- **Property type:** Shows "Single Family Residence" not "A" (MLS code). Fixed in `ShowcaseKeyFacts.tsx` + `listing-detail page.tsx`.
- **Agent card:** Ryan Realty CTA is primary. Listing agent is small attribution text at bottom. Fixed in `ShowcaseAgent.tsx`.
- **Listing detail:** Added "Other homes in [subdivision]" section. Wired `listing_history` fallback for price/status history.
- **SEO:** OG images on all 22 pages that were missing them. Canonical URLs fixed. All redirects working.
- **FUB:** try/catch on all API calls. CMA PDF and listing inquiry tracking are fire-and-forget.
- **Reports:** Suspense wrappers for instant hero render.
- **Loading states:** Added for search, listing detail, buy, reviews pages.
- **Open houses:** Section wired on city pages (renders when data exists).

### Shared utility created
`lib/supabase/paginate.ts` — `fetchAllRows<T>(supabase, table, selectCols, buildQuery?)` — use this for ANY query that might return >1,000 rows.

---

## WHAT'S NOT DONE

### Data Pipeline (can't be fixed with code alone)
- `open_houses` table: **0 rows**. MLS sync doesn't populate it. Components are wired but there's no data.
- `listing_agents` table: **0 rows**. Agent data comes from listing row columns instead.
- `listing_videos` table: **0 rows**. Video data is in `details` JSON.
- `listing_history`: **2M rows** but only for older/closed listings. New active listings have 0 history (expected — they haven't changed yet).

### Feature Gaps (compared to Zillow)
- No school information on listing detail
- No walkability/transit/bike scores
- No climate/flood risk
- No tax history (component exists at `components/listing/TaxHistory.tsx` — needs tax data from MLS)
- No "Our listings" slider showing Ryan Realty's own listings across statuses
- Community page content needs audit — verify each has unique description

### Performance
- FCP/LCP are fast (112ms/192ms) — Suspense streaming works
- Total page stream time: 10-16s on this VM, expect 2-4x faster on Vercel
- The pagination queries make total stream time longer but data is now CORRECT

### Owner Actions (documented in docs/LAUNCH_CHECKLIST.md)
1. Set `NEXT_PUBLIC_SITE_URL` in Vercel (confirm: `ryan-realty.com` vs `ryanrealty.com`)
2. Update Supabase Auth redirect URLs for production domain
3. Update Google OAuth redirect URIs
4. Set `ADMIN_EMAIL`, `CRON_SECRET`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
5. Increase MLS sync frequency in `vercel.json` (currently weekly full sync — should be daily minimum)

---

## HOW TO VERIFY THINGS ACTUALLY WORK

### Sitemap
```bash
npm run build && npx next start --port 3000 &
sleep 10
curl -s http://localhost:3000/sitemap.xml | grep -c "<url>"
# Should be ~25,000+
```

### Listing counts match database
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { count } = await sb.from('listings').select('ListingKey', { count: 'exact', head: true }).or('StandardStatus.is.null,StandardStatus.ilike.%Active%');
  console.log('DB active listings:', count);
})();
"
# Then check the sitemap listing count matches
```

### Page renders real data
```bash
# Check a city page shows correct count
curl -s http://localhost:3000/homes-for-sale/bend | grep -oP '\d[\d,]+ listing'
# Should show 1,000+ listings, not 0
```

### No truncated queries remain
```bash
# Search for any .limit() > 500 without pagination
rg '\.limit\([2-9][0-9]{2,}\)|\.limit\([1-9][0-9]{3,}\)' app/actions/ lib/ --glob '*.ts'
# Each result should either use fetchAllRows OR be an intentional display limit
```

---

## KEY FILES

| File | What it does |
|------|-------------|
| `lib/supabase/paginate.ts` | `fetchAllRows()` — paginate past 1,000-row cap |
| `app/sitemap.ts` | Dynamic sitemap with all URLs |
| `app/actions/listings.ts` | Main listing queries — browse, search, counts, stats |
| `app/actions/listing-detail.ts` | Single listing data + similar + subdivision + history |
| `app/actions/cities.ts` | City page data — subdivisions, communities, stats |
| `app/actions/communities.ts` | Community index — listing counts, median prices |
| `app/actions/market-stats.ts` | Market pulse — active count, median price, DOM |
| `docs/LAUNCH_CHECKLIST.md` | Step-by-step launch instructions for the owner |
| `docs/GOALS_AND_UI_AUDIT.md` | Full audit checklist (18 sections, 200+ items) |
