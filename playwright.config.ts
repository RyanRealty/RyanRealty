import { defineConfig, devices } from '@playwright/test'

const HAS_AUTH_CREDENTIALS = Boolean(
  process.env.E2E_SIGNED_IN_EMAIL?.trim() && process.env.E2E_SIGNED_IN_PASSWORD?.trim()
)
const AUTH_STATE_FILE = 'e2e/.auth/user.json'

/**
 * Playwright configuration for E2E and visual regression testing.
 *
 * Usage:
 *   npm run test:e2e                    — Run all E2E tests (chromium)
 *   npm run test:e2e:ui                 — Open Playwright UI mode
 *   npm run test:e2e:update-snapshots   — Update visual regression baselines
 *
 * In CI, the app is built first (`npm run build`) then served via `next start`.
 * Locally, reuses an existing dev server if one is running.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Parallel tests in CI, sequential locally for stability */
  workers: process.env.CI ? 2 : 1,

  /* Reporter: HTML locally, GitHub-friendly in CI */
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'e2e/html-report' }]]
    : [['html', { open: 'on-failure', outputFolder: 'e2e/html-report' }]],

  /* Shared settings for all projects */
  use: {
    // When BASE_URL is set (CI against a deployed site, or local override),
    // use it. Otherwise fall back to the local dev server.
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  /* Screenshot comparison tolerance */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  /* Projects — setup → authenticated → anonymous (chromium + mobile)
   *
   * When E2E_SIGNED_IN_EMAIL + E2E_SIGNED_IN_PASSWORD are set:
   *   1. "setup" logs in and saves cookies to e2e/.auth/user.json
   *   2. "authenticated" reuses those cookies for signed-in user tests
   *   3. "chromium" + "mobile" run everything else anonymously
   *
   * When env vars are NOT set:
   *   - "setup" and "authenticated" are omitted entirely
   *   - Signed-in tests in chromium/mobile skip via HAS_SIGNED_IN_CREDENTIALS guard
   */
  projects: [
    /* Auth setup + authenticated — only included when credentials exist */
    ...(HAS_AUTH_CREDENTIALS
      ? [
          {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
            use: {
              ...devices['Desktop Chrome'],
            },
          },
          {
            name: 'authenticated',
            dependencies: ['setup'],
            testMatch: /user-journeys\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 1280, height: 720 },
              storageState: AUTH_STATE_FILE,
            },
          },
        ]
      : []),

    /* Anonymous desktop tests */
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },

    /* Mobile tests */
    {
      name: 'mobile',
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],

  /* Start the Next.js production server before running tests.
   * Skipped when BASE_URL points to a remote host (CI post-deploy runs,
   * local runs against the live production or staging site). */
  ...(process.env.BASE_URL ? {} : {
    webServer: {
      command: 'npm run start:ci',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  }),
})
