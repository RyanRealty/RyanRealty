/**
 * The one renderer for a CMA first-contact letter.
 *
 * The composer stores words and clean hrefs. This module turns either that
 * structure, or a broker's edited plain text, into the HTML and the
 * plain-text alternative. buildLeadBody (default and override) and the
 * Review preview both call it. It stamps utm_source=cma and
 * utm_campaign=<slug> only. agent, _pid, utm_medium=email and utm_content
 * are added later by decorateOutboundText, once, on the href.
 */

import { cmaReportButtonHtml } from '@/lib/cma/report-button'
import { peelTrailingUrlPunctuation } from '@/lib/analytics/own-site-links'

export const CMA_EMAIL_ORIGIN = 'https://ryan-realty.com'

export type FirstContactRun = string | { text: string; href: string }

const TOKEN_RE = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s<]+/g

export function cleanFirstPartyHref(href: string): string {
  const decoded = peelTrailingUrlPunctuation(href.replace(/&amp;/gi, '&').trim()).url
  try {
    const u = new URL(decoded, CMA_EMAIL_ORIGIN)
    if (u.hostname.replace(/^www\./, '') !== 'ryan-realty.com') return u.toString()
    return `${CMA_EMAIL_ORIGIN}${u.pathname}`
  } catch {
    return decoded
  }
}

/** utm_source=cma and utm_campaign=<slug> only. Other keys are the decorator's. */
export function stampCmaEmailCampaign(href: string, slug: string | null | undefined): string {
  const campaign = (slug ?? '').trim()
  if (!campaign) return href
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return href
  }
  if (u.hostname.replace(/^www\./, '') !== 'ryan-realty.com') return href
  if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'cma')
  if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', campaign)
  return u.toString()
}

export function labelForBareUrl(raw: string): string {
  const href = cleanFirstPartyHref(raw)
  try {
    const u = new URL(href)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname.replace(/\/$/, '') || '/'
    if (host !== 'ryan-realty.com') return host
    if (path === '/reviews') return 'our reviews'
    if (path === '/about') return 'who we are'
    if (path === '/sell') return 'how we sell homes'
    if (path === '/cma' || path.startsWith('/cma/')) return 'the full report'
    const last = path.split('/').filter(Boolean).pop() ?? ''
    if (!last) return 'our site'
    return last.replace(/-/g, ' ')
  } catch {
    return 'this link'
  }
}

export function paragraphsToPlain(paragraphs: FirstContactRun[][]): string {
  return paragraphs
    .map((p) => p.map((r) => (typeof r === 'string' ? r : r.text)).join(''))
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

export function paragraphsToMarkers(paragraphs: FirstContactRun[][]): string {
  return paragraphs
    .map((p) =>
      p
        .map((r) => (typeof r === 'string' ? r : `[${r.text}](${r.href})`))
        .join(''),
    )
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

/** A broker edit, or a stored override from before links were words. */
export function parseLetterParagraph(text: string): FirstContactRun[] {
  const runs: FirstContactRun[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0
    if (idx > last) runs.push(text.slice(last, idx))
    if (m[1] != null && m[2] != null) {
      runs.push({ text: m[1], href: cleanFirstPartyHref(m[2]) })
    } else {
      const { url, trailing } = peelTrailingUrlPunctuation(m[0])
      runs.push({ text: labelForBareUrl(url), href: cleanFirstPartyHref(url) })
      if (trailing) runs.push(trailing)
    }
    last = idx + m[0].length
  }
  if (last < text.length) runs.push(text.slice(last))
  return runs.length ? runs : [text]
}

export function paragraphsForLetterBody(args: {
  bodyText: string
  canonicalPlain: string
  canonicalMarkers: string
  paragraphs: FirstContactRun[][]
}): FirstContactRun[][] {
  const raw = args.bodyText.replace(/\r\n/g, '\n').trim()
  if (!raw) return args.paragraphs
  if (raw === args.canonicalPlain.trim() || raw === args.canonicalMarkers.trim()) return args.paragraphs
  return raw
    .split(/\n{2,}/)
    .map((p) => parseLetterParagraph(p.trim()))
    .filter((p) => paragraphsToPlain([p]).length > 0)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function streetOnly(address: string | null): string | null {
  const s = (address ?? '').trim()
  if (!s) return null
  return s.split(',')[0]?.trim() || s
}

function emphasizeAddress(text: string, address: string | null): string {
  const named = address?.trim() || ''
  const escaped = escapeHtml(text)
  if (!named) return escaped
  const forms = [named, streetOnly(named)].filter((f): f is string => Boolean(f))
  let out = escaped
  for (const form of forms) {
    const needle = escapeHtml(form)
    if (!needle || out.includes(`<strong>${needle}</strong>`)) continue
    out = out.split(needle).join(`<strong>${needle}</strong>`)
  }
  return out
}

function renderRuns(runs: FirstContactRun[], address: string | null, slug: string): string {
  return runs
    .map((run) => {
      if (typeof run === 'string') return emphasizeAddress(run, address).replace(/\n/g, '<br/>')
      const href = escapeHtml(stampCmaEmailCampaign(cleanFirstPartyHref(run.href), slug))
      return `<a href="${href}">${escapeHtml(run.text)}</a>`
    })
    .join('')
}

/** A one-line salutation. Anything longer is letter copy, and the button goes above it. */
function isShortGreeting(paragraphs: FirstContactRun[][]): boolean {
  const first = paragraphs[0]
  if (!first) return false
  const text = paragraphsToPlain([first])
  return text.length > 0 && text.length <= 40 && /^(hi|hello|hey|dear)\b/i.test(text)
}

/**
 * Paragraphs plus the report button. No signature. Clean campaign UTMs only.
 *
 * The button is the first action. A short greeting may sit above it. The same
 * button repeats after the note, so a reader who finishes does not have to
 * scroll back. Both go to the same report.
 */
export function renderCmaLetterBlock(args: {
  paragraphs: FirstContactRun[][]
  address: string | null
  slug: string
}): string {
  const rendered = args.paragraphs.map(
    (p) => `<p style="margin:0 0 16px 0;">${renderRuns(p, args.address, args.slug)}</p>`,
  )
  const button = cmaReportButtonHtml(
    stampCmaEmailCampaign(`${CMA_EMAIL_ORIGIN}/cma/${args.slug}`, args.slug),
  )
  const greetingFirst = isShortGreeting(args.paragraphs)
  const head = greetingFirst ? (rendered[0] ?? '') : ''
  const rest = (greetingFirst ? rendered.slice(1) : rendered).join('')
  const closingButton = rest ? button : ''
  return `<div data-cma-letter>${head}${button}${rest}${closingButton}</div>`
}
