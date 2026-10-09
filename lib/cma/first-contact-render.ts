/**
 * The one renderer for a CMA first-contact letter.
 *
 * The composer stores words and clean hrefs. This module turns either that
 * structure, or a broker's edited plain text, into the HTML and the
 * plain-text alternative. buildLeadBody (default and override) and the
 * Review preview both call it. It stamps source=cma, medium=email,
 * campaign=cma-letter and rr_doc=<slug>. agent, _pid and utm_content
 * are added later by decorateOutboundText, once, on the href.
 */

import { cmaAnalysisCardHtml, cmaListPricePlate, cmaReportButtonHtml } from '@/lib/cma/report-button'
import { peelTrailingUrlPunctuation } from '@/lib/analytics/own-site-links'
import { buildTrackedUrl, CMA_DOC_PARAM } from '@/lib/analytics/utm'

export const CMA_EMAIL_ORIGIN = 'https://ryan-realty.com'

/**
 * A link is words plus a clean href. A button run is not a sentence: the
 * renderer consumes it and stamps the one report button there. Plain text
 * reads the button's label, with no URL. An unlabeled button reads
 * "Read the full report".
 */
export type FirstContactRun = string | { text: string; href: string } | { button: true; label?: string }

export const FIRST_CONTACT_REPORT_BUTTON: FirstContactRun = { button: true }

/** Expired letters. The words sit under the photos of the home. */
export const EXPIRED_ANALYSIS_BUTTON: FirstContactRun = { button: true, label: 'See the full market analysis' }

function isReportButton(run: FirstContactRun): run is { button: true; label?: string } {
  return typeof run !== 'string' && 'button' in run && run.button === true
}

function buttonPlain(run: { button: true; label?: string }): string {
  const label = run.label?.trim()
  return label || 'Read the full report'
}

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

/** source=cma, medium=email, campaign=cma-letter, rr_doc=<slug>. Other keys are the decorator's. */
export function stampCmaEmailCampaign(href: string, slug: string | null | undefined, opts?: { test?: boolean }): string {
  const doc = (slug ?? '').trim().toLowerCase()
  if (!doc) return href
  try {
    const u = new URL(href)
    if (u.hostname.replace(/^www\./, '') !== 'ryan-realty.com') return href
  } catch {
    return href
  }
  return buildTrackedUrl(href, {
    source: 'cma',
    medium: 'email',
    campaign: 'cma-letter',
    extraParams: { [CMA_DOC_PARAM]: doc },
    test: opts?.test,
  })
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

function runPlain(run: FirstContactRun): string {
  if (typeof run === 'string') return run
  if (isReportButton(run)) return buttonPlain(run)
  return run.text
}

export function paragraphsToPlain(paragraphs: FirstContactRun[][]): string {
  return paragraphs
    .map((p) => p.map(runPlain).join(''))
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function runMarker(run: FirstContactRun): string {
  if (typeof run === 'string') return run
  if (isReportButton(run)) return buttonPlain(run)
  return `[${run.text}](${run.href})`
}

export function paragraphsToMarkers(paragraphs: FirstContactRun[][]): string {
  return paragraphs
    .map((p) => p.map(runMarker).join(''))
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
      if (isReportButton(run)) return ''
      const href = escapeHtml(stampCmaEmailCampaign(cleanFirstPartyHref(run.href), slug))
      return `<a href="${href}">${escapeHtml(run.text)}</a>`
    })
    .join('')
}

function isReportButtonParagraph(paragraph: FirstContactRun[]): boolean {
  return paragraph.length === 1 && paragraph[0] != null && isReportButton(paragraph[0])
}

/** A one-line salutation. The report sentence, not the button, comes next. */
function isShortGreeting(paragraphs: FirstContactRun[][]): boolean {
  const first = paragraphs[0]
  if (!first) return false
  const text = paragraphsToPlain([first])
  return text.length > 0 && text.length <= 40 && /^(hi|hello|hey|dear)\b/i.test(text)
}

function paragraphText(paragraphs: FirstContactRun[][], index: number): string {
  const paragraph = paragraphs[index]
  if (!paragraph) return ''
  return paragraphsToPlain([paragraph])
}

