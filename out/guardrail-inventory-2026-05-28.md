# Ryan Realty — Guardrail Inventory
**Date:** 2026-05-28  
**Built from:** EXECUTION_PLAN.md, CLAUDE.md, MECHANICAL_GATES.md, all `scripts/check-*.mjs`, `scripts/lint-design-tokens.js`, `eslint.config.mjs`, `.husky/*`  
**Purpose:** Every rule the project demands, mapped to its enforcement mechanism and gap. One complete reference, not a patch-on-patch audit.

---

## Complete Rule Inventory (R001–R104)

---

### DATA ACCESS + SQL DISCIPLINE

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R001 | EXECUTION_PLAN §4 + MECHANICAL_GATES G1 | No raw `supabase.from('<table>')` outside `lib/data/` | Any `.ts/.tsx/.js/.mjs` in `app/`, `components/`, `lib/` | HARD_GATE | ESLint `no-restricted-syntax` (error) + `scripts/check-dal-boundary.mjs` (ratcheted CI) | Ratchet allows legacy violations until baseline shrinks. ESLint is `error` (immediate) for new code. Bypassed by env-variable string concat: `.from(`${table}`)` where `table` is a variable — regex won't catch it. API routes in `app/api/` are NOT excluded from ESLint rule, but migration files are excluded. |
| R002 | EXECUTION_PLAN §4 + CLAUDE.md §Supabase | Every `listings` column reference must use double-quoted syntax in SQL | Raw SQL in migration files + `lib/data/` functions | PROSE_ONLY | — | No mechanical check validates SQL string content for quoted column names. G16 checks schema snapshot drift but does not parse SQL inside migration files for column-quoting. This is the bug class that caused the 2026-05-28 "Listing Not Found" regression. |
| R003 | EXECUTION_PLAN §1 + CLAUDE.md §Supabase | Every page reads data through `@/lib/data/` — positive import gate | `app/<route>/page.tsx` files | HARD_GATE | `scripts/check-page-dal.mjs` (ratcheted) | Ratcheted — legacy pages grandfathered. Pages that import DAL via an intermediate `lib/` helper (not `@/lib/data` directly) may pass the import-string check while bypassing the DAL. The `@data-free` escape hatch can be used to permanently opt out any page. API routes (`app/api/`) and admin routes excluded. |
| R004 | EXECUTION_PLAN §5 + CLAUDE.md §Supabase | All four materialized views must refresh successfully for 7 consecutive days | Supabase cron / post-sync hook | PROSE_ONLY | Runtime monitoring only (Supabase advisor digest, `refreshed_at` column alert) | No pre-deploy check. No CI gate. Health depends on runtime observability. |
| R005 | EXECUTION_PLAN §4 | Cache layer: every DAL function must use `unstable_cache` with correct revalidate window per the table | `lib/data/**/*.ts` function implementations | PROSE_ONLY | — | No gate checks that each DAL function actually wraps with `unstable_cache`. A function can omit caching silently. |
| R006 | EXECUTION_PLAN §4 | Zod schema validation on every DAL function input | `lib/data/**/*.ts` | PROSE_ONLY | — | No gate checks that Zod is used. TypeScript strict catches type mismatches but not missing runtime validation. |
| R007 | MECHANICAL_GATES G16 | `docs/DATABASE_SCHEMA_SNAPSHOT.md` must match live Supabase schema (no schema drift) | `docs/DATABASE_SCHEMA_SNAPSHOT.md` committed to HEAD | HARD_GATE | `scripts/check-data-access.mjs` (regenerates via `_agent_schema_dump()` RPC, diffs vs HEAD) | Requires `_agent_schema_dump()` RPC to exist in production Supabase. If the RPC fails (auth issue, network, missing function), the gate errors out rather than failing cleanly. Supabase env vars must be present in CI secrets for this to work. |
| R008 | MECHANICAL_GATES G16 | `docs/DAL_INDEX.md` must match actual `lib/data/` function inventory (no function drift) | `docs/DAL_INDEX.md` committed to HEAD | HARD_GATE | `scripts/check-data-access.mjs` (AST walk of `lib/data/**/*.ts`, diffs vs HEAD) | Same fragility as R007. The `scripts/index-dal.mjs` generator must exist and succeed. |
| R009 | EXECUTION_PLAN §1 | TTFB p95 < 200ms on listing detail, < 300ms on LP routes | Production | PROSE_ONLY | Vercel Analytics dashboard — manual review only | No automated gate. No CI check. Can only be verified post-deploy with 7-day telemetry window. |
| R010 | CLAUDE.md §Data Accuracy | Every market-stat figure must trace to a verified primary source before any deliverable ships | Market report content, videos, emails, listing descriptions | PROSE_ONLY | `citations.json` convention per producer — per-content-piece, not structural | No gate checks that `citations.json` exists alongside a deliverable. Video pipeline has the pattern but no CI enforcement. Web surface has no mechanism at all. |
| R011 | CLAUDE.md §Data Accuracy | Months-of-supply must use formula `active_listings / (closed_last_6_months / 6)` | Market reports, market stat blocks | PROSE_ONLY | — | No gate checks the formula. Any component can display a number labeled "months of supply" without validation. |
| R012 | CLAUDE.md §Supabase | Never `SELECT *` without a tight filter on 589K-row `listings` table | SQL in `lib/data/` + migrations | PROSE_ONLY | — | ESLint DAL rule blocks `from()` calls outside `lib/data/`, but inside `lib/data/` the rule is OFF. No query complexity gate. |

---

