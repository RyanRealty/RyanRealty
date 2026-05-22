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
// The listing-key URL uses a stable Bend active listing (920k, Awbrey area).
// If the listing ever sells we'll need to update the key here; this is a known
// limitation of point-route lhci config.
module.exports = {
  ci: {
    collect: {
      url: [
        "http://127.0.0.1:3000/",
        "http://127.0.0.1:3000/cities/bend",
        "http://127.0.0.1:3000/cities/bend/awbrey-butte",
        "http://127.0.0.1:3000/communities/bend-tetherow",
        "http://127.0.0.1:3000/zip/97703",
        // Canonical SEO path. /listing/<key> issues a 308 redirect to this
        // URL which Lighthouse cannot follow (FAILED_DOCUMENT_REQUEST), so
        // we test the post-redirect canonical directly.
        "http://127.0.0.1:3000/homes-for-sale/bend/southeast-bend/stonegate/60320-sage-stone-220221963",
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
