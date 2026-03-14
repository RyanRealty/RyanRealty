CODEBASE AUDIT & OPTIMIZATION — RYAN REALTY PLATFORM

═══════════════════════════════════════════════════
ROLE & AUTHORITY
═══════════════════════════════════════════════════

You are a principal engineer performing a production-readiness audit on a
luxury real estate platform preparing for launch. You have mass-delete
authority. Your mandate: every file, function, dependency, comment, and
config line must earn its place or be flagged for removal. You are not
here to be polite. You are here to make this codebase shipworthy.

═══════════════════════════════════════════════════
TECH STACK CONTEXT (use this to inform every finding)
═══════════════════════════════════════════════════

Runtime:        Next.js 16.1.6 (App Router, Turbopack default), React 19.2.3, TypeScript 5
Package mgr:    npm (package-lock.json)
Database:       Supabase (@supabase/supabase-js latest + @supabase/ssr 0.9.0) — PostgreSQL + Auth + Storage + RLS
Styling:        Tailwind CSS v4 (@tailwindcss/postcss v4) — NO shadcn/ui in dependencies
Data sync:      Spark Platform API → Supabase via Inngest 3.52.6 background jobs
CRM:            FollowUp Boss API (webhook + REST)
Analytics:      GA4 + GTM + Meta Pixel
Email:          Resend 6.9.3 + @react-email/components 1.0.8
Maps:           Mapbox (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) + @react-google-maps/api 2.20.8 + @googlemaps/markerclusterer 2.6.2
PDF:            @react-pdf/renderer 4.2.0
Charts:         Recharts 2.15.0
Monitoring:     Sentry (@sentry/nextjs 10.42.0)
PWA:            Serwist (@serwist/next 9.5.6)
AI:             OpenAI API (photo classification), Replicate (headshot generation), Synthesia (video generation)
Testing:        Vitest 4.0.18
Deployment:     Vercel
State:          React hooks + server components (no Redux, no Zustand)
Auth:           Supabase Auth (email/password + Google OAuth)
Icons:          @heroicons/react 2.2.0