### DAL BOUNDARY + PAGE COMPOSITION

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R013 | EXECUTION_PLAN §9 Wave 3 + MECHANICAL_GATES G9 | Every dynamic `[slug]` route must export `generateStaticParams` for ISR pre-render | `app/<route>/page.tsx` with `[slug]` segments | HARD_GATE | `scripts/check-static-params.mjs` (ratcheted) | Ratcheted — legacy routes grandfathered. `@no-static-params` comment permanently opts out any route. Admin, account, api, dashboard excluded. |
| R014 | EXECUTION_PLAN §9 Wave 3 | `force-dynamic` and `revalidate` must not coexist on the same route | `app/<route>/page.tsx` | PROSE_ONLY | ESLint rule proposed in Plan §0.4 but NOT present in `eslint.config.mjs` as of inventory date | PLAN SAYS this should be an ESLint rule — it is NOT wired. Gap confirmed by reading `eslint.config.mjs`. |
| R015 | EXECUTION_PLAN §9 Wave 3 + MECHANICAL_GATES G6 | Each rebuilt page route must import every component the mockup parity.json contract requires | `app/<route>/page.tsx` | HARD_GATE | `scripts/check-mockup-parity.mjs` (ratcheted) | Only catches presence of import statement, not that the component is actually rendered. A page can import a component and never use it. Parity contracts only exist for routes that have `design_system/ryan-realty/ui_kits/<route>/parity.json` — unmapped routes not gated. |
| R016 | MECHANICAL_GATES G7 | Every mockup directory with an `index.html` must have a `parity.json` contract file | `design_system/ryan-realty/ui_kits/<route>/` | HARD_GATE | `scripts/check-mockup-coverage.mjs` (allowlisted) | Allowlist in `scripts/mockup-coverage-allowlist.json` can silently exclude any directory. The allowlist itself has no second-order gate. |
| R017 | EXECUTION_PLAN §9 Wave 3 | Legacy orphan routes must be deleted during Wave 3 rebuild | `/listings/[listingKey]`, `/listing/by-address/[...slug]`, `/app/lp/*` etc. | PROSE_ONLY | — | No gate detects the presence of deprecated routes. They accumulate without consequence. |
| R018 | EXECUTION_PLAN §4 | Every API route (non-page) reads data through `@/lib/data/` — API route DAL discipline | `app/api/**/*.ts` | PROSE_ONLY | `check-page-dal.mjs` explicitly EXCLUDES `app/api/**` | API routes have no positive DAL gate. The ESLint `no-restricted-syntax` rule does cover `app/api/` (not excluded there), so the negative gate applies but no positive gate. |
| R019 | EXECUTION_PLAN §4 | Sentry `tracesSampleRate` must be ≤ 0.2 | `sentry.server.config.ts`, `sentry.edge.config.ts` | PROSE_ONLY | Plan §0.4 calls for an ESLint rule for `tracesSampleRate > 0.2` — NOT present in `eslint.config.mjs` | PLAN SAYS this should be an ESLint rule — it is NOT wired. Gap confirmed. |

---

### BRAND VOICE + CONTENT

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R020 | CLAUDE.md §3 + MECHANICAL_GATES G2/G3 | Em-dash (U+2014) and en-dash (U+2013) banned in body prose | JSX text + string literals in `app/`, `components/` | HARD_GATE | ESLint `rr-brand-voice/no-violations` (error) + `scripts/check-brand-voice.mjs` (ratcheted CI) | Exception: standalone `"—"` as data placeholder is allowed. ESLint covers JSX + JSX attribute strings; `check-brand-voice.mjs` covers ALL string literals in `app/` and `components/`. Both are ratcheted. Non-JSX config/data files (JSON, YAML) not scanned. |
| R021 | CLAUDE.md §3 + MECHANICAL_GATES G2 | Semicolons banned in user-facing prose (not code syntax) | JSX text + string-literal JSX attrs | HARD_GATE | ESLint `rr-brand-voice/no-violations` (error) | Only catches semicolons in JSX text nodes + JSX string attribute values — not in template literals used as prose outside JSX. The `check-brand-voice.mjs` script also catches them in all string literals. |
| R022 | CLAUDE.md §3 + MECHANICAL_GATES G2 | Exclamation marks banned in body copy | JSX text | HARD_GATE | ESLint `rr-brand-voice/no-violations` (error) | Only 1 exclamation max per piece — but the ESLint rule blocks ALL exclamation marks in JSX; there is no "one per piece" accounting. The gate is stricter than the rule allows. |
| R023 | CLAUDE.md §3 + MECHANICAL_GATES G2 | Real-estate clichés banned: stunning, nestled, charming, boasts, must-see, dream home, pristine, breathtaking, gorgeous, meticulously maintained, entertainer's dream, tucked away, hidden gem, turnkey, immaculate, captivating, exquisite, truly, spacious, cozy, luxurious, updated throughout | JSX text + string literals in `app/`, `components/` | HARD_GATE | ESLint + `scripts/check-brand-voice.mjs` (ratcheted) | Ratcheted — existing violations grandfathered. Both lists must be kept in sync: `eslint-rules/no-brand-voice-violations.js` and `scripts/check-brand-voice.mjs` BANNED_WORDS array. A word present in one but not the other creates inconsistent enforcement. |
| R024 | CLAUDE.md §3 + MECHANICAL_GATES G2 | AI filler banned: delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke, foster | JSX text + string literals | HARD_GATE | ESLint + `scripts/check-brand-voice.mjs` (ratcheted) | Same sync-gap risk as R023. The ESLint rule includes "dynamic" in the clichés list; `check-brand-voice.mjs` has "vibrant" but not "dynamic" — the lists are already out of sync. |
| R025 | CLAUDE.md §3 | Vague qualifiers banned: approximately, roughly, about, around, fairly, somewhat | JSX text + string literals | HARD_GATE | ESLint `rr-brand-voice/no-violations` (error) + `check-brand-voice.mjs` | ESLint list: approximately, roughly, about, around, fairly, somewhat. `check-brand-voice.mjs` list: approximately, roughly only — shorter. Two different enforcement levels for the same rule. |
| R026 | CLAUDE.md §3 | Marketing slop banned: top producing, white glove, luxury concierge, premier brokerage, boutique brokerage, your real estate journey, we are passionate about, we pride ourselves on | JSX text + string literals | PARTIAL | `scripts/check-brand-voice.mjs` scans for these; ESLint `rr-brand-voice` does NOT include multi-word phrases in the current version | Multi-word phrases are harder for the ESLint rule to catch reliably. `check-brand-voice.mjs` catches them via regex in all string literals. |
| R027 | CLAUDE.md §3 | Fake urgency banned: act fast, don't miss out, won't last long, act now, won't last | JSX text + string literals | HARD_GATE | `scripts/check-brand-voice.mjs` only | ESLint rule does NOT have these. Only the CI script catches them. Not enforced at editor lint time. |
| R028 | CLAUDE.md §3 | Brand voice scope: API routes, admin, lib/, scripts/ are exempt from brand-voice rules | Internal code surfaces | HARD_GATE | ESLint overrides for `app/api/**`, `app/admin/**`, `lib/**`, `scripts/**`, `eslint-rules/**`, `*.test.*` | Internal tooling correctly excluded. Test files excluded (necessary — RuleTester payloads contain banned tokens by design). |
| R029 | CLAUDE.md §3 | Phone: `541.213.6706` (dotted) / `541.703.3095` (bio/FUB) — not other formats | Any user-facing surface | PROSE_ONLY | — | No gate enforces phone number format. Wrong format can ship silently. |
| R030 | CLAUDE.md §3 | URL: `ryan-realty.com` (hyphenated, lowercase) | Any user-facing surface | PROSE_ONLY | — | No gate enforces URL format (not `ryanrealty.com`, not `Ryan-Realty.com`). |
| R031 | CLAUDE.md §3 | Place separator: middle dot `·` — not hyphen or pipe | Any user-facing surface | PROSE_ONLY | — | No gate. |
| R032 | CLAUDE.md §3 | Currency rounded to nearest thousand: `$895,000` not `$894,750` | Any numeric display | PROSE_ONLY | — | No gate. |
| R033 | CLAUDE.md §3 | Sentence case for body headlines; Title Case only for top-of-page hero H1 | All web content | PROSE_ONLY | — | No gate. |
| R034 | CLAUDE.md §3 | "You/your" as subject; "we/our team" for brokerage identity; "I" only for genuinely first-person content | All web content | PROSE_ONLY | — | No gate. |
| R035 | CLAUDE.md §Brand Voice | Brand voice rules apply to EVERY text generated on behalf of Ryan Realty, including chat-drafted snippets | All content outputs | PROSE_ONLY | The gates above cover committed JSX/strings; chat output and external-tool-generated content have no gate | Videos, email drafts, Google Business Profile replies, etc. produced outside JSX have zero mechanical enforcement. |

