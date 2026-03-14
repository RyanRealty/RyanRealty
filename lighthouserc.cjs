/**
 * Lighthouse CI config. Run: npx @lhci/cli@0.13.x autorun
 * Or add to GitHub Actions: run Lighthouse on key URLs and assert performance >= 90.
 * Requires a running server (e.g. npm run start or preview URL).
 */
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/listings', 'http://localhost:3000/feed'],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
