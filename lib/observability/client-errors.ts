/**
 * Browser error reporting that costs nothing on page load. Sentry's browser SDK
 * (sentry-browser.ts) is fetched on the first error instead of with every page:
 * about 48 KB gzipped when loaded eagerly (esbuild, minified, 2026-09-24).
 * Server errors report through sentry.server.config.ts.
 */
let capture: Promise<(error: unknown) => void> | undefined

export function reportClientError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  capture ??= import('./sentry-browser')
    .then((sdk) => sdk.captureInBrowser)
    .catch((loadError: unknown) => {
      capture = undefined // a failed chunk load retries on the next error
      throw loadError
    })
  capture.then((send) => send(error)).catch(() => {
    // Reporting must never throw into the page it is reporting on.
  })
}

/** Uncaught errors and rejections. Error boundaries call reportClientError themselves. */
export function installClientErrorReporting(): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_SENTRY_DSN) return
  window.addEventListener('error', (event) => reportClientError(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportClientError(event.reason))
}
