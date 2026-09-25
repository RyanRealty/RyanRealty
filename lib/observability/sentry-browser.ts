import { captureException, init } from '@sentry/nextjs'
import { scrubDeep } from '@/lib/analytics/private-paths'

// client-errors.ts owns the window listeners, and the browser sends errors
// only: no tracing, no session replay.
const SKIPPED_INTEGRATIONS = new Set(['BrowserTracing', 'GlobalHandlers'])

let started = false

/**
 * The browser half of Sentry. client-errors.ts imports this module on the
 * first error, so it never ships with the page.
 */
export function captureInBrowser(error: unknown): void {
  if (!started) {
    started = true
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      integrations: (defaults) => defaults.filter((integration) => !SKIPPED_INTEGRATIONS.has(integration.name)),
      // In production, only errors thrown by our own pages count; a browser
      // extension's or a third-party tag's never spend the error quota.
      allowUrls: process.env.NODE_ENV === 'production' ? [/^https:\/\/(www\.)?ryan-realty\.com\//] : undefined,
      ignoreErrors: [/^ResizeObserver loop/, /^Script error\.?$/],
      // A signing link's token (and any secret query value) never leaves in a report.
      beforeSend: (event) => scrubDeep(event),
      beforeBreadcrumb: (crumb) => scrubDeep(crumb),
    })
  }
  captureException(error)
}