TypeScript config: strict mode enabled, target ES2017, module bundler resolution,
paths alias @/* → ./*

Next.js config notable settings:
- Custom env loader that reads .env.local to override Cursor's Supabase plugin injection
- images.remotePatterns allows ALL hostnames (hostname: '**') — AUDIT THIS
- Security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin
- Redirects: /search → /homes-for-sale (permanent)
- Rewrites: /homes-for-sale → /search (internal)
- experimental.serverActions.bodySizeLimit: '4mb'
- No middleware.ts exists

Stack-specific antipatterns to watch for:

- Next.js 16 / React 19: client components where server components suffice
  ("use client" without interactive need), missing or incorrect revalidation
  strategies, route handlers that should be server actions, layout.tsx files
  that re-render children unnecessarily, metadata exports missing from pages,
  not using React 19 features where appropriate (use(), server functions),
  Turbopack-incompatible config or plugins

- React 19: stale closures in useEffect, missing/wrong dependency arrays,
  derived state stored in useState instead of computed inline, prop drilling
  past 3 levels where context is warranted, not leveraging React 19's
  automatic memoization where applicable

- Supabase: missing RLS policies on any table, service_role key used
  client-side or exposed via NEXT_PUBLIC_ prefix, unindexed foreign keys,
  queries without .select() column limiting, auth.getUser() vs
  auth.getSession() misuse, @supabase/supabase-js pinned to "latest"
  (should be an exact version)

- TypeScript: 'any' types, non-null assertions (!) without justification,
  'as Type' assertions used to silence type mismatches instead of fixing
  the upstream type, missing return types on exported functions, loose
  union types where discriminated unions are appropriate, 'as unknown as X'
  is always a red flag

- Inngest: missing idempotency on sync functions, no retry configuration,
  no dead-letter handling, step functions without proper error boundaries

- Tailwind v4: arbitrary values where design tokens exist, inconsistent
  spacing scale usage, responsive breakpoints applied inconsistently,
  v3 syntax still present that should use v4 patterns

- Maps: two mapping libraries installed (Mapbox + Google Maps) — are both
  actively used or is one dead weight? Flag if only one is in use.

- Sentry: is it initialized correctly for both client and server? Are
  source maps uploaded? Is sensitive data scrubbed from error reports?

═══════════════════════════════════════════════════
SCOPE (what to audit vs. ignore)
═══════════════════════════════════════════════════

AUDIT:    app/, components/, lib/, utils/, types/, hooks/, styles/,
          public/, supabase/, inngest/, all config files at root,
          docs/, any .ts/.tsx/.js/.jsx/.css files at project root

IGNORE:   node_modules/, .next/, .vercel/, *.lock, generated types
          from Supabase CLI (supabase/functions/, database.types.ts
          if auto-generated), any file with "generated" or
          "auto-generated" in its header comment

IF UNSURE: flag it with a [?] prefix and state your uncertainty —
          do not silently skip or silently assert

═══════════════════════════════════════════════════
EXECUTION PHASES (complete each phase fully before moving to the next)
═══════════════════════════════════════════════════

PHASE 0: ORIENTATION (do not skip)

- Read: package.json, tsconfig.json, next.config.ts, .env.example,
  tailwind.config.*, app/layout.tsx (root layout), app/error.tsx,
  app/global-error.tsx, app/not-found.tsx, app/loading.tsx,
  app/robots.ts, app/sitemap.ts, sw.ts (service worker)
- Read: any supabase/migrations/*.sql files to understand the actual
  database schema (this is the source of truth, not docs)
- Map the full route tree: list every route in app/ and note whether
  each is a page, layout, route handler, server action, or loading/
  error boundary
- Identify the dominant patterns: naming conventions, file structure,
  data fetching approach, error handling style, component composition
- These patterns become the baseline. Everything is measured against them.
- Read docs/MASTER_INSTRUCTION_SET.md and docs/FEATURES.md to understand
  stated intent vs. actual implementation — flag any gaps
- Note: there are BOTH /listing/[listingKey] AND /listings/[listingKey]
  routes, AND both /agents/[slug] AND /team/[slug] routes, AND an
  app/components/ directory (unusual placement). Investigate whether
  these are duplicates, legacy, or intentional.

───────────────────────────────────────────────────

PHASE 1: DEAD WEIGHT (remove before optimizing)

- Unused variables, functions, imports, types, interfaces, constants,
  components, route files, API routes, and entire files
- Duplicated logic: same or near-identical functions in multiple files
- Orphaned files: not imported anywhere, not a route, not a config
- Dead feature flags or environment checks for features already shipped
- Commented-out code blocks (if it's in git history, it doesn't need to
  be in the file)
- npm packages in package.json not imported anywhere in the codebase
- Unused environment variables: defined in .env.example but never
  referenced via process.env.* or import.meta.env.* in any source file
- Dead CSS: Tailwind classes referencing custom utilities or components
  not defined in tailwind config or global styles
- Dead database artifacts: tables, columns, or RPC functions defined in
  migrations but never queried or called from application code
- Stale type definitions: interfaces/types defined but never used as a
  parameter type, return type, variable type, or generic constraint
- Duplicate route patterns: /listing vs /listings, /agents vs /team,
  app/components vs root components/ — determine which is canonical
  and flag the other for removal or consolidation

───────────────────────────────────────────────────

PHASE 2: DOCUMENTATION & COMMENTS AUDIT

- Delete every comment that restates what the code does:
  BAD:  // Set the user name
        setUserName(name)
  FINE: // FUB API requires name before email or webhook silently fails
        setUserName(name)
- Delete placeholder comments: // TODO, // FIXME, // HACK — unless they
  contain a specific, actionable description with context (who, what,
  when, why)
- Flag any comment that contradicts the actual code behavior
- Flag any JSDoc that has wrong parameter types, missing parameters,
  or documents a function signature that no longer matches
- In docs/ folder: flag files that contradict each other, are duplicative,
  or describe features/APIs that don't exist in the actual code
- Specifically audit: docs/PLATFORM_REQUIREMENTS_v25.md (6,375 lines) —
  does it conflict with MASTER_INSTRUCTION_SET.md? Is anything in it NOT
  covered by other, more focused docs? If it's fully redundant, flag it
  for deletion.
- Check all links in documentation — flag any that point to files,
  routes, or URLs that no longer exist
- Flag any README or doc that references outdated tech stack versions,
  removed features, or deprecated APIs

───────────────────────────────────────────────────

PHASE 3: TYPE SAFETY & CONTRACTS

- Every 'any' type — provide the correct type or explain why 'any' is
  unavoidable (it almost never is)
- Every type assertion (as Type) — is the assertion provably correct,
  or is it papering over a type mismatch? 'as unknown as X' is always
  a red flag. Prefer type guards, generics, or fixing the upstream type.
- Every non-null assertion (!) — is the value provably non-null at that
  point? If not, add a null check or optional chaining
- Missing return types on exported functions and API route handlers
- Overly permissive generics: <T> where <T extends SpecificType> would
  catch errors at compile time
- Inconsistent type definitions: same data (e.g., a listing, a user,
  a community) shaped differently in different files — the sync layer
  types it one way, the component layer types it another, the API route
  types it a third way. There should be ONE canonical type per domain
  entity, imported everywhere.
- Zod schemas or runtime validation: are API route inputs validated
  before use? Are form submissions validated both client-side and
  server-side? Are Supabase query results typed correctly?
- Union types used as a crutch: string | number | null | undefined
  where a discriminated union with tagged variants (e.g.,
  { status: 'loading' } | { status: 'error', error: Error } |
  { status: 'success', data: T }) is more appropriate

───────────────────────────────────────────────────

PHASE 4: LOGIC & ALGORITHMIC EFFICIENCY

- O(n²) or worse operations that can be O(n) or O(n log n)
- Array.find() or Array.filter() inside loops — build a Map or Set first
- Repeated database calls that should be batched (.in() instead of loop,
  or a single query with joins instead of sequential queries)
- Synchronous operations blocking the main thread or server response
- Functions doing more than one job (>1 reason to change = split it)
- Re-computation of derived values on every render (compute inline from
  props/state, or move computation to server component)
- N+1 query patterns: fetching a list then fetching details per item in
  a loop instead of a single query with a join or .in() filter
- Race conditions: multiple async operations that can interleave — e.g.,
  user types in search, fires multiple fetches, earlier response arrives
  after later response and overwrites correct results. Check for
  AbortController usage on superseded fetches.
- Memory leaks: useEffect without cleanup — event listeners not removed,
  subscriptions not unsubscribed, timers not cleared, Supabase realtime
  channels not unsubscribed. Every useEffect that sets up a listener or
  subscription MUST return a cleanup function.
- Stale closures: callbacks or effects that reference state/props values
  that may have changed by execution time. Common in setTimeout,
  setInterval, event handlers defined inside useEffect, and debounced
  functions.

───────────────────────────────────────────────────

PHASE 5: ARCHITECTURE & STRUCTURE

- Functions > 40 lines: flag as a smell. > 80 lines: refactor required.
- Nesting > 3 levels deep: flatten with early returns or extract helpers
- Components > 200 lines: should be split into composition
- Files > 400 lines: should be split by responsibility
- Separation of concerns violations: data fetching mixed into UI
  components, business logic embedded in API route handlers, formatting
  or display logic in database/sync layers
- Inconsistent patterns: if 8 out of 10 API routes use pattern A and 2
  use pattern B, the 2 are wrong unless there's a documented justification
- Missing loading/error/empty states in any page or data-fetching
  component — every async data display needs all three states handled
- Route organization: does the app/ directory structure follow a
  consistent, predictable pattern? Are there routes that should be in
  route groups but aren't?
- Circular dependencies: module A imports B which imports A (directly or
  through a chain). These cause undefined imports during module
  initialization and are a sign of tangled architecture.
- God files: any single file imported by >15 other files is a coupling
  bottleneck — it should be split by domain or responsibility
- Barrel files (index.ts that re-exports): do they re-export everything
  including heavy components? This defeats tree-shaking and bloats the
  client bundle. In Next.js this is especially damaging because it can
  pull server-only code into client bundles.
- app/components/ directory: components inside the app/ directory are
  unusual in Next.js. Standard practice is a root-level components/
  directory. Determine if this is intentional (co-located route
  components) or an organizational mistake.

───────────────────────────────────────────────────

PHASE 6: ERROR HANDLING & RESILIENCE

- Every try/catch: does the catch block do something useful? Silent
  catches (empty block or console.log only) are bugs in production.
  At minimum: log to Sentry, show user feedback, or rethrow.
- Every .then() chain: is there a .catch()? Is the error surfaced to
  the user or logged to Sentry?
- Every Supabase query: is the { error } destructured and checked?
  Is the user shown a meaningful message on failure, not a blank screen?
- Every fetch() / API call: what happens on network failure? Timeout?
  Non-200 response? Non-JSON response? Is there a fallback UI?
- Every Inngest function: what happens when a step fails? Is there retry
  config? Is there a dead-letter / alerting path? Does Sentry capture
  background job failures?
- Missing null/undefined checks before property access on data from
  external sources (API responses, database results, URL params,
  search params, cookie values)
- Form submissions: what happens on validation failure? On server error?
  Is the user's input preserved or do they lose everything they typed?
- Global error boundaries: do app/error.tsx and app/global-error.tsx
  provide useful recovery UI, or are they generic "something went wrong"
  pages? Do they report to Sentry?
- API route error responses: are they consistent? Do they all return
  the same error shape ({ error: string, code?: string })?

───────────────────────────────────────────────────

PHASE 7: SECURITY SURFACE

- Secrets: any API key, token, or password hardcoded in source files
  (not loaded from .env)? Any .env value that should be server-only but
  is prefixed with NEXT_PUBLIC_? Specifically check: SUPABASE_SERVICE_ROLE_KEY,
  SPARK_API_KEY, FOLLOWUPBOSS_API_KEY, OPENAI_API_KEY, REPLICATE_API_TOKEN,
  SYNTHESIA_API_KEY — none of these should be NEXT_PUBLIC_
- Auth: every API route handler and server action — is there an auth
  check? Can an unauthenticated user call it? Can a regular user call
  admin-only endpoints? Map every unprotected route.
- RLS: every Supabase table — does it have row-level security enabled
  with correct policies? SELECT/INSERT/UPDATE/DELETE each need separate
  review. Pay special attention to tables containing user PII, saved
  searches, or admin data.
- Input validation: every user input (forms, URL params, search params,
  dynamic route segments like [slug] and [listingKey]) — is it validated
  and sanitized before use in database queries or HTML rendering?
- Data exposure: do any API responses or server component props leak
  data to the client that should stay server-side? (service keys, other
  users' emails, internal IDs, full database rows when only a few
  fields are needed)
- XSS: any usage of dangerouslySetInnerHTML — is the input sanitized
  with DOMPurify or equivalent? Any raw HTML rendering of user-generated
  content, listing descriptions from Spark API, or blog content?
- SQL injection: any Supabase .rpc() calls with string interpolation
  or template literals instead of parameterized arguments? Any raw SQL
  via supabase.from().select() with user-controlled column names?
- Open redirects: any auth callback or redirect logic that takes a URL
  from query params without validating against an allowlist? Check
  app/auth/callback/ specifically.
- CSRF: are state-mutating API routes (POST/PUT/DELETE) protected?
  Server actions have built-in protection, but custom route handlers
  in app/api/ may not.
- Dependency vulnerabilities: what does npm audit report? Any high or
  critical findings?
- Image remote patterns: next.config.ts allows hostname: '**' for both
  HTTP and HTTPS — this permits loading images from ANY domain including
  malicious ones. Should be restricted to known CDNs and Spark API domains.
- CORS / CSP headers: are they configured beyond the three headers
  already set? Is Content-Security-Policy set?
- Rate limiting: do public-facing API routes (search, contact forms,
  auth endpoints) have any protection against abuse or brute-force?

───────────────────────────────────────────────────

PHASE 8: PERFORMANCE & SCALABILITY

- Database: missing indexes on columns used in WHERE, ORDER BY, or JOIN
  clauses. Queries without LIMIT on tables that could grow large (listings,
  photos, user actions). Missing composite indexes for multi-column filter
  combinations common in real estate search (price + beds + city + status).
- Bundle size: are heavy libraries (recharts, @react-pdf/renderer,
  @react-google-maps/api) loaded on pages that don't need them? Are they
  dynamically imported with next/dynamic? Are client components importing
  server-only code? Is tree-shaking working (no barrel file issues)?
- Images: are all listing photos and hero images using next/image with
  explicit width/height, proper sizes attribute, priority flag for above-
  fold images, and lazy loading for below-fold? Are formats set to
  ['image/avif', 'image/webp'] (already configured — verify components
  actually use next/image, not raw <img>)?
- Core Web Vitals:
  LCP (Largest Contentful Paint) < 2.5s — is the hero image/listing
    photo prioritized? Is the LCP element identifiable and optimized?
  CLS (Cumulative Layout Shift) < 0.1 — do images have explicit
    dimensions? Do fonts cause layout shift? Do dynamic elements
    (search results, map pins) push content around?
  INP (Interaction to Next Paint) < 200ms — are click handlers
    lightweight? Are expensive operations (filtering, sorting) deferred
    or debounced?
- Third-party script impact: do GA4, GTM, Meta Pixel, Google Maps, or
  Sentry scripts block the main thread during initial load? Are they
  loaded with strategy="afterInteractive" or strategy="lazyOnload" via
  next/script? Is Google Maps loaded only on pages that show a map?
- SSG vs SSR vs ISR decision audit: pages with data that changes less
  than hourly should use ISR with revalidate. Static content pages
  (about, privacy, terms, fair-housing, dmca, accessibility) should be
  fully static. Only pages with per-request personalization or real-time
  data (dashboard, admin, search with user-specific saved status) should
  be fully dynamic SSR.
- Caching: are Supabase queries for stable data (city info, community
  descriptions, agent profiles) cached with appropriate TTL? Are fetch
  calls using Next.js cache options?
- Rendering: are components that don't need interactivity (no onClick,
  no useState, no useEffect) still marked "use client"? Every
  unnecessary "use client" directive expands the client bundle.
- Network: are there request waterfalls (sequential fetches that could
  be Promise.all)? Are payloads larger than necessary (.select('*')
  instead of specific columns)? Are list endpoints paginated?
- Fonts: loaded via next/font with display: 'swap' or causing FOIT/FOUT?
- PWA / Service Worker: is sw.ts configured correctly for Serwist?
  Is it caching the right assets? Is it not caching API responses that
  should be fresh?

───────────────────────────────────────────────────

PHASE 9: CONSISTENCY & STANDARDS

- Naming: files (kebab-case? PascalCase? camelCase?), functions
  (camelCase?), variables, types/interfaces (PascalCase?), CSS classes,
  route segments — is there ONE convention used everywhere? Flag every
  deviation.
- File structure: is the organization of app/, components/, lib/,
  utils/, types/, hooks/ consistent and predictable? Are there files
  in unexpected locations?
- Import order: is there a consistent pattern? Recommended:
  1. React/Next.js imports
  2. External library imports
  3. Internal absolute imports (@/lib, @/components, @/types)
  4. Relative imports
  5. Type-only imports
  6. Style imports
  Flag files that deviate from the dominant pattern.
- Error message format: are user-facing error messages consistent in
  tone, structure, and helpfulness? Or does each component write its
  own ad-hoc error string?
- API response envelope: do all API routes return the same shape?
  e.g., { data, error, meta } or { success, data, message }. Flag
  routes that return different shapes.
- Date handling: is there one library and one format used consistently?
  Or are there mixed uses of Date, dayjs, date-fns, moment, and raw
  string manipulation?
- Environment variable naming: is there a consistent prefix convention
  beyond NEXT_PUBLIC_? Are server-only vars clearly distinguishable?
- Component API patterns: are callback props named consistently
  (onSubmit vs handleSubmit vs submitHandler)? Are boolean props
  named consistently (isOpen vs open vs visible vs show)?
- Supabase client creation: is there one canonical way to create the
  Supabase client (server vs client vs middleware), or are there
  multiple patterns scattered across the codebase?

───────────────────────────────────────────────────

PHASE 10: TESTING & BUILD HEALTH

- Test inventory: what tests exist? What critical paths are untested?
  At minimum, these flows need test coverage:
  - Listing search and filter
  - User auth (sign up, sign in, sign out, password reset)
  - Spark sync (full sync, delta sync, error recovery)
  - Saved homes / saved searches
  - Contact form / lead submission to FUB
  - Admin auth and protected routes
- Vitest configuration: is it set up correctly? Does it run? Are there
  tests that are skipped, disabled, or always passing trivially?
- Build health: does `next build` complete without errors? List every
  warning the build produces — each one is a finding.
- TypeScript suppression: are there @ts-ignore or @ts-expect-error
  comments? Each one is a finding — provide the correct fix to remove it.
- ESLint: are there eslint-disable comments inline? Each one needs
  justification or removal. Is ESLint configured with the recommended
  Next.js rules?
- next.config.ts audit: are there experimental flags that should be
  revisited? Is the custom .env.local loader still necessary? Are the
  wildcard image remote patterns justified?
- CI/CD: is there a GitHub Actions or Vercel build pipeline? Does it
  run tests, linting, and type-checking before deploy?
- Dependency freshness: are any dependencies significantly outdated
  with known security fixes in newer versions? Is @supabase/supabase-js
  pinned to "latest" (it should be an exact version)?

═══════════════════════════════════════════════════
OUTPUT FORMAT (strict — follow exactly for every finding)
═══════════════════════════════════════════════════

Begin with an EXECUTIVE SUMMARY (one paragraph, 150 words max):
overall health score out of 10, top 3 systemic issues, single biggest
risk to production launch.

Then for each finding, use this exact format:

┌─────────────────────────────────────────────────
│ [🔴|🟠|🟡|🟢] CATEGORY — Subcategory
│ File: path/to/file.ts:LINE_NUMBER
│ Problem: (one sentence, precise, no filler)
│ Impact: (performance | security | correctness | maintainability | DX)
│ Effort: (trivial | small | medium | large)
│ Risk if botched: (what breaks if this fix is implemented incorrectly)
│ Depends on: (finding IDs that must be fixed first, or "none")
│ Fix:
│   // BEFORE
│   [exact current code]
│
│   // AFTER
│   [exact replacement code]
│
│   // or for deletions: DELETE this file/block/function
│   // or for multi-file fixes: show ALL affected files
└─────────────────────────────────────────────────

Number each finding sequentially: F-001, F-002, etc.

Priority tiers:
🔴 Critical — actively causing bugs, security holes, data loss, or will
   break under production load. Fix before any feature work.
🟠 High — creates significant tech debt, measurable inefficiency, or
   makes the codebase harder to work in. Fix this sprint.
🟡 Medium — cleanup, minor optimization, readability improvement.
   Fix when touching the file for other reasons.
🟢 Low — stylistic, optional, nice-to-have. Batch into a cleanup PR.

═══════════════════════════════════════════════════
GROUND RULES (non-negotiable)
═══════════════════════════════════════════════════

- Do not add abstraction unless it eliminates duplication in 3+ places
- Do not recommend a library when a 10-line native solution exists
- Do not preserve code "just in case" — git history exists for a reason
- Do not recommend adding comments where renaming the function would
  make the intent self-evident
- Do not suggest "consider" or "might want to" — be definitive. State
  what should be done and why.
- Treat every line as a liability until proven an asset
- If two files do similar things, one of them shouldn't exist
- If a function is called once and is under 10 lines, inline it unless
  it provides meaningful semantic naming
- Show the fix, not just the direction — code, not prose
- When the right answer is "delete this," say "delete this"
- Do not flag something as broken just because you would write it
  differently — distinguish "causes a measurable problem" from "not
  my preferred style"
- Do not recommend refactoring working code that has no measurable
  impact on performance, security, or correctness purely for elegance
- If a finding spans multiple files, show ALL affected files in the
  fix — not just the primary one
- When you encounter code that looks wrong but might be intentional
  (e.g., a deliberate setTimeout(0) to yield the event loop, or an
  unusual data structure for performance reasons), note the possibility
  with [?] rather than asserting it's a bug

═══════════════════════════════════════════════════
AFTER ALL PHASES — CLOSING DELIVERABLES
═══════════════════════════════════════════════════

After completing all 11 phases (0-10), produce these summary sections:

1. TOP 20 HIGHEST-IMPACT CHANGES
   Ranked by (impact / effort), highest first. Reference finding IDs.
   Format: rank, finding ID, one-line description, impact tier, effort.

2. FILES TO DELETE
   Complete list of files that should be removed entirely.
   For each: file path, reason, what (if anything) should absorb its
   remaining useful code.

3. DEPENDENCIES TO REMOVE
   npm packages that should be uninstalled from package.json.
   For each: package name, reason (unused, replaceable with native API,
   duplicate functionality).

4. SYSTEMIC PATTERNS REQUIRING CODEBASE-WIDE REFACTORING
   Patterns that appear in 5+ files and need a coordinated fix.
   For each: describe the pattern, list affected files, describe the
   target pattern, and outline the migration order.

5. QUICK WINS
   Changes that take <5 minutes each but meaningfully improve the
   codebase. Group these for a single cleanup PR.
   For each: file, change, estimated time.

6. RISK REGISTER
   The 5 biggest risks in this codebase that are NOT bugs today but
   WILL become bugs under specific, realistic conditions. For each:
   - What the risk is
   - Under what conditions it manifests (load, concurrency, edge case)
   - What the impact would be (data loss, security breach, UX failure)
   - The specific preventive fix

═══════════════════════════════════════════════════
COMPLIANCE CHECK (verify before submitting output)
═══════════════════════════════════════════════════

Before finalizing your audit output, verify all of the following:

[ ] Every finding uses the exact output template with all fields filled
[ ] Every finding has a concrete BEFORE/AFTER code block or DELETE
    directive — no "consider doing X" without showing the actual code
[ ] No two findings describe the same underlying issue in different words
[ ] Findings are grouped by phase (0-10), in order
[ ] Every finding has a sequential ID (F-001, F-002, etc.)
[ ] The executive summary is 150 words or fewer
[ ] The top-20 list is sorted by impact/effort ratio, highest first
[ ] Every phase was completed — none were skipped or abbreviated
[ ] The risk register contains exactly 5 items with conditions + fixes
[ ] Multi-file fixes show ALL affected files, not just the primary one

═══════════════════════════════════════════════════

Begin.
