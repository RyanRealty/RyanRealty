/**
 * Identity params never enter a stored URL.
 *
 * `?_pid=<crm_people.id>` and `?_fuid=<legacy id>` are how a link WE emailed
 * names its recipient. They belong in the request and in the identify backfill;
 * they do not belong in `visitor_events.page_url`, which is read by dashboards,
 * exported, and joined all over the CRM — nor in the GA4 mirror, which hands
 * the URL to a third party.
 *
 * Measured on production 2026-09-07, before this stripped them: rows in
 * `visitor_events` carried `https://ryan-realty.com/?agent=matt&_fuid=22288&_pid=13490`
 * verbatim, so a contact id sat in a stored URL on every identified arrival.
 *
 * `PersonIdentityBridge` does clean the address bar, but it cannot be the
 * mechanism: it runs in an effect and the page_view POST races it, which is
 * exactly why those rows exist. The server strips, so the timing cannot matter.
 *
 * Everything else stays. `utm_*`, `agent`, `fbclid` and `gclid` describe the
 * CLICK, not the person — the rule the route's campaign block already states —
 * and `utm_campaign` is load-bearing now: it is what tells the CMA outcome
 * reader which document sent this visitor to this page.
 *
 * Lives beside the route rather than inside it because `route.ts` may only
 * export HTTP handlers, and a privacy rule this load-bearing gets its own test.
 */

/** Params that name a person. Extend here, nowhere else. */
export const IDENTITY_PARAMS = ['_pid', '_fuid'] as const

/**
 * The URL as it may be stored. Returns undefined only for an absent input, so
 * a caller can keep using `?? undefined` to mean "column stays null".
 * A string we cannot parse is returned unchanged rather than half-edited — a
 * referrer can be anything, and guessing at one is worse than keeping it.
 */
export function stripIdentityParams(url: string | null | undefined): string | undefined {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return undefined
  try {
    const u = new URL(raw)
    let touched = false
    for (const p of IDENTITY_PARAMS) {
      if (u.searchParams.has(p)) {
        u.searchParams.delete(p)
        touched = true
      }
    }
    return touched ? u.toString() : raw
  } catch {
    return raw
  }
}