---

### DESIGN SYSTEM + VISUAL TOKENS

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R036 | CLAUDE.md §5 + MECHANICAL_GATES G4 | No raw hex colors in JSX className or style | `app/`, `components/` (excluding `components/ui/`, `components/site/`) | HARD_GATE | `scripts/lint-design-tokens.js` (`--base-diff` in CI; `--all` optional) | Gate runs on diff-since-main by default (`--base-diff`), not on all files. A pre-existing hex on an unchanged file is not caught. The excluded paths (`components/ui/`, `components/site/`) are excluded even though some shadcn overrides in those dirs could introduce hex. Also: hex inside arbitrary `style={}` JSX props is NOT caught by the class scanner. |
| R037 | CLAUDE.md §5 + MECHANICAL_GATES G4 | No raw Tailwind color utility classes (hardcoded color names like `bg-blue-600`, `text-gray-500`) | `app/`, `components/` | HARD_GATE | `scripts/lint-design-tokens.js` | Same diff-only limitation as R036. The regex matches the long list of Tailwind color families — but `bg-current`, `bg-inherit`, `bg-transparent` are not flagged, which is correct. |
| R038 | CLAUDE.md §5 + MECHANICAL_GATES G4 | No custom CSS classes (`card-base`, `btn-cta`) from removed `globals.css` | `app/`, `components/` | HARD_GATE | `scripts/lint-design-tokens.js` | Only catches `card-base` and `btn-cta`. Other potential legacy custom classes are not enumerated. |
| R039 | CLAUDE.md §5 + MECHANICAL_GATES G4 | No raw HTML primitives where shadcn exists: `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<hr>`, `<table>` | `app/`, `components/` | HARD_GATE | `scripts/lint-design-tokens.js` (pattern: `/<(button|input|select|textarea|label|hr|table)(\s|>)/g`) | Pattern may false-positive in comments or string literals that look like HTML. Also, `<a>` (raw anchor instead of `<TextLink>`), `<img>` (instead of `<Avatar>`), and `<div className="rounded-full">` (instead of `<Avatar>`) are NOT caught. |
| R040 | CLAUDE.md §5 | Must use `cn()` from `@/lib/utils` for conditional/merged classes — never string concatenation | JSX components | PROSE_ONLY | — | No gate checks for string concatenation in className positions. `className={'a' + b}` can ship. |
| R041 | CLAUDE.md §5 | No import from `_style_backup/` directory | `app/`, `components/` | HARD_GATE | `scripts/lint-design-tokens.js` | Catches explicit imports. Cannot catch copied-in code from `_style_backup/` that doesn't import from it. |
| R042 | CLAUDE.md §5 | Horizontal scroll track (`overflow-x-auto/scroll`) must have `no-scrollbar` guardrail | JSX className | HARD_GATE | `scripts/lint-design-tokens.js` | Only catches single-string className literals — dynamic className with `cn()` or computed strings not caught. |
| R043 | CLAUDE.md §6 DS v2 | Two-color palette only: `--rr-navy #102742` + `--rr-cream #faf8f4`; retired tokens (`--rr-navy-deep`, `--rr-sand`, `--rr-fir`, `--rr-sky`) must not appear | CSS variables in global styles / components | PROSE_ONLY | `lint-design-tokens.js` catches raw hex but NOT CSS variable names | If a dev writes `var(--rr-fir)` instead of the hex, the gate misses it. Retired token names are not enumerated in any check. |
| R044 | CLAUDE.md §6 DS v2 + EXECUTION_PLAN §0.3 | Retired fonts (Playfair, AzoSans in web, Helvetica, Inter, system-ui fallback) must not appear | `app/`, `components/`, CSS | PROSE_ONLY | Plan §0.3 says "add retired font detection" to `lint-design-tokens.js` — this extension is NOT present in the current script | PLAN SAYS add this — it is NOT implemented. The script checks hex and color classes but has no font-family or font-import detection. |
| R045 | CLAUDE.md §6 DS v2 | Gold colors (`#D4AF37`, `#C8A864`) retired from new renders — only navy + cream allowed | New video/content renders | PROSE_ONLY | Existing rendered videos in `public/v5_library/` exempt; new renders must use navy on cream | No gate on rendered content. The video pipeline has no CI check for gold hex. |
| R046 | CLAUDE.md §6 DS v2 | Tabular numerals (`font-variant-numeric: tabular-nums`) required on every numeric surface | UI components displaying numbers | PROSE_ONLY | — | No gate. |
| R047 | CLAUDE.md §6 DS v2 | Radii: must use the defined ladder (`sm 6`, `md 8`, `lg 10`, `xl 14`, `2xl 18`, `3xl 22`) | UI components | PROSE_ONLY | — | No gate. The design-token script catches raw hex but not raw border-radius values. |
| R048 | CLAUDE.md §6 DS v2 | Shadows must use navy-tinted `rgb(16 39 66 / opacity)` — no grey shadows | UI components | PROSE_ONLY | — | No gate. |
| R049 | CLAUDE.md §6 DS v2 | Focus ring: 3px warm stone, never navy, always visible | Interactive elements | PROSE_ONLY | — | No gate. |
| R050 | CLAUDE.md §6 DS v2 | Motion: respect `prefers-reduced-motion` in all animations | Any component with animation | PROSE_ONLY | — | No gate. React a11y rules cover some ARIA but not animation media queries. |

---

### MOCKUP PARITY + LAYOUT

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R051 | EXECUTION_PLAN §1 | Pixel diff between every page section and mockup in `ui_kits/website/index.html` — human sign-off per section | Every page | PROSE_ONLY | Visual sign-off stays with Matt. G6 (check-mockup-parity) handles structural/import check only | The structural gate (G6) verifies import presence, not visual correctness. No automated pixel-diff in CI. This is explicitly acknowledged as "human-judgement" in MECHANICAL_GATES.md. |
| R052 | MECHANICAL_GATES G6 | Every parity.json `requiredComponents` entry must be imported in the corresponding `page.tsx` | `app/<route>/page.tsx` | HARD_GATE | `scripts/check-mockup-parity.mjs` | Verifies import statement only — does not verify the component is rendered, passed correct props, or visible at the correct position. A page importing but commenting out a component passes. |
| R053 | EXECUTION_PLAN §9 Wave 3 | Homepage must match `ui_kits/website/index.html` exactly | `app/page.tsx` (homepage) | PROSE_ONLY | G6 covers structural; exact visual parity is human-sign-off | No automated test for "exact" match. |
| R054 | EXECUTION_PLAN §9 Wave 3 | Listing detail must beat Zillow Showcase feature checklist | `app/listing/[listingKey]/page.tsx` | PROSE_ONLY | G6 checks required component imports per parity.json | No automated gate tests for specific feature presence (video embed, climate risk, school data, similar listings, etc.) beyond the import check. |

