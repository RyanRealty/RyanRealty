import 'server-only'

/**
 * Pre-send runtime gates for the newsletter (spec §12):
 *
 *   R-2 — every stat token in the body maps to a `citations` entry (the §0
 *         verification trace). The stat-token grammar is DEFINED, not "any
 *         number": currency ($739,000), percents (2.1%), day counts (38 days),
 *         months-of-supply (4.3 months), labeled inventory counts (16 homes for
 *         sale), and market-verdict pills (SELLER'S / BALANCED / BUYER'S).
 *         Prose numerals, event dates, and phone digits are excluded.
 *   R-3 — every internal (ryan-realty.com) link in the body resolves with an
 *         HTTP 2xx, so an issue can never ship a dead destination.
 *
 * Both gates BLOCK scheduling (adminScheduleNewsletterAction) and are shown on
 * the review page so Matt sees exactly what failed. Pure checkers are exported
 * for unit tests; only the link fetch touches the network.
 */

import type { NewsletterCitationEntry } from '@/lib/data/newsletter'
import { isComplianceLink } from '@/lib/email-tracking'

export type GateResult = { ok: boolean; failures: string[]; checked: number }
export type PreSendGateReport = { ok: boolean; r2: GateResult; r3: GateResult }

// ── R-2: citations ────────────────────────────────────────────────────────────

/**
 * Remove quoted-content blocks before scanning. The producer marks verbatim
 * excerpts of ALREADY-PUBLISHED pages (blog excerpts in Worth Reading) with
 * `data-nl-quote` — their figures were verified when that page shipped and are
 * quoted editorial content, not producer-authored stats (same carve-out as the
 * spec's "numbers inside a listing blurb").
 */
