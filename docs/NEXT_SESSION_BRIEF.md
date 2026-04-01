# Launch Readiness Audit & Next Session Brief

**Date:** April 1, 2026  
**Site:** ryanrealty.vercel.app  
**Status:** Near-ready for launch. Key items below need resolution.

---

## LAUNCH READINESS SUMMARY

### ✅ WORKING (34/36 routes return 200)

**Core Pages:**
- Homepage, all city pages (Bend, Redmond, Sisters, Sunriver, La Pine)
- Community pages (Tetherow, Pronghorn, etc.)
- Listing detail pages with photos, maps, CMA, similar listings
- About, Team, Contact, Reviews, Buy, Sell, Join

**Features:**
- CMA / Home Valuation (compute + PDF + email + FUB lead capture)
- Market Reports (weekly reports, PDF/XLSX export, live data dashboard)
- Open Houses (list, map, calendar, RSVP → FUB)
- Video tours on listings
- Save / Like / Share listings (auth-gated)
- Compare listings (up to 4, PDF export)
- Mortgage Calculator, Home Appreciation tool
- Admin dashboard (sync, reports, media, leads, FUB attribution)
- Saved searches + email alerts (daily cron)
- Communities browser

**SEO:**
- robots.txt ✅
- JSON-LD structured data on all major page types ✅
- generateMetadata on key routes ✅
- Canonical URLs ✅
- OG images / social sharing ✅

**Tracking:**
- GA4 + GTM (consent-gated) ✅
- Meta Pixel (consent-gated) ✅
- Internal activity tracking (user_activities, visits) ✅
- Lead scoring ✅
- CMA download tracking ✅

**FUB Integration (Follow Up Boss):**
- Contact form → "General Inquiry" ✅
- Home valuation → "Seller Inquiry" + auto-CMA PDF ✅
- CMA PDF download → "Property Inquiry" (high intent) ✅
- Auth/registration → user merge ✅
- Listing views, saves, clicks → property events ✅
- Page views tracked on key pages ✅
- Open house RSVP → FUB event ✅
- Return visits tracked ✅

**Legal:**
- Privacy, Terms, Accessibility, DMCA, Fair Housing — all 200 ✅

---

### ❌ ISSUES TO FIX BEFORE LAUNCH

#### 1. Sitemap returns 404
`/sitemap.xml` returns 404 on production. The file `app/sitemap.ts` exists and generates sitemaps, but something in the build/deployment prevents it from being served. This is critical for SEO — Google needs the sitemap.

**Action:** Debug why `app/sitemap.ts` doesn't produce `/sitemap.xml` on Vercel. May need `generateSitemaps()` export format check or a static sitemap fallback.

#### 2. `/sign-in` route doesn't exist (404)
The login page is at `/login`, not `/sign-in`. Any internal links or nav items pointing to `/sign-in` will break.

**Action:** Either create `/sign-in` route or add a redirect in `next.config.ts`. Check all nav/footer/CTA links for consistency.

#### 3. `NEXT_PUBLIC_SITE_URL` must be set to production domain
Currently defaults to `ryan-realty.com` or `ryanrealty.vercel.app` in various places. All canonical URLs, OG tags, sitemap URLs, and FUB source URLs depend on this.

**Action:** Set `NEXT_PUBLIC_SITE_URL=https://ryanrealty.com` (or whatever the production domain is) in Vercel environment variables before launch.

#### 4. CI build fails on `/communities` prerender
The GitHub Actions CI pipeline fails because `/communities` tries to prerender and hits a `cookies()` call. This doesn't block Vercel deployment but means CI is red.

**Action:** Add `export const dynamic = 'force-dynamic'` to the communities page, or fix the prerender issue.