---

### ROUTING + SEO

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R055 | EXECUTION_PLAN §1 + MECHANICAL_GATES G5 | Every public SEO page route must export `metadata` or `generateMetadata` | `app/{blog,cities,communities,listing,reports,search,team}/page.tsx` | HARD_GATE | `scripts/check-seo-authoring.mjs` | Only checks the specific `PUBLIC_ROUTE_PREFIXES` list (`app/blog`, `app/cities`, `app/communities`, `app/listing`, `app/open-houses`, `app/our-homes`, `app/reports`, `app/search`, `app/team`). Routes outside that list (e.g. `app/sell`, `app/about`) are not checked. |
| R056 | EXECUTION_PLAN §1 + MECHANICAL_GATES G5 | Dynamic public SEO routes must define `alternates.canonical` in metadata | Dynamic route pages | HARD_GATE | `scripts/check-seo-authoring.mjs` | Also accepts `generateXxxMetadata(...)` forwarding or `pageMetadata(...)` helper as equivalent. Only checks the `PUBLIC_ROUTE_PREFIXES` subset. |
| R057 | MECHANICAL_GATES G5 | `app/search/[...slug]/page.tsx` must use `shouldNoIndexSearchVariant()` helper | Search route | HARD_GATE | `scripts/check-seo-authoring.mjs` (required-file contract) | Only checks for function call presence — not that the return value actually sets `noindex`. |
| R058 | MECHANICAL_GATES G5 | `app/sitemap.ts` must use `listingsBrowsePath()`, `teamPath()`, `valuationPath()` helpers | Sitemap | HARD_GATE | `scripts/check-seo-authoring.mjs` (required-file contract) | Checks function name usage, not that the generated URLs are correct. |
| R059 | MECHANICAL_GATES G5 | Legacy URL paths (`/listings`, `/agents`, `/home-valuation`) must not be used in code | `app/`, `components/`, `lib/` | HARD_GATE | `scripts/check-seo-routes.mjs` | Has allowlist for legacy route directories and admin/analytics paths where old URLs appear by design. Cron routes, test files, and some lib files are excluded. |
| R060 | EXECUTION_PLAN §1 | Sitemap.xml must be valid + Google Search Console verified + canonical URLs correct | Production | PROSE_ONLY | Wave 5 manual sweep (§5.6) | No CI gate. Manual process at launch only. |
| R061 | EXECUTION_PLAN §1 | Robots.txt must be validated | Production | PROSE_ONLY | Wave 5 manual sweep | No CI gate. |
| R062 | EXECUTION_PLAN §1 | Structured data validated via Google Rich Results Test | Production | PROSE_ONLY | Wave 5 manual sweep | No CI gate. |

---

### PERFORMANCE + BUNDLE + LCP

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R063 | EXECUTION_PLAN §1 + MECHANICAL_GATES G15 | Lighthouse Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 90, SEO ≥ 95 on every LP route | All canonical LP routes | HARD_GATE | `lhci autorun --config=./lighthouserc.cjs` via `npm run ci:lighthouse` | Only runs on PRs (`if: github.event_name == 'pull_request'` in CI.yml) — not on direct pushes to main. The 8 Lighthouse test URLs are defined in `lighthouserc.cjs`: homepage, cities/bend, cities/bend/awbrey-butte, communities/bend-tetherow, zip/97703, one listing detail, team, about. Does NOT cover all 11 cities, all 14 communities, all neighborhoods. Desktop preset only — no mobile audit. |
| R064 | EXECUTION_PLAN §1 + MECHANICAL_GATES G15 | LCP ≤ 2500ms on every LP route | All canonical LP routes | HARD_GATE | `lhci` (asserts `largest-contentful-paint maxNumericValue: 2500`) | Same coverage gaps as R063. |
| R065 | EXECUTION_PLAN §1 + MECHANICAL_GATES G15 | CLS ≤ 0.10 on every LP route | All canonical LP routes | HARD_GATE | `lhci` (asserts `cumulative-layout-shift maxNumericValue: 0.1`) | Same coverage gaps as R063. |
| R066 | EXECUTION_PLAN §1 + MECHANICAL_GATES G10 | Initial JS bundle ≤ 250 KB per route | Per-route bundle | PARTIAL | `scripts/check-bundle-budget.mjs` — checks TOTAL `.next/static` JS ≤ 10 MB and largest single chunk ≤ 600 KB. Does NOT do per-route 250 KB check. | The per-route 250 KB criterion in the plan is NOT the actual budget enforced. The gate uses a total budget proxy (10 MB total) and a per-chunk budget (600 KB) that is looser than the stated criterion. Bundle budget check requires `.next/` to exist — runs post-build only. |
| R067 | EXECUTION_PLAN §1 | Vercel Analytics 7-day window: listing detail TTFB p95 < 200ms, LP routes < 300ms | Production runtime | PROSE_ONLY | Vercel Analytics dashboard — manual review | No automated gate. Cannot be tested pre-deploy. |
| R068 | EXECUTION_PLAN §1 | Build must exit 0 with zero TypeScript type errors | All TypeScript files | HARD_GATE | `npm run build` (Next.js calls `tsc --noEmit`) via CI `lint-and-build` job | TypeScript strict mode must be maintained. `@typescript-eslint/no-explicit-any` is downgraded to `warn` — not a build-blocker. |
| R069 | EXECUTION_PLAN §1 | All pages must serve without 5xx in production | All routes | HARD_GATE | `scripts/check-route-smoke.mjs` — checks 200 status, no "Page not found", no "Application error", non-empty `<title>`, body ≥ 5 KB | Route smoke runs only on PRs. Only checks the 10 hardcoded routes (homepage, cities/bend, communities, team, about, contact, sell, housing-market, two LPs, optional listing). Does not test all 11 cities, 14 communities, 14 neighborhoods, all ZIP codes. |

---