function stripQuotedBlocks(html: string): string {
  return html.replace(/<(\w+)[^>]*\bdata-nl-quote\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
}

/** Strip tags so stat tokens are matched against rendered TEXT, not attribute noise. */
function htmlToText(html: string): string {
  return stripQuotedBlocks(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

function toNumber(s: string): number {
  return Number(s.replace(/[$,%]/g, '').replace(/,/g, ''))
}

/** Numbers cited in the trace (raw values). */
function citedNumbers(citations: NewsletterCitationEntry[]): number[] {
  const out: number[] = []
  for (const c of citations) {
    const n = typeof c.value === 'number' ? c.value : Number(c.value)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

function citedStrings(citations: NewsletterCitationEntry[]): Set<string> {
  const out = new Set<string>()
  for (const c of citations) {
    if (typeof c.value === 'string') out.add(c.value.trim().toLowerCase())
  }
  return out
}

const VERDICT_LABELS: Array<{ pattern: RegExp; value: string; label: string }> = [
  { pattern: /SELLER'S/g, value: 'sellers', label: "SELLER'S verdict" },
  { pattern: /BUYER'S/g, value: 'buyers', label: "BUYER'S verdict" },
  { pattern: /BALANCED/g, value: 'balanced', label: 'BALANCED verdict' },
]

/**
 * R-2 pure checker: every stat token in bodyHtml must trace to a citation.
 * Currency tokens are compared against citation values rounded to the nearest
 * thousand (the brand renders $739,450 as $739,000); one-decimal figures get a
 * small tolerance; counts must match exactly.
 */
export function checkCitations(bodyHtml: string, citations: NewsletterCitationEntry[]): GateResult {
  const text = htmlToText(bodyHtml ?? '')
  const nums = citedNumbers(citations ?? [])
  const strs = citedStrings(citations ?? [])
  const failures: string[] = []
  let checked = 0

  const numberMatches = (n: number, opts?: { currency?: boolean; tolerance?: number }) => {
    for (const c of nums) {
      if (c === n) return true
      if (opts?.currency && Math.round(c / 1000) * 1000 === n) return true
      if (opts?.tolerance != null && Math.abs(c - n) <= opts.tolerance) return true
    }
    return false
  }

  const scan = (re: RegExp, describe: (m: RegExpMatchArray) => string, num: (m: RegExpMatchArray) => number, opts?: { currency?: boolean; tolerance?: number }) => {
    for (const m of text.matchAll(re)) {
      checked++
      const n = num(m)
      if (!Number.isFinite(n) || !numberMatches(n, opts)) {
        failures.push(`No citation for ${describe(m)}`)
      }
    }
  }

  // Currency: $1,234,000 (requires a thousands separator so "$5" prose is skipped).
  scan(/\$\d{1,3}(?:,\d{3})+/g, (m) => `"${m[0]}" (currency figure)`, (m) => toNumber(m[0]), { currency: true })
  // Percents: 2.1% or 12%
  scan(/\b\d+(?:\.\d+)?%/g, (m) => `"${m[0]}" (percent)`, (m) => toNumber(m[0]), { tolerance: 0.05 })
  // Day counts: 38 days
  scan(/\b(\d{1,4})\s+days?\b/gi, (m) => `"${m[0]}" (day count)`, (m) => Number(m[1]))
  // Months of supply: 4.3 months
  scan(/\b(\d{1,2}(?:\.\d+)?)\s+months?\b/gi, (m) => `"${m[0]}" (months of supply)`, (m) => Number(m[1]), { tolerance: 0.05 })
  // Labeled inventory counts: 16 homes for sale · 142 active listings · 188 sales
  scan(
    /\b(\d{1,6})\s+(?:homes?\s+for\s+sale|for\s+sale|active\s+listings?|homes?\s+sold|closed\s+sales|sales|listings)\b/gi,
    (m) => `"${m[0].trim()}" (inventory count)`,
    (m) => Number(m[1]),
  )

  // Market-verdict pills — each label used must trace to a verdict citation.
  for (const v of VERDICT_LABELS) {
    if (v.pattern.test(text)) {
      checked++
      if (!strs.has(v.value)) failures.push(`No citation for the ${v.label} shown in the body`)
    }
  }

  // De-dupe repeated identical failures (the same figure can appear twice).
  const unique = [...new Set(failures)]
  return { ok: unique.length === 0, failures: unique, checked }
}

// ── R-3: internal links resolve ───────────────────────────────────────────────

const INTERNAL_HOSTS = new Set(['ryan-realty.com', 'www.ryan-realty.com'])

/** Pure: pull the internal page links out of the body (deduped, compliance links skipped). */
export function extractInternalLinks(bodyHtml: string): string[] {
  const out = new Set<string>()
  for (const m of (bodyHtml ?? '').matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
    const url = m[1]
    if (isComplianceLink(url)) continue
    try {
      const u = new URL(url)
      if (!INTERNAL_HOSTS.has(u.hostname.toLowerCase())) continue
      out.add(url)
    } catch {
      // unparseable href — leave to the voice/format gates
    }
  }
  return [...out]
}

const LINK_TIMEOUT_MS = 8000
const LINK_CAP = 40

type FetchLike = (url: string, init?: { redirect?: 'follow'; signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ status: number }>

/**
 * R-3: every internal link returns HTTP 2xx. Fetches in parallel with a
 * per-link timeout; the fetch is injectable for tests.
 */
export async function checkInternalLinks(bodyHtml: string, fetchImpl: FetchLike = fetch): Promise<GateResult> {
  const links = extractInternalLinks(bodyHtml).slice(0, LINK_CAP)
  const failures: string[] = []
  await Promise.all(
    links.map(async (url) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS)
      try {
        const res = await fetchImpl(url, {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'user-agent': 'RyanRealty-newsletter-linkcheck/1.0' },
        })
        if (res.status < 200 || res.status >= 300) {
          failures.push(`${url} returned HTTP ${res.status}`)
        }
      } catch {
        failures.push(`${url} did not respond`)
      } finally {
        clearTimeout(timer)
      }
    }),
  )
  failures.sort()
  return { ok: failures.length === 0, failures, checked: links.length }
}

// ── Combined report ───────────────────────────────────────────────────────────

/** Run both gates against a draft row. The schedule action blocks unless ok. */
export async function runPreSendGates(letter: {
  body_html: string | null
  citations?: NewsletterCitationEntry[] | null
}): Promise<PreSendGateReport> {
  const body = letter.body_html ?? ''
  const r2 = checkCitations(body, letter.citations ?? [])
  const r3 = await checkInternalLinks(body)
  return { ok: r2.ok && r3.ok, r2, r3 }
}
