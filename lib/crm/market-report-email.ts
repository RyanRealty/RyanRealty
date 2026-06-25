/**
 * renderMarketReportEmail — the per-contact market-report email (Wave 8).
 *
 * PURE render. The caller fetches the §0-accurate data (getMarketReportData) and
 * passes the blocks in; this module turns them into a brand-clean, email-safe
 * { subject, html, text }. No data access, no send. The send engine (Phase B)
 * fetches the data, calls this, then routes through the suppression-gated send
 * path (isSuppressed -> prepareDeliverableEmail -> attributeOutbound -> sendEmail).
 *
 * Brand voice (CLAUDE.md §3): sentence case, currency rounded to the nearest
 * thousand, "38 days", signed-arrow YoY, tabular numerals, no em-dash, no
 * semicolon, no banned words. Every number shown here came from the cache via
 * the data block; this module only formats it. It never invents a figure.
 *
 * Email-safe styling: inline hex from the locked two-color v2 palette (navy
 * #102742 on cream #faf8f4) via lib/email/brand. Email clients do not load web
 * fonts, so the font stack leads with Geist then the OS UI font (no retired
 * font names). Layout is table-based for Outlook/Gmail.
 */

import { EMAIL_FONT_STACK, EMAIL_NAVY, EMAIL_CREAM, EMAIL_BORDER } from '@/lib/email/brand'
import { formatDate } from '@/lib/format/date'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import type { MoSVerdict } from '@/lib/data/types/market'

const CHARCOAL = '#1a1a1a'
const MUTED = '#667085'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export interface RenderMarketReportEmailInput {
  /** Recipient first name (or full name); blank/absent uses a neutral greeting. */
  contactName?: string | null
  /** brokers.slug for attribution (used by the send engine, not the render). */
  brokerSlug?: string | null
  /** The verified market blocks, already fetched + filtered by getMarketReportData. */
  areas: MarketReportAreaBlock[]
  /** One-click unsubscribe URL embedded in the footer. */
  unsubscribeUrl: string
}

export interface RenderedMarketReportEmail {
  subject: string
  html: string
  text: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** First token of a name, trimmed. Empty when no usable name. */
function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return ''
  return n.split(/\s+/)[0] ?? ''
}

/**
 * Round to the nearest thousand and format as $XXX,000. Pure. Returns the
 * em-dash data placeholder (allowed for "unavailable") when the value is null.
 */
export function formatCurrencyRounded(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value / 1000) * 1000
  return '$' + rounded.toLocaleString('en-US')
}

/** Integer + " days" (e.g. "38 days"). Em-dash placeholder when unavailable. */
export function formatDays(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)} days`
}

/** Signed-arrow YoY: "up 2.1% YoY" / "down 1.4% YoY" / flat. Em-dash when null. */
export function formatYoy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return 'flat YoY'
  const arrow = rounded > 0 ? '↑' : '↓'
  const word = rounded > 0 ? 'up' : 'down'
  return `${arrow} ${word} ${Math.abs(rounded).toFixed(1)}% YoY`
}

/** Months of supply with one decimal + " months". Em-dash when null. */
export function formatMonths(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)} months`
}

/** Plain-language verdict phrase (sentence case, no hype). */
export function verdictLabel(verdict: MoSVerdict | null | undefined): string {
  switch (verdict) {
    case 'sellers':
      return "Seller's market"
    case 'balanced':
      return 'Balanced market'
    case 'buyers':
      return "Buyer's market"
    default:
      return '—'
  }
}

/** Verdict pill background color from the design-system palette intent. */
function verdictColor(verdict: MoSVerdict | null | undefined): string {
  // Navy for the decisive ends, muted for balanced. Two-color palette only.
  return verdict === 'balanced' ? MUTED : EMAIL_NAVY
}

/** Build the subject line. One area names it; several use a regional framing. */
export function buildSubject(areas: MarketReportAreaBlock[]): string {
  if (areas.length === 1) {
    return `${areas[0].areaLabel} market update`
  }
  return `Your Central Oregon market update`
}

