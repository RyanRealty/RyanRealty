/**
 * True when this bundle was NOT built for the live site.
 *
 * WHY. Measured 2026-08-26: 43 sessions reached the production GA4 property as a
 * `127.0.0.1:8777` referral — our own local browsing, sitting in the reports
 * beside real traffic and counted as a referral source. Analytics that includes
 * the people building the site is not analytics.
 *
 * Both values are inlined at BUILD time, so a server render and the client
 * hydration always agree. A runtime `window.location.hostname` check cannot be
 * used by these components: they are `'use client'`, so a host check in the
 * render would emit the tags during SSR and drop them on hydration — a mismatch
 * on every page of the site.
 *
 * It fails OPEN on purpose. If neither signal is present the tags load, on the
 * reasoning that silently losing all analytics is far worse than a stray dev
 * session in the reports. `fireGa4Event` carries an independent hostname guard
 * for the server path, which is what catches a local build holding production
 * credentials.
 */
export const IS_NON_PRODUCTION_BUILD =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
