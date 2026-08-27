/**
 * The /dev/* refusal. Two properties matter and neither is visible in a code
 * review, because middleware.ts reads process.env.NODE_ENV and Next inlines
 * that into the edge bundle at compile time:
 *
 *   1. FAIL CLOSED. Only NODE_ENV === 'development' opens the tree. Production,
 *      preview, test, and an unset value all refuse. A predicate written the
 *      other way round (`!== 'production'`) would have left every Vercel
 *      PREVIEW URL serving the prototypes, which is the same public reach.
 *   2. NO COLLATERAL. A real public route that merely shares the prefix must
 *      pass straight through — the refusal returns a status, so nothing
 *      downstream gets a second chance to say yes.
 */

import { describe, it, expect } from 'vitest'
import { isDevOnlyPath, shouldRefuseDevRoute, DEV_NOT_FOUND_HTML } from './dev-only'

/** The seven routes that answered 200 on production before the gate existed. */
const DEV_ROUTES = [
  '/dev/animated-map',
  '/dev/components',
  '/dev/public-v3',
  '/dev/public-v3/barrel',
  '/dev/public-v3/homes',
  '/dev/public-v3/places',
  '/dev/public-v3/sell',
]

describe('isDevOnlyPath', () => {
  it('claims every /dev route and the bare /dev', () => {
    for (const route of [...DEV_ROUTES, '/dev']) {
      expect(isDevOnlyPath(route)).toBe(true)
    }
  })

  it('does not claim a public route that shares the prefix', () => {
    for (const route of [
      '/',
      '/development',
      '/developers',
      '/blog/dev-notes',
      '/central-oregon/golf',
      '/subdivisions/tetherow-phase-5',
    ]) {
      expect(isDevOnlyPath(route)).toBe(false)
    }
  })
})

describe('shouldRefuseDevRoute', () => {
  it('serves /dev only when NODE_ENV is development', () => {
    for (const route of DEV_ROUTES) {
      expect(shouldRefuseDevRoute(route, 'development')).toBe(false)
    }
  })

  it('refuses on production, preview, test, and an unset NODE_ENV', () => {
    for (const env of ['production', 'preview', 'test', '', undefined]) {
      for (const route of DEV_ROUTES) {
        expect(shouldRefuseDevRoute(route, env)).toBe(true)
      }
    }
  })

  it('never refuses a public route, whatever the environment', () => {
    for (const env of ['production', 'preview', 'development', undefined]) {
      expect(shouldRefuseDevRoute('/central-oregon/golf', env)).toBe(false)
      expect(shouldRefuseDevRoute('/development', env)).toBe(false)
    }
  })
})

describe('DEV_NOT_FOUND_HTML', () => {
  it('is a real page: one h1, noindex, and an exit', () => {
    expect(DEV_NOT_FOUND_HTML).toContain('<h1')
    expect(DEV_NOT_FOUND_HTML).toContain('content="noindex, nofollow"')
    expect(DEV_NOT_FOUND_HTML).toContain('href="/"')
    // Self-contained: middleware runs on the edge and cannot render React or
    // reach the app's CSS, so nothing here may point at a bundled asset.
    expect(DEV_NOT_FOUND_HTML).not.toContain('/_next/')
  })
})
