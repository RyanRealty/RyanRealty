/**
 * Search Console reads for the crawl probe: the Sitemaps API (what Google holds
 * for each submitted sitemap) and the URL Inspection API (how Google last saw
 * one URL). Read-only scope, same service account and property the other GSC
 * readers use (app/actions/search-console-report.ts, scripts/_gsc-by-class.mjs):
 * GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY on
 * the https://ryan-realty.com/ URL-prefix property unless
 * GOOGLE_SEARCH_CONSOLE_SITE_URL overrides it. The sc-domain: property is not
 * granted to this account (2026-05-13 sites.list diagnostic).
 *
 * URL Inspection quota is 2,000 calls a day and 600 a minute per property; the
 * probe inspects a few URLs per page class, far inside it.
 *
 * Imports the Search Console client alone (googleapis/build/src/apis/
 * searchconsole) rather than the googleapis barrel: the barrel requires every
 * Google API (196 MB in node_modules), which is what pushed admin/bpo past the
 * 250 MB function limit on 2026-09-16 (next.config.ts BPO_LAMBDA_TRACE_EXCLUDES).
 */
import { auth, searchconsole } from 'googleapis/build/src/apis/searchconsole'
import type { GscIndexStatus, GscSitemapEntry } from './checks'

export type GscClient = {
  siteUrl: string
  listSitemaps(): Promise<GscSitemapEntry[]>
  inspect(url: string): Promise<GscIndexStatus | null>
}

/** Null when the service account is not configured in this environment. */
export function createGscClient(env: NodeJS.ProcessEnv = process.env): GscClient | null {
  const email = env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const key = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!email || !key) return null
  const siteUrl = env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || 'https://ryan-realty.com/'
  const jwt = new auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
  const sc = searchconsole({ version: 'v1', auth: jwt })
  return {
    siteUrl,
    async listSitemaps() {
      const { data } = await sc.sitemaps.list({ siteUrl })
      return (data.sitemap ?? []) as GscSitemapEntry[]
    },
    async inspect(url: string) {
      const { data } = await sc.urlInspection.index.inspect({
        requestBody: { inspectionUrl: url, siteUrl },
      })
      return (data.inspectionResult?.indexStatusResult ?? null) as GscIndexStatus | null
    },
  }
}