/** "We would list it at $640,000." becomes the price plate. The plain text keeps the sentence. */
function listPriceAmount(text: string): string | null {
  const match = text.trim().match(/^We would list it at (\$[\d,]+)\.$/)
  return match?.[1] ?? null
}

function mentionsReport(text: string): boolean {
  return /full report|attached as a PDF/i.test(text)
}

function namesOurPrice(paragraphs: FirstContactRun[][]): boolean {
  return paragraphs.some((paragraph) => /our price/i.test(paragraphsToPlain([paragraph])))
}

function reportLead(address: string | null): string {
  const named = streetOnly(address)
  if (named) return `The full report on ${named} is attached as a PDF.`
  return 'The full report is attached as a PDF.'
}

function buttonLabel(paragraphs: FirstContactRun[][]): string {
  for (const paragraph of paragraphs) {
    if (!isReportButtonParagraph(paragraph)) continue
    const run = paragraph[0]
    if (run && isReportButton(run)) return buttonPlain(run)
  }
  if (namesOurPrice(paragraphs)) return 'See our price'
  return 'Read the full report'
}

function cardPhotos(photos: string[] | null | undefined): string[] {
  const out: string[] = []
  for (const raw of photos ?? []) {
    const url = raw.trim()
    if (!url.startsWith('https://')) continue
    if (out.includes(url)) continue
    out.push(url)
    if (out.length === 3) break
  }
  return out
}

/**
 * Paragraphs plus the report button. No signature. Clean campaign UTMs only.
 *
 * A composed letter can mark the button with a button-only paragraph. That
 * paragraph is not printed again. The button sits there, once.
 * A broker note that says "our price" makes the button "See our price".
 * An expired letter labels its button "See the full market analysis" and,
 * when the home has photos, draws them in that button. Any other composed
 * letter reads "Read the full report". A broker who typed "We would list it
 * at $X." still gets the plate. A note that never names the report gets one
 * lead sentence, then the button, and the button again after the note.
 */
export function renderCmaLetterBlock(args: {
  paragraphs: FirstContactRun[][]
  address: string | null
  slug: string
  /** Subject photos. Drawn in the button unless the label is "See our price". */
  photos?: string[] | null
}): string {
  const label = buttonLabel(args.paragraphs)
  const viewUrl = stampCmaEmailCampaign(`${CMA_EMAIL_ORIGIN}/cma/${args.slug}`, args.slug)
  const photos = label === 'See our price' ? [] : cardPhotos(args.photos)
  const button = photos.length > 0
    ? cmaAnalysisCardHtml(viewUrl, photos, streetOnly(args.address) ?? 'The home', label)
    : cmaReportButtonHtml(viewUrl, label)
  const parts: string[] = []
  let buttonAt: number | null = null
  for (let i = 0; i < args.paragraphs.length; i++) {
    const paragraph = args.paragraphs[i]
    if (!paragraph) continue
    if (isReportButtonParagraph(paragraph)) {
      if (buttonAt == null) buttonAt = parts.length
      continue
    }
    const text = paragraphText(args.paragraphs, i)
    const amount = listPriceAmount(text)
    if (buttonAt == null && mentionsReport(text)) buttonAt = parts.length + 1
    if (amount) {
      parts.push(cmaListPricePlate(amount))
      continue
    }
    parts.push(`<p style="margin:0 0 16px 0;">${renderRuns(paragraph, args.address, args.slug)}</p>`)
  }
  if (buttonAt == null) {
    const greetingFirst = isShortGreeting(args.paragraphs)
    const lead = `<p style="margin:0 0 16px 0;">${escapeHtml(reportLead(args.address))}</p>`
    const head = greetingFirst ? (parts[0] ?? '') : ''
    const rest = (greetingFirst ? parts.slice(1) : parts).join('')
    const closing = rest ? button : ''
    return `<div data-cma-letter>${head}${lead}${button}${rest}${closing}</div>`
  }
  const before = parts.slice(0, buttonAt).join('')
  const after = parts.slice(buttonAt).join('')
  return `<div data-cma-letter>${before}${button}${after}</div>`
}
