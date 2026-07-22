import 'server-only'

/**
 * Google Postmaster Tools ingestion (spec §6.7). Pulls per-day traffic stats
 * (Gmail domain reputation, user-reported spam rate, SPF/DKIM/DMARC pass
 * ratios, IP reputation, delivery errors) for the three sending identities and
 * maps them to `deliverability_metrics` rows. The /api/cron/postmaster-sync
 * cron upserts these daily; the pre-send guard (G-NL-20) reads the latest
 * news.ryan-realty.com row via lib/data/deliverability.
 *
 * Auth is the existing service account with domain-wide delegation
 * impersonating matt@ryan-realty.com (the Postmaster Tools owner — all three
 * domains are registered under that account, done 2026-07-02). One-time
 * prereqs if auth fails at runtime (surface these, never throw):
 *   1. GCP project `ryanrealty`: enable the Gmail Postmaster Tools API.
 *   2. Workspace Admin → Security → API controls → Domain-wide delegation:
 *      the service account client id must carry the scope
 *      https://www.googleapis.com/auth/postmaster.readonly.
 *   3. postmaster.google.com (as matt@ryan-realty.com): all three domains
 *      registered + verified.
 *
 * The adapter is deliberately thin (one file) so the Postmaster v2 swap
 * (/v2/sender_compliance, after the 2025-10-31 legacy sunset) touches only
 * this module.
 */

import { google } from 'googleapis'
import type { JWT } from 'google-auth-library'
import type { gmailpostmastertools_v1 } from 'googleapis'

export const POSTMASTER_DOMAINS = [
  'ryan-realty.com',
  'mail.ryan-realty.com',
  'news.ryan-realty.com',
] as const

export const POSTMASTER_SCOPE = 'https://www.googleapis.com/auth/postmaster.readonly'
export const POSTMASTER_IMPERSONATE_USER = 'matt@ryan-realty.com'

/**
 * The exact one-time setup steps, kept as a constant so the cron's no-op log
 * always names them verbatim (the route must never throw on missing setup).
 */
export const POSTMASTER_SETUP_HINT =
  'One-time setup: (1) enable the Gmail Postmaster Tools API in GCP project ryanrealty; ' +
  `(2) Workspace Admin → Security → API controls → Domain-wide delegation: add ${POSTMASTER_SCOPE} ` +
  'to the service account allowlist; (3) verify all three sending domains are registered at ' +
  `postmaster.google.com under ${POSTMASTER_IMPERSONATE_USER}.`

/** SPF/DKIM/DMARC pass ratio at or above this maps to spf_ok/dkim_ok/dmarc_ok = true. */
const AUTH_OK_THRESHOLD = 0.95

export type PostmasterAuthStatus = {
  ok: boolean
  client: JWT | null
  error: string | null
  hint?: string
}

/**
 * DWD-authorized JWT for the Postmaster Tools API. Mirrors
 * lib/marketing-brain/inbox-auth.ts: authorize() is exercised eagerly so a
 * missing scope grant or missing creds comes back as ok=false with the setup
 * hint instead of an exception mid-fetch.
 */
export async function getPostmasterAuth(): Promise<PostmasterAuthStatus> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!clientEmail || !privateKey) {
    return {
      ok: false,
      client: null,
      error: 'GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY missing',
      hint: POSTMASTER_SETUP_HINT,
    }
  }
  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: [POSTMASTER_SCOPE],
    subject: POSTMASTER_IMPERSONATE_USER,
  })
  try {
    await jwt.authorize()
    return { ok: true, client: jwt, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isGrantProblem = /unauthorized_client|invalid_grant|insufficient|access_denied/i.test(msg)
    return {
      ok: false,
      client: null,
      error: msg,
      hint: isGrantProblem ? POSTMASTER_SETUP_HINT : undefined,
    }
  }
}

/** Shape of one deliverability_metrics upsert (unique on domain + metric_date). */
export type DeliverabilityUpsertRow = {
  domain: string
  metric_date: string // YYYY-MM-DD
  spam_ratio: number | null
  domain_reputation: string | null // HIGH | MEDIUM | LOW | BAD
  ip_reputation_summary: unknown[]
  spf_ok: boolean | null
  dkim_ok: boolean | null
  dmarc_ok: boolean | null
  delivery_errors: unknown[]
}

function ratioToOk(ratio: number | null | undefined): boolean | null {
  if (ratio === null || ratio === undefined) return null
  return ratio >= AUTH_OK_THRESHOLD
}

/**
 * Maps one API TrafficStats to a deliverability_metrics row. Exported for unit
 * testing. Returns null when the stat carries no parseable date (the date is
 * the YYYYMMDD suffix of `name`: domains/{domain}/trafficStats/{date}).
 */
export function trafficStatsToRow(
  domain: string,
  stat: gmailpostmastertools_v1.Schema$TrafficStats,
): DeliverabilityUpsertRow | null {
  const dateDigits = stat.name?.match(/\/trafficStats\/(\d{8})$/)?.[1]
  if (!dateDigits) return null
  const metricDate = `${dateDigits.slice(0, 4)}-${dateDigits.slice(4, 6)}-${dateDigits.slice(6, 8)}`
  return {
    domain,
    metric_date: metricDate,
    spam_ratio: stat.userReportedSpamRatio ?? null,
    domain_reputation: stat.domainReputation ?? null,
    ip_reputation_summary: (stat.ipReputations ?? []) as unknown[],
    spf_ok: ratioToOk(stat.spfSuccessRatio),
    dkim_ok: ratioToOk(stat.dkimSuccessRatio),
    dmarc_ok: ratioToOk(stat.dmarcSuccessRatio),
    delivery_errors: (stat.deliveryErrors ?? []) as unknown[],
  }
}

function toDateParts(d: Date): { year: number; month: number; day: number } {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/**
 * Fetches the last `days` days of traffic stats for one domain and maps them
 * to upsert rows. Gmail typically publishes stats with a 2-3 day lag and only
 * once meaningful volume flows, so an empty result is normal early on — the
 * caller treats it as "no data yet", not an error. Throws on API errors
 * (permission, registration) so the caller can report per-domain.
 */
export async function getPostmasterStats(
  auth: JWT,
  domain: string,
  days = 7,
): Promise<DeliverabilityUpsertRow[]> {
  const api = google.gmailpostmastertools({ version: 'v1', auth })
  const end = new Date()
  const start = new Date(end.getTime() - days * 86_400_000)
  const s = toDateParts(start)
  const e = toDateParts(end)

  const rows: DeliverabilityUpsertRow[] = []
  let pageToken: string | undefined
  do {
    const res = await api.domains.trafficStats.list({
      parent: `domains/${domain}`,
      'startDate.year': s.year,
      'startDate.month': s.month,
      'startDate.day': s.day,
      'endDate.year': e.year,
      'endDate.month': e.month,
      'endDate.day': e.day,
      pageSize: 31,
      pageToken,
    })
    for (const stat of res.data.trafficStats ?? []) {
      const row = trafficStatsToRow(domain, stat)
      if (row) rows.push(row)
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  return rows
}