### DRAFT-FIRST + APPROVAL

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R070 | CLAUDE.md §0.5 + MECHANICAL_GATES G12 | User-facing commits require `Approved-by: matt` or `Draft-shown: <url>` in commit message | `app/<route>/{page,layout,error,loading}.tsx`, `components/site/<any>`, `public/*.html`, `app/lp/<any>` | HARD_HOOK | `.husky/commit-msg` → `scripts/check-draft-first.mjs` | Can be bypassed with `DRAFT_FIRST_OK=1` env var (leaves audit trail in CI logs). Checks staged files at commit time — but `.husky/commit-msg` fires with the commit message file path; staged-files detection uses `git diff --cached`. The hook is in `.husky/commit-msg` but the script also reads staged files as a pre-commit check. `components/site/primitives/` is explicitly EXCLUDED (atomic primitives allowed without approval). |
| R071 | CLAUDE.md §0.5 | Draft-first gate does NOT apply to: `lib/data/`, `lib/site/`, `components/site/primitives/`, `scripts/`, `docs/`, `.github/`, `.cursor/`, `eslint-rules/`, test files, migrations | Internal/infrastructure code | N/A | Explicitly excluded by `NEVER_USER_FACING` array in `check-draft-first.mjs` | Correct by design. |
| R072 | CLAUDE.md §0.5 | Video renders ship to `out/` (gitignored) before commit — no auto-commit of MP4s | Video pipeline | PROSE_ONLY | `out/` is gitignored; `public/v5_library/` is tracked but has no gate preventing direct commit | A developer can `git add public/v5_library/video.mp4` without the draft-first gate triggering because `public/*.mp4` is not in `USER_FACING_PATTERNS`. Gap: video deliverables in `public/v5_library/` bypass the draft-first hook. |
| R073 | CLAUDE.md §0.5 | Silence is never approval — explicit "ship it"/"approved"/"go" required | Any committed user-facing work | HARD_HOOK | `.husky/commit-msg` + approval-marker check | Only checks for the marker in the commit message. Cannot verify that the approval marker accurately represents a real approval event (an agent could write `Approved-by: matt` without actual approval). |

---

### VIDEO PRODUCTION

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R074 | CLAUDE.md §4 Video Rules + MECHANICAL_GATES G13 | Video first-frame must pass thumbnail quality gate (luma 30–240, variance ≥ 250, saturation ≥ 8 mid-luma) | Every rendered video MP4 | HARD_GATE | `scripts/check_first_frame.py` | Gate exists but is NOT wired into CI.yml — it's a manual step. No CI job calls it. Only the prose mandate says to run it before publish. |
| R075 | CLAUDE.md §4 Video Rules | Video format: 1080×1920 portrait, 30fps, h264 + aac, faststart, < 100 MB | Rendered MP4s | PROSE_ONLY | `ffprobe` check in video quality gate — manual only | No CI gate. |
| R076 | CLAUDE.md §4 Video Rules | Video length: 30–45s for viral cuts, never over 60s | Rendered MP4s | PROSE_ONLY | `ffprobe Duration` in quality gate — manual only | No CI gate. |
| R077 | CLAUDE.md §4 Video Rules | Captions must render as single-word Amboqia, synced to ElevenLabs alignment — never over other overlays | Remotion compositions | PROSE_ONLY | `video_production_skills/captions/SKILL.md` + canonical component — manual compliance | No CI gate on Remotion source code for caption implementation. |
| R078 | CLAUDE.md §4 Video Rules | VO must use Victoria voice (ID `qSeXEcewz7tA0Q0qk9fH`), model `eleven_turbo_v2_5`, specific settings | ElevenLabs API calls in video builds | PROSE_ONLY | `video_production_skills/elevenlabs_voice/SKILL.md` + `scripts/_voice_lib.py` — convention only | No gate verifies the voice ID or model in ElevenLabs calls. Any script can call ElevenLabs directly with different settings. |
| R079 | CLAUDE.md §4 Video Rules | No logo / "Ryan Realty" / phone / agent name in video frame for viral cuts | Video compositions | PROSE_ONLY | Manual QA only | No CI gate. |
| R080 | CLAUDE.md §4 Video Rules | Viral scorecard minimum: listing video 85, market data 80, neighborhood 80, default floor 80 | All published videos | PROSE_ONLY | `out/<deliverable>/scorecard.json` convention — manual only | No CI gate enforces scorecard. Scorecard file can be absent or have any score. |
| R081 | CLAUDE.md §4 Video Rules | No black frames detected by `ffmpeg blackdetect` (pix_th=0.05) | Rendered MP4s | PROSE_ONLY | Manual quality gate step — not in CI | No CI gate. |
| R082 | CLAUDE.md §4 Video Rules | Text overlays must stay within portrait safe zone (x 90–990, y 280–1480) | Remotion compositions | PROSE_ONLY | `video_production_skills/safe-zones/canonical/safe-zones.ts` — convention only | No gate checks safe-zone compliance in Remotion components. |
| R083 | CLAUDE.md §4 Video Rules | Render hygiene: `npx remotion render --concurrency 1 --crf 22 --codec h264 --image-format=jpeg` | Remotion render invocations | PROSE_ONLY | Convention only | No gate on how render commands are invoked. |

---

### MARKETING BRAIN PIPELINE

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R084 | CLAUDE.md §Marketing Brain + feedback memory | Every producer invocation MUST go through `marketing_brain_skills/produce/` or `run/` — no rogue direct script calls | `scripts/build_*.py` producer scripts | PROSE_ONLY | `require_action_row()` guard exists in `scripts/_producer_lib.py` but no producer script calls it yet (as of 2026-05-21) — opt-in only | The `PRODUCER_ALLOW_ROGUE=1` env var bypass means anyone can run scripts directly. Zero producers enforce the guard. |
| R085 | CLAUDE.md §Marketing Brain | Content cost cap: $5/row, $15/run, max 3 rows/run | Producer runtime cron | PROSE_ONLY | Cost cap logic described in plan — enforced in the cron runtime, not in CI | No pre-deploy gate. Cost caps only enforced at runtime if the cron implementation respects them. |
| R086 | CLAUDE.md §Marketing Brain | Every content producer loads Tier 1–5 mandatory references before executing | Producer executions | PROSE_ONLY | TEMPLATE.md documents the requirement — no mechanism verifies compliance | No gate checks that a producer's SKILL.md declares the required tier references. No CI check that a running producer actually loaded them. |
| R087 | CLAUDE.md §Marketing Brain | No producer can be invoked directly without a `marketing_brain_actions` row | All content pipeline actions | PROSE_ONLY | `require_action_row()` exists but not opted in by any producer | See R084 gap. |
| R088 | CLAUDE.md §Data Accuracy | Every published number in a marketing deliverable must trace to a `citations.json` file | Marketing deliverables (videos, reports, emails, social posts) | PROSE_ONLY | Convention: `out/<deliverable>/citations.json` — but no gate checks its existence or completeness before publish | No CI gate. The convention is documented but not enforced. |

---