/** One area's HTML card. */
function areaCardHtml(area: MarketReportAreaBlock): string {
  const verdict = verdictLabel(area.marketVerdict)
  const hasVerdict = area.marketVerdict != null
  const href = `${SITE_URL}${area.href}`

  const row = (label: string, value: string): string =>
    `<tr>
      <td style="padding:6px 0;font-size:14px;color:${MUTED};">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:14px;color:${CHARCOAL};text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">${value}</td>
    </tr>`

  const verdictPill = hasVerdict
    ? `<span style="display:inline-block;background:${verdictColor(area.marketVerdict)};color:${EMAIL_CREAM};font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;">${escapeHtml(verdict)} &middot; ${formatMonths(area.monthsOfSupply)} of supply</span>`
    : ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#ffffff;border:1px solid ${EMAIL_BORDER};border-radius:14px;">
    <tr><td style="padding:20px 24px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:${EMAIL_NAVY};">${escapeHtml(area.areaLabel)}</p>
      ${verdictPill ? `<p style="margin:0 0 12px;">${verdictPill}</p>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Median sale price', formatCurrencyRounded(area.medianPrice))}
        ${row('Price change', formatYoy(area.yoyPct))}
        ${row('Active listings', area.activeListings != null ? String(area.activeListings) : '—')}
        ${row('Median days on market', formatDays(area.domMedian))}
        ${row('Homes sold, last 12 months', area.soldLast12mo != null ? String(area.soldLast12mo) : '—')}
      </table>
      <p style="margin:14px 0 0;">
        <a href="${href}" style="display:inline-block;background:${EMAIL_NAVY};color:${EMAIL_CREAM};font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:10px;">See the full ${escapeHtml(area.areaLabel)} report</a>
      </p>
    </td></tr>
  </table>`
}

/** One area's plain-text block. */
function areaCardText(area: MarketReportAreaBlock): string {
  const lines: string[] = []
  lines.push(area.areaLabel)
  if (area.marketVerdict != null) {
    lines.push(`${verdictLabel(area.marketVerdict)} - ${formatMonths(area.monthsOfSupply)} of supply`)
  }
  lines.push(`Median sale price: ${formatCurrencyRounded(area.medianPrice)}`)
  lines.push(`Price change: ${formatYoy(area.yoyPct)}`)
  lines.push(`Active listings: ${area.activeListings != null ? String(area.activeListings) : '-'}`)
  lines.push(`Median days on market: ${formatDays(area.domMedian)}`)
  lines.push(`Homes sold, last 12 months: ${area.soldLast12mo != null ? String(area.soldLast12mo) : '-'}`)
  lines.push(`Full report: ${SITE_URL}${area.href}`)
  return lines.join('\n')
}

/**
 * Render the market-report email. Pure given the data blocks. The caller must
 * pass a non-empty `areas` (getMarketReportData already filtered out unavailable
 * areas); if `areas` is empty the send engine should skip the contact rather
 * than send an empty email, so this returns a safe minimal body.
 */
export function renderMarketReportEmail(
  input: RenderMarketReportEmailInput,
): RenderedMarketReportEmail {
  const fn = firstName(input.contactName)
  const greeting = fn ? `Hi ${escapeHtml(fn)},` : 'Hi,'
  const areas = Array.isArray(input.areas) ? input.areas : []
  const subject = buildSubject(areas)
  const asOf = formatDate(areas[0]?.refreshedAt ?? new Date())

  const introLine =
    areas.length === 1
      ? `Here is where the ${escapeHtml(areas[0].areaLabel)} market stands as of ${escapeHtml(asOf)}.`
      : `Here is where your Central Oregon markets stand as of ${escapeHtml(asOf)}.`

  const cardsHtml = areas.map(areaCardHtml).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${EMAIL_CREAM};font-family:${EMAIL_FONT_STACK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_CREAM};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:${EMAIL_NAVY};padding:20px 24px;border-radius:14px 14px 0 0;">
        <span style="color:${EMAIL_CREAM};font-size:18px;font-weight:700;letter-spacing:0.04em;">RYAN REALTY</span>
      </td></tr>
      <tr><td style="background:#ffffff;padding:24px;border-left:1px solid ${EMAIL_BORDER};border-right:1px solid ${EMAIL_BORDER};">
        <p style="margin:0 0 12px;font-size:16px;color:${CHARCOAL};">${greeting}</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${CHARCOAL};">${introLine}</p>
        ${cardsHtml}
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">Every figure here comes from closed and active Central Oregon MLS data for single-family homes, refreshed daily. Reply to this email if you want a pricing read on a specific home.</p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:18px 24px 24px;border:1px solid ${EMAIL_BORDER};border-top:none;border-radius:0 0 14px 14px;color:${MUTED};font-size:12px;line-height:1.6;">
        Ryan Realty &middot; Bend, Oregon &middot; <a href="${SITE_URL}" style="color:${MUTED};">ryan-realty.com</a><br>
        You are receiving this market update because you subscribed to Ryan Realty reports.
        <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const textParts: string[] = []
  textParts.push(fn ? `Hi ${fn},` : 'Hi,')
  textParts.push('')
  textParts.push(
    areas.length === 1
      ? `Here is where the ${areas[0].areaLabel} market stands as of ${asOf}.`
      : `Here is where your Central Oregon markets stand as of ${asOf}.`,
  )
  textParts.push('')
  for (const area of areas) {
    textParts.push(areaCardText(area))
    textParts.push('')
  }
  textParts.push(
    'Every figure here comes from closed and active Central Oregon MLS data for single-family homes, refreshed daily. Reply to this email if you want a pricing read on a specific home.',
  )
  textParts.push('')
  textParts.push('--')
  textParts.push('Ryan Realty - Bend, Oregon - ryan-realty.com')
  textParts.push(`Unsubscribe: ${input.unsubscribeUrl}`)

  return { subject, html, text: textParts.join('\n') }
}
