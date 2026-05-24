// lighthouserc.cjs — perf budget per docs/SITE_SPEC.md DONE CRITERIA.
//
// Routes: the 5 canonical LP families the spec calls out + supporting pages
// that already exist + a real active listing key for the detail page.
//
// Thresholds: goal-strict per docs/SITE_SPEC.md:
//   Perf       ≥ 0.90  (error)
//   A11y       ≥ 0.95  (error)
//   Best Pract ≥ 0.90  (error)
//   SEO        ≥ 0.95  (error)
//   LCP        ≤ 2500ms (error)
//   CLS        ≤ 0.10   (error)
//
// The listing-detail URL is resolved at lhci-run time by
// `scripts/pick-lhci-listing.mjs` and passed in via LHCI_LISTING_URL.
// Run the picker first:
//   LHCI_LISTING_URL=$(node scripts/pick-lhci-listing.mjs) npm run ci:lighthouse
// (npm run ci:lighthouse handles this automatically.)
//
// Fallback if LHCI_LISTING_URL is missing: a known-active Tetherow listing.
// The picker also falls through to /cities/bend if every listing candidate
// returns "Listing Not Found" (e.g. during a Supabase outage), so lhci can
// still measure SOMETHING and surface the data outage rather than silently
// failing on a stale URL.
const LISTING_URL =
  process.env.LHCI_LISTING_URL ||
  "http://127.0.0.1:3000/homes-for-sale/bend/tetherow/61281-mcroberts-220218727"

module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:3000/",
        "http://127.0.0.1:3000/cities/bend",
        "http://127.0.0.1:3000/cities/bend/awbrey-butte",
        "http://127.0.0.1:3000/communities/bend-tetherow",
        "http://127.0.0.1:3000/zip/97703",
        LISTING_URL,
        "http://127.0.0.1:3000/team",
        "http://127.0.0.1:3000/about",
      ],
      numberOfRuns: 2,
      settings: {
        preset: "desktop",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