### OPERATIONS + GIT DISCIPLINE

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R089 | CLAUDE.md §Work Standards | Always push to `origin/main` immediately after every approved commit — no "saved locally" commits | git workflow | PROSE_ONLY | — | No git hook enforces push timing. The push is the developer's responsibility after approval. |
| R090 | CLAUDE.md §Work Standards | Single-branch workflow: no `git worktree`, no feature branches — single `main` checkout | git repo | PROSE_ONLY | — | No gate prevents branch creation or worktree usage. The eslint global ignores `.claude/worktrees/**` which implies worktrees do get created. |
| R091 | CLAUDE.md §Work Standards + pre-push hook | Supabase migrations must be applied to hosted Supabase before code that depends on them ships | Database + code | HARD_HOOK | `.husky/pre-push` → `npm run db:guard` → `scripts/check-supabase-migration-drift.mjs` | Runs `supabase db push --dry-run --include-all --yes` to detect pending migrations. Can be bypassed with `SKIP_DB_GUARD=1`. Requires Supabase CLI and valid auth at push time. |
| R092 | pre-push hook | Pre-push runs strict quality gates on pushes to `main` or when `app/`, `components/`, `lib/` files changed | git push | HARD_HOOK | `.husky/pre-push` → `npm run quality:local:strict` (design-tokens + test + build) | Can be bypassed with `SKIP_LOCAL_GATES=1`. Does NOT run the full `ci:gates` suite locally — only design-tokens, test, and clean build. DAL boundary, brand-voice, mockup-parity etc. are CI-only, not local pre-push. |
| R093 | CLAUDE.md §Work Standards | Never skip git hooks (`--no-verify`) | git workflow | PROSE_ONLY | — | No gate prevents `git commit --no-verify` or `git push --no-verify`. |
| R094 | CLAUDE.md §Work Standards | Proactively clear `.git/index.lock` before any git operation | Local dev environment | PROSE_ONLY | — | No hook or script enforces this. |
| R095 | CLAUDE.md §Work Standards | `npm run build` must exit 0 before push | Build | HARD_HOOK | `.husky/pre-push` calls `quality:local:strict` which includes `build:clean-local` | Build is included in strict pre-push gates. The separate CI job also runs `npm run build`. |
| R096 | CLAUDE.md §Work Standards | `npm run lint` must pass before push/CI | Lint | HARD_GATE | CI.yml runs `npm run lint` as first step. Pre-push strict mode runs it via `quality:local:strict`. | Local `quality:local` (fast mode) only runs design-tokens + test — NOT full lint. Full lint is CI-only on PRs/pushes or triggered by the `NEEDS_STRICT=1` condition. |
| R097 | CLAUDE.md §Draft-First | Video MP4s committed to `public/v5_library/` must first get explicit Matt approval | `public/v5_library/*.mp4` | PROSE_ONLY | Draft-first hook does NOT cover `public/v5_library/` — only covers `public/*.html` | VIDEO MP4 FILES IN `public/v5_library/` HAVE NO DRAFT-FIRST GATE. This is a confirmed gap in `check-draft-first.mjs` USER_FACING_PATTERNS. |

---

### ACCESSIBILITY

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R098 | EXECUTION_PLAN §1 + MECHANICAL_GATES G15 | Accessibility score ≥ 95 on every LP route | All canonical LP routes | HARD_GATE | `lhci` asserts `categories:accessibility minScore: 0.95` | Same coverage gaps as R063. Only PRs gated. |
| R099 | EXECUTION_PLAN §1 | pa11y-ci accessibility check on all routes | All routes | PARTIAL | `npm run ci:a11y` (pa11y-ci) exists in package.json but is NOT in CI.yml — only in `quality:local:full` | Pa11y is only run locally if `npm run quality:local:full` is invoked manually. It is NOT a CI gate. |
| R100 | CLAUDE.md §6 DS v2 | Focus ring must always be visible (never hidden by `outline: none` without replacement) | Interactive elements | PROSE_ONLY | — | No gate. React a11y ESLint rules (`jsx-a11y/*`) are not listed in `eslint.config.mjs`. |

---

### SUPABASE / DATABASE OPERATIONS