#### 5. Google Maps key inconsistency
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is used most places, but the Compare page uses `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (different name). Maps on Compare may not work.

**Action:** Standardize to one env var name.

---

### ⚠️ ITEMS TO VERIFY BEFORE LAUNCH

#### Environment Variables (Critical)
These MUST be set in Vercel production environment:

| Variable | Status | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Set | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Set | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Set | ✅ |
| `SPARK_API_KEY` | Set | ✅ For MLS data |
| `NEXT_PUBLIC_SITE_URL` | **CHECK** | Must match production domain |
| `FOLLOWUPBOSS_API_KEY` | Set | ✅ For CRM |
| `RESEND_API_KEY` | Set | ✅ For emails |
| `ADMIN_EMAIL` | **CHECK** | Where admin notifications go |
| `CRON_SECRET` | **CHECK** | Protects cron endpoints |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | **CHECK** | For analytics |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **CHECK** | For maps |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | **CHECK** | For rate limiting |

#### Vercel Cron Jobs
These must be configured in `vercel.json` or Vercel dashboard:

| Cron | Route | Schedule |
|------|-------|----------|
| MLS Sync | `/api/cron/sync-full` | Every few hours |
| Market Report | `/api/cron/market-report` | Weekly Saturday |
| Saved Search Alerts | `/api/cron/saved-search-alerts` | Daily |

#### DNS / Domain
- Point your custom domain to Vercel
- Update `NEXT_PUBLIC_SITE_URL` to the custom domain
- Update Supabase Auth redirect URLs to include the custom domain
- Update Google OAuth redirect URIs

#### Supabase Auth
- Confirm redirect URLs in Supabase → Authentication → URL Configuration include the production domain
- Verify Google OAuth is configured with the production domain callback

---

## WHAT WAS DONE IN THIS SESSION

### CMA System (Major Fix)
1. **Was completely broken** — RPC referenced wrong column names, code used snake_case but DB uses RESO PascalCase
2. **Fixed all data queries** — lib/cma.ts, CMA PDF route, home valuation actions, ListingValuationSection
3. **Added canonical ClosePrice fallback chain** — `ClosePrice → details->>'ClosePrice' → ListPrice`
4. **Result:** Went from 1 comp / low confidence to **10 comps / HIGH confidence / $627K estimate** for test property
5. **Wired CMA section into listing detail pages** (was built but never imported)
6. **Fixed market report PDF** — was crashing on missing fonts (AzoSans/Amboqia → Inter CDN fallback)

### Community Profiles
- Wired rich profiles (amenities, lifestyle, price range) into search pages for 8 resort communities
- Populated 10 major subdivision hero banners via Unsplash

### Previous Sessions (from conversation history)
- Performance optimization (LCP 14s → 2.5s)
- Streaming architecture (Suspense wrappers in layout)
- Hero image/video optimization
- Accessibility fixes (contrast, ARIA)
- Curated Central Oregon imagery for all cities
- Video-first listing tiles

---

## PROMPT FOR NEXT SESSION

```
Read docs/NEXT_SESSION_BRIEF.md — it has the full audit from the last session. Then execute.

BEHAVIORAL RULES (non-negotiable):
- ALWAYS push directly to main. Never create feature branches. Never create PRs. Just push to main. Use SKIP_LOCAL_GATES=1 if pre-push hooks block you.
- NEVER wait or ask permission. Execute immediately. If something needs doing, do it. Don't list options and wait for me to pick — make the expert decision and ship it.
- NEVER say something is "done" or "complete" without verifying it actually works on production (ryanrealty.vercel.app). Take screenshots. Curl the endpoints. Check the HTTP status codes. If you didn't verify it on production, it's not done.
- NEVER do the bare minimum. Be thorough. When fixing something, check for the same pattern everywhere, not just the one file you found. When testing, test all the edge cases, not just the happy path.
- NEVER stop working and summarize "next steps" — just do those steps. Keep going until the work is actually complete.
- Always run npm run build before committing. Fix any build errors before pushing.
- Commit frequently with conventional commit messages (feat:, fix:, chore:). Small commits, push immediately after each one.
- When you encounter a problem, fix it. Don't report it and wait. Fix it, verify the fix on production, then move on.
- Research best practices when you're unsure. Use web search. Don't guess.

PRIORITIES:
1. Fix the 5 issues in "ISSUES TO FIX BEFORE LAUNCH" section of NEXT_SESSION_BRIEF.md
2. Full end-to-end test of every feature on production:
   - Home valuation form submission → verify lead in valuation_requests DB table
   - Save/like/share a listing (requires auth flow test)
   - Contact form → verify FUB event fires
   - CMA PDF download from a listing page
   - Market reports with real data
   - Open houses
   - Compare listings
3. Verify tracking: GA4, FUB events, Meta Pixel — check the code paths, not just "the code exists"
4. Create a concrete launch checklist for ME (the owner) — DNS steps, env vars to set, Supabase config, Vercel crons, Google OAuth, domain verification
5. Fix every bug you find along the way — don't skip anything

This is my entire business. Thoroughness over speed. Never cut corners.
```

---

## FILES CHANGED THIS SESSION

### CMA Fixes
- `lib/cma.ts` — Complete rewrite of getSubject, getCompCandidates, filterComps, resolveClosePrice
- `components/listing/ListingValuationSection.tsx` — Fixed column names, address matching
- `app/api/pdf/cma/route.ts` — Fixed column names
- `app/home-valuation/actions.ts` — Fixed column names
- `app/listing/[listingKey]/page.tsx` — Added ListingValuationSection import + Suspense wrapper
- `lib/pdf/report-pdf.tsx` — Font fallback (Inter CDN)
- `supabase/migrations/20260401000000_fix_cma_comps_rpc.sql` — Fixed RPC with COALESCE chain

### Community & Search
- `app/search/[...slug]/page.tsx` — Wired community profiles, fixed require→import
- `.cursor/rules/cma-data-model.mdc` — New rule for CMA data model guidance
