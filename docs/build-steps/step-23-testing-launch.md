# Build Step 23: Testing, First-Run Wizard & Launch Checklist

Scope: Default superuser, first-run setup, testing, seed data, CI/CD, launch checklist.

## TASK 1: First-Run Setup Wizard (if not already built in Step 12)
Verify src/app/(admin)/setup/page.tsx exists and works:
- When settings table has no 'setup_complete' record, /admin redirects to /admin/setup
- Step 1: Create admin account (name, email, password → Supabase Auth user with super_admin role)
- Step 2: Brokerage basics (name, logo upload, primary color)
- Step 3: Confirmation and redirect to /admin dashboard
- After completion: settings { key: 'setup_complete', value: true } prevents wizard from showing again
- Test this by clearing the settings table and visiting /admin

## TASK 2: Seed Data Script
Create scripts/seed.ts (run with tsx or ts-node):
- Insert initial cities: Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Madras, Crooked River Ranch, Terrebonne, Powell Butte, Tumalo
  - Include slugs, descriptions (placeholder, to be AI-generated later), and basic data
- Insert initial communities: Tetherow, Broken Top, Black Butte Ranch, Brasada Ranch, Eagle Crest, Pronghorn, Sunriver, Caldera Springs, Crosswater, Vandevert Ranch, Northwest Crossing, Old Bend, Awbrey Butte, Awbrey Glen, Shevlin Commons, Discovery West, Petrosa, River Rim, Three Pines, Mountain High
  - Include slugs, is_resort flag, city assignment
- Insert default settings: site_name "Ryan Realty", primary_color "#102742", etc.
- This gives the site real geographic data to display even before the MLS sync runs
- Run with: npx tsx scripts/seed.ts

## TASK 3: Error Boundary Testing
Verify every route group has error.tsx:
- src/app/(public)/error.tsx — friendly "Something went wrong" with "Go Home" button
- src/app/(dashboard)/error.tsx — "Something went wrong" with "Go to Dashboard" button
- src/app/(admin)/error.tsx — "Something went wrong" with error details (admin can see stack trace in dev)
Verify every route group has loading.tsx with appropriate skeleton components.
Verify every route group has not-found.tsx with helpful messaging and navigation.

## TASK 4: Environment Variable Validation
Create src/lib/env.ts:
- Validate all required env vars at build time / startup
- For each var: check it exists and is not empty
- Required for build: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- Required for runtime: SUPABASE_SERVICE_ROLE_KEY, SPARK_API_KEY
- Optional (warn but don't fail): all others
- Log which optional services are not configured (helps during development)
- Import and call in src/app/layout.tsx or instrumentation.ts

## TASK 5: Vitest Unit Tests
Install: npm install -D vitest @testing-library/react @testing-library/jest-dom
Create vitest.config.ts with Next.js compatibility.

Write tests for critical utilities:
- src/lib/__tests__/cma.test.ts: test CMA computation with mock comp data, test adjustment calculations, test edge cases (no comps, insufficient data)
- src/lib/__tests__/lead-scoring.test.ts: test point calculation, test tier thresholds, test decay
- src/lib/__tests__/listing-processor.test.ts: test field mapping, test status change detection, test price change detection
- src/lib/__tests__/tracking.test.ts: test event typing, test dataLayer push

## TASK 6: Playwright E2E Tests
Install: npm install -D @playwright/test
Create playwright.config.ts.

Write E2E tests for critical user flows:
- tests/homepage.spec.ts: page loads, hero visible, search works, navigation works
- tests/search.spec.ts: filters work, results display, map loads, pagination works
- tests/listing.spec.ts: listing detail loads, all sections render, save button works (with auth flow)
- tests/auth.spec.ts: signup flow, login flow, logout flow
- tests/admin.spec.ts: admin login, dashboard loads, sync status page loads

## TASK 7: Pre-Launch Checklist Script
Create scripts/pre-launch-check.ts that verifies:
- [ ] All env vars set in Vercel (list and check each)
- [ ] Supabase tables exist (query information_schema)
- [ ] PostGIS extension enabled
- [ ] RLS enabled on all tables
- [ ] At least one admin user exists
- [ ] Spark API reachable (test fetch)
- [ ] Sentry DSN valid (test error capture)
- [ ] Inngest functions registered (check app)
- [ ] robots.txt accessible and correct
- [ ] sitemap.xml generates without error
- [ ] OG image endpoint returns 200
- [ ] All public pages return 200 (homepage, search, communities, cities, agents, blog, about, contact)
- [ ] SSL certificate valid
- [ ] Custom domain configured in Vercel
- Output: pass/fail for each check with details

## TASK 8: GitHub Actions CI
Create .github/workflows/ci.yml:
```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npx vitest run
```

This runs on every PR and push to main. Vercel build check also runs automatically.

## TASK 9: Custom Domain Setup (Manual — document for Matt)
Create docs/DOMAIN_SETUP.md:
1. In Vercel: Settings > Domains > Add domain: ryan-realty.com and www.ryan-realty.com
2. In domain registrar DNS: add CNAME record pointing to cname.vercel-dns.com (or A record to Vercel IPs)
3. Vercel auto-provisions SSL certificate
4. Set NEXT_PUBLIC_SITE_URL=https://ryan-realty.com in Vercel env vars
5. Update Supabase Auth > URL Configuration > Site URL to https://ryan-realty.com
6. Update Supabase Auth > URL Configuration > Redirect URLs to include https://ryan-realty.com/api/auth/callback
7. Update Google OAuth authorized redirect URIs
8. Set up Resend sending domain: mail.ryan-realty.com with SPF, DKIM, DMARC DNS records

TypeScript strict. No any types.