| Rule ID | Source | Rule statement | Surface | Enforcement | Mechanism | Gap notes |
|---|---|---|---|---|---|---|
| R101 | CLAUDE.md §Supabase | Spark × Supabase market-data reconciliation gate: stop render if `|delta| > 1%` between Spark and Supabase figures | Video pipeline pre-render | PROSE_ONLY | Manual pre-render gate documented in CLAUDE.md | No CI gate. Applies to video pipeline only — the website's DAL functions pull from Supabase directly; no Spark cross-check for web market stats. |
| R102 | CLAUDE.md §Data Accuracy | Use cache (`market_pulse_live` 10-min freshness, `market_stats_cache` 6h freshness) — never aggregate raw `listings` for market reports | Web pages + video pipeline | PARTIAL | G1 (DAL boundary) enforces that `market_stats_cache` and `market_pulse_live` can only be accessed via `lib/data/`. But no gate verifies that DAL functions actually use the cache rather than raw `listings` for market stats. | A function inside `lib/data/market/getMarketStats.ts` could query raw `listings` instead of `market_stats_cache` and the DAL boundary rule would not catch it (it's inside `lib/data/`). |
| R103 | EXECUTION_PLAN §5 | All 4 materialized views refresh successfully every 10 min (sync-delta cron) + nightly fallback | Supabase cron + `/api/cron/sync-delta` | PROSE_ONLY | Runtime monitoring only | No CI gate. See R004. |
| R104 | CLAUDE.md §Work Standards | Never reconcile transactions against SkySlope — use Vault as sole source of truth | Transaction coordination | PROSE_ONLY | — | Entirely out of scope for the website CI pipeline. Operational guardrail only. |

---

## Rules by Category (Summary)

### Data Access + SQL Discipline (R001–R012)
12 rules. **4 HARD_GATE** (R001 DAL boundary ESLint, R003 page-DAL script, R007 schema-snapshot drift, R008 DAL-index drift). **8 PROSE_ONLY** (column quoting, cache validation, Zod, TTFB, citations, MoS formula, SELECT* limit, MV refresh health).

### DAL Boundary + Page Composition (R013–R019)
7 rules. **3 HARD_GATE** (R013 static params, R015 mockup parity, R016 mockup coverage). **1 PROSE_ONLY with plan gap** (R014 force-dynamic+revalidate coexistence — planned ESLint rule NOT wired). **1 PROSE_ONLY with plan gap** (R019 Sentry tracesSampleRate — planned ESLint rule NOT wired). **2 PROSE_ONLY** (R017 orphan routes, R018 API route DAL).

### Brand Voice + Content (R020–R035)
16 rules. **6 HARD_GATE** (R020–R025 punctuation + banned words via ESLint + CI script). **2 PARTIAL** (R026–R027 marketing slop/fake urgency — CI script only, not ESLint). **1 N/A** (R028 correct exemptions). **7 PROSE_ONLY** (R029–R035 phone format, URL format, separator, currency rounding, sentence case, pronouns, non-JSX content).

### Design System + Visual Tokens (R036–R050)
15 rules. **5 HARD_GATE** (R036–R042, with R039 partial coverage). **1 PROSE_ONLY with plan gap** (R044 retired font detection — planned but NOT implemented). **9 PROSE_ONLY** (R043–R050 CSS variables, tabular numerals, radii, shadows, focus ring, motion, gold colors).

### Mockup Parity + Layout (R051–R054)
4 rules. **1 HARD_GATE** (R052 structural import check). **3 PROSE_ONLY** (R051 pixel diff human sign-off, R053 homepage exact match, R054 Zillow feature checklist).

### Routing + SEO (R055–R062)
8 rules. **5 HARD_GATE** (R055–R059 via check-seo-authoring + check-seo-routes). **3 PROSE_ONLY** (R060–R062 sitemap/robots/structured data — Wave 5 manual sweep only).

### Performance + Bundle + LCP (R063–R069)
7 rules. **4 HARD_GATE** (R063–R065 Lighthouse gates, R068 TypeScript build). **1 PARTIAL** (R066 bundle budget — proxy metrics, not per-route 250 KB). **2 PROSE_ONLY** (R067 TTFB telemetry, R069 route smoke partial coverage).

### Draft-First + Approval (R070–R073)
4 rules. **2 HARD_HOOK** (R070 commit-msg hook, R073 approval-marker check). **1 N/A** (R071 correct exclusions). **1 PROSE_ONLY** (R072 video MP4s in `public/v5_library/` not gated).

### Video Production (R074–R083)
10 rules. **1 HARD_GATE** (R074 first-frame check — but NOT wired into CI.yml). **9 PROSE_ONLY** (R075–R083: all video format, length, caption, voice, branding, scorecard, blackdetect, safe-zone, render hygiene rules).

### Marketing Brain Pipeline (R084–R088)
5 rules. All **PROSE_ONLY** — the `require_action_row()` guard exists but is not opted into by any producer.

### Operations + Git Discipline (R089–R097)
9 rules. **3 HARD_HOOK/HARD_GATE** (R091 Supabase migration drift pre-push, R092 pre-push quality gates, R095 build in pre-push). **6 PROSE_ONLY** (R089 push timing, R090 single-branch, R093 no-verify bypass, R094 lock clearing, R096 lint local gap, R097 video MP4 draft-first gap).

### Accessibility (R098–R100)
3 rules. **1 HARD_GATE** (R098 Lighthouse a11y ≥ 95). **1 PARTIAL** (R099 pa11y-ci exists but not in CI.yml). **1 PROSE_ONLY** (R100 focus ring / outline:none).

### Supabase / Database Operations (R101–R104)
4 rules. **1 PARTIAL** (R102 cache vs raw — DAL boundary enforces table access point but not query implementation). **3 PROSE_ONLY** (R101 Spark reconciliation, R103 MV refresh health, R104 transaction SoT).

---

## Enforcement Distribution

| Status | Count | Percentage |
|---|---|---|
| HARD_GATE (CI fails on violation) | 28 | 27% |
| HARD_HOOK (runtime blocks the action) | 5 | 5% |
| PARTIAL (some cases caught) | 6 | 6% |
| PROSE_ONLY (no mechanical check) | 63 | 60% |
| N/A | 2 | 2% |
| **Total** | **104** | **100%** |

---

## Systemic Gaps — Top 10 Highest-Impact Missing Enforcement

These are the gaps that would close **whole classes** of recurring failures, ranked by: (frequency of the failure × consequence of missing it × feasibility of automation).

---

### GAP-1 — SQL column quoting (closes the 2026-05-28 "Listing Not Found" regression class)

**Rule violated:** R002  
**What keeps failing:** DAL functions inside `lib/data/` call Supabase with unquoted mixed-case column names (e.g. `eq('StandardStatus', ...)` instead of `eq('"StandardStatus"', ...)`). The ESLint DAL rule is OFF inside `lib/data/`, so nothing catches this. It manifests at runtime as "column does not exist" or silent empty results, not a build error.  
**What to build:** A `scripts/check-dal-column-quoting.mjs` that AST-walks `lib/data/**/*.ts`, finds all `.eq()`, `.filter()`, `.select()`, `.order()`, and `.range()` calls, and flags any argument that matches a known mixed-case column name WITHOUT surrounding double quotes. Known mixed-case columns come from `docs/DATABASE_SCHEMA_SNAPSHOT.md`.  
**Enforcement type:** HARD_GATE (CI script + `ci:gates`).  
**Impact:** Closes the entire class of "query returns nothing because column name is wrong case." Zero false positives for lowercase columns (they don't need quoting).

---

### GAP-2 — Video MP4 files in `public/v5_library/` bypass draft-first hook (closes unauthorized video publish class)

**Rule violated:** R097 + R072  
**What keeps failing:** The `.husky/commit-msg` draft-first gate covers `app/<route>/*.tsx`, `components/site/<any>`, `public/*.html` — but `public/v5_library/*.mp4` is NOT in `USER_FACING_PATTERNS`. A rendered video can be committed to the tracked library path without Matt's approval.  
**What to build:** Add `^public/v5_library/` to `USER_FACING_PATTERNS` in `scripts/check-draft-first.mjs`.  
**Enforcement type:** HARD_HOOK (`.husky/commit-msg`).  
**Impact:** Closes the entire class of "video shipped to production without Matt review" which is explicitly called out in the review gate rule.

---

### GAP-3 — pa11y-ci is not in CI.yml (accessibility testing is opt-in manual only)

**Rule violated:** R099  
**What keeps failing:** `npm run ci:a11y` exists in `package.json` and can run, but is absent from `.github/workflows/CI.yml`. The Lighthouse a11y score (R098) catches aggregate scoring issues but pa11y catches specific WCAG violations (missing alt text, unlabeled inputs, color contrast on specific elements, keyboard trap issues) that aggregate scoring misses.  
**What to build:** Add `- run: npm run ci:a11y` to `CI.yml` after the route smoke step. It uses `start-server-and-test` and requires the server to be running (same as route smoke).  
**Enforcement type:** HARD_GATE.  
**Impact:** Closes the gap between "aggregate a11y score looks fine" and "specific component has a WCAG 2.1 failure."

---

### GAP-4 — Retired font detection not implemented (Design System v2 drift)

**Rule violated:** R044  
**What keeps failing:** The EXECUTION_PLAN §0.3 explicitly says "add retired font detection (Playfair, AzoSans in web, Helvetica, Inter) to `scripts/lint-design-tokens.js`" — this was never implemented. A developer can introduce `font-family: 'Inter'` or import Playfair from Google Fonts and it will ship undetected.  
**What to build:** Add patterns to `scripts/lint-design-tokens.js`:
- Detect `font-family:\s*(["']?)(Playfair|Inter|Helvetica|AzoSans|system-ui)` in CSS/style strings
- Detect `from 'next/font/google'` imports referencing any font other than Geist
- Detect `@import url(.*google.*Playfair|Inter|Helvetica)` in CSS files  
**Enforcement type:** HARD_GATE (extend existing `ci:design-tokens`).  
**Impact:** Closes brand-typography drift. Currently invisible to CI.

---

### GAP-5 — `force-dynamic` + `revalidate` coexistence ESLint rule not wired (planned but missing)

**Rule violated:** R014  
**What keeps failing:** The EXECUTION_PLAN §0.4 explicitly calls for an ESLint rule blocking `export const dynamic = 'force-dynamic'` coexisting with `export const revalidate = N` in the same file. This combination silently breaks ISR caching and can cause expensive uncached renders. The rule is NOT in `eslint.config.mjs` as of inventory date.  
**What to build:** Add to `eslint.config.mjs` a `no-restricted-syntax` entry matching `ExportNamedDeclaration[declaration.declarations.0.id.name='revalidate']` in files that also contain `ExportNamedDeclaration[declaration.declarations.0.id.name='dynamic'][declaration.declarations.0.init.value='force-dynamic']`. Alternatively, write a dedicated ESLint rule in `eslint-rules/`.  
**Enforcement type:** HARD_GATE (ESLint error).  
**Impact:** Closes silent ISR cache invalidation bugs that cause cold renders on all requests.

---

### GAP-6 — Sentry tracesSampleRate > 0.2 ESLint rule not wired (planned but missing)

**Rule violated:** R019  
**What keeps failing:** EXECUTION_PLAN §0.4 explicitly calls for an ESLint rule catching `tracesSampleRate: 1` (or any value > 0.2) in Sentry config files. A developer re-enabling 100% tracing for debugging and forgetting to revert can silently drain Sentry quota and slow production. The rule is NOT in `eslint.config.mjs`.  
**What to build:** Add to `eslint.config.mjs` with `files: ['sentry.*.config.ts']` and a `no-restricted-syntax` selector matching `Property[key.name='tracesSampleRate'][value.value>0.2]`.  
**Enforcement type:** HARD_GATE (ESLint error on config files).  
**Impact:** Closes one-line quota-drain regression.

---

### GAP-7 — Brand-voice list divergence between ESLint rule and CI script (inconsistent enforcement)

**Rule violated:** R024, R025  
**What keeps failing:** `eslint-rules/no-brand-voice-violations.js` and `scripts/check-brand-voice.mjs` maintain SEPARATE banned-word lists that are already out of sync. The ESLint rule includes "dynamic" (AI filler) and "around/fairly/somewhat" (vague qualifiers); the CI script omits them. Conversely, the CI script includes marketing-slop phrases not in the ESLint rule. A banned word added to one list but not the other creates inconsistent enforcement — the word is caught at editor time but not at CI time (or vice versa).  
**What to build:** Single source of truth — extract the banned lists into `scripts/brand-voice-vocabulary.js` (CommonJS) and `import` / `require` it in both scripts. The ESLint rule and CI scanner share the same arrays. A test in `eslint-rules/__tests__/` verifies both imports are identical.  
**Enforcement type:** HARD_GATE (test enforcing list equality).  
**Impact:** Closes the class of "banned word added to one list but not the other, silently passes CI."

---

### GAP-8 — DAL internal query discipline (lib/data/ can use raw listings despite DAL contract)

**Rule violated:** R102 + R012  
**What keeps failing:** The DAL boundary rule is OFF inside `lib/data/` (correctly — that's where queries live). But nothing enforces that market stat functions (`getMarketStats`, `getMarketPulse`) actually query `market_stats_cache`/`market_pulse_live` rather than `raw listings`. A developer implementing a shortcut like `supabase.from('listings').select(...).eq(...)` inside `getMarketStats.ts` would produce correct TypeScript but violate the cache model, causing slow queries on 589K rows.  
**What to build:** A `scripts/check-dal-internal-discipline.mjs` that AST-walks `lib/data/market/*.ts` and asserts that `getMarketStats` and `getMarketPulse` call `.from('market_stats_cache')` or `.from('market_pulse_live')` respectively — not `.from('listings')`. Similarly, `lib/data/geo/*.ts` functions must use `geo_snapshot_mv`. This is a positive-assertion pattern check.  
**Enforcement type:** HARD_GATE.  
**Impact:** Closes the class of "DAL functions bypass the cache model and hit raw tables."

---

### GAP-9 — Route smoke covers only 10 of 100+ canonical routes (critical coverage gap)

**Rule violated:** R069 (partial enforcement)  
**What keeps failing:** `scripts/check-route-smoke.mjs` checks 10 hardcoded routes. The plan requires 11 cities, 14 communities, 14 neighborhoods, 10+ ZIP codes, 3 LPs, market reports, and listing detail to all serve 200. A breaking change in the `/communities/[slug]` template can ship if none of the tested 10 routes is a community page.  
**What to build:** Extend `ROUTES` in `check-route-smoke.mjs` to cover all 11 cities, all 14 resort communities, the 14 Bend neighborhoods, and the 3 LP routes — by importing the canonical slug lists from `data/resort-communities.json` and the hardcoded arrays in the codebase. For listing detail, pick a real active listing key via `pick-lhci-listing.mjs`. The total expands from 10 to ~60 routes. Smoke timeout per route is already 15s — adjust total timeout or parallelize.  
**Enforcement type:** HARD_GATE (extend existing `ci:route-smoke`).  
**Impact:** Closes the class of "template-level breakage in a route family that happens to not be in the hardcoded test list."

---

### GAP-10 — Marketing producer `require_action_row()` guard not enforced by any producer

**Rule violated:** R084, R087  
**What keeps failing:** The `_producer_lib.py` guard function exists. Zero producer scripts call it. Every `python3 scripts/build_*.py` invocation is a "rogue run" that bypasses the `marketing_brain_actions` audit trail, the measurement loop, and the cost caps. The feedback memory says this is forbidden — but there is no mechanical gate.  
**What to build:** A pre-commit hook check (`scripts/check-producer-guard.mjs`) that scans changed `scripts/build_*.py` files and asserts they contain a call to `require_action_row(` or are explicitly annotated with `# @producer-guard-exempt` with a justification. Additionally, add `require_action_row()` to the top 5 most-frequently-run producer scripts as an immediate step.  
**Enforcement type:** HARD_HOOK (pre-commit for producer script changes) + runtime guard (producer itself).  
**Impact:** Closes the entire class of untracked marketing content spends and unmeasured content performance.

---

## Glossary

| Status | Definition |
|---|---|
| HARD_GATE | CI job fails on violation — PR cannot merge, push blocked |
| HARD_HOOK | Git hook blocks the action at commit or push time |
| PARTIAL | Some violation cases caught; others pass silently |
| PROSE_ONLY | Rule exists only in documentation; no mechanical enforcement |
| N/A | Rule is definitional/excluded by design; not enforceable |
