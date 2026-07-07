/**
 * renderMarketReportEmail — the per-contact market-report email (Wave 8).
 *
 * PURE render. The caller fetches the §0-accurate data (getMarketReportData) and
 * passes the blocks in; this module turns them into a brand-clean, email-safe
 * { subject, html, text }. No data access, no send. The send engine (Phase B)
 * fetches the data, calls this, then routes through the suppression-gated send
 * path (isSuppressed -> prepareDeliverableEmail -> attributeOutbound -> sendEmail).
 *
 * The frame is the ONE branded shell (lib/email/shell.ts): navy masthead
 * ("MARKET REPORT · <AREA>") → brand hero → editorial stat blocks (big serif
 * numbers, hard hairline rules, tabular figures, one-decimal signed YoY) →
 * optional broker close card → CAN-SPAM footer.
 *
 * Brand voice (CLAUDE.md §3): sentence case, currency rounded to the nearest
 * thousand, "38 days", signed-arrow YoY ("↑ 2.1% YoY"), tabular numerals, no
 * em-dash, no semicolon, no banned words. Every number shown here came from the
 * cache via the data block; this module only formats it. It never invents a
 * figure.
 */

import {
  EMAIL_NAVY,
  EMAIL_CREAM,
  EMAIL_INK,
  EMAIL_BODY_MUTED,
  EMAIL_BORDER,
  EMAIL_SERIF,
} from '@/lib/email/brand'
import { wrapBrandedEmail, type ShellBroker } from '@/lib/email/shell'
import { formatDate } from '@/lib/format/date'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import type { MoSVerdict } from '@/lib/data/types/market'

const MUTED = EMAIL_BODY_MUTED
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
  /** The subscription's assigned broker — renders the close card when set. */
  senderBroker?: ShellBroker | null
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

/** One-decimal signed-arrow YoY: "↑ 2.1% YoY" / "↓ 1.4% YoY" / flat. Em-dash when null. */
export function formatYoy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return 'flat YoY'
  const arrow = rounded > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(rounded).toFixed(1)}% YoY`
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

/** Build the subject line. One area names it; several use a regional framing. */
export function buildSubject(areas: MarketReportAreaBlock[]): string {
  if (areas.length === 1) {
    return `${areas[0].areaLabel} market update`
  }
  return `Your Central Oregon market update`
}

/** Whole number with comma separators. Em-dash when unavailable. */
function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}

/**
 * One area's editorial stat block: uppercase verdict kicker, serif area name,
 * a big serif median-price moment with the signed YoY, then hairline-ruled
 * stat rows and a navy CTA.
 */
function areaBlockHtml(area: MarketReportAreaBlock): string {
  const verdict = verdictLabel(area.marketVerdict)
  const hasVerdict = area.marketVerdict != null
  const href = `${SITE_URL}${area.href}`

  const kicker = hasVerdict
    ? `<div style="font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};margin-bottom:8px;font-variant-numeric:tabular-nums;">${escapeHtml(verdict)} &middot; ${formatMonths(area.monthsOfSupply)} of supply</div>`
    : ''

  const row = (label: string, value: string): string =>
    `<tr>
      <td style="padding:10px 0;font-size:14px;color:${MUTED};border-top:1px solid ${EMAIL_BORDER};">${escapeHtml(label)}</td>
      <td style="padding:10px 0;font-size:14px;color:${EMAIL_INK};text-align:right;font-weight:600;font-variant-numeric:tabular-nums;border-top:1px solid ${EMAIL_BORDER};">${value}</td>
    </tr>`

  return `<tr><td style="padding:30px 34px 0;">
    ${kicker}
    <div style="font-family:${EMAIL_SERIF};font-size:26px;line-height:1.2;color:${EMAIL_NAVY};margin-bottom:16px;">${escapeHtml(area.areaLabel)}</div>
    <div style="font-family:${EMAIL_SERIF};font-size:42px;line-height:1.05;color:${EMAIL_NAVY};font-variant-numeric:tabular-nums;">${formatCurrencyRounded(area.medianPrice)}</div>
    <div style="font-size:13px;color:${MUTED};margin:6px 0 18px;font-variant-numeric:tabular-nums;">Median sale price &middot; ${formatYoy(area.yoyPct)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-variant-numeric:tabular-nums;">
      ${row('Active listings', formatCount(area.activeListings))}
      ${row('Median days on market', formatDays(area.domMedian))}
      ${row('Homes sold, last 12 months', formatCount(area.soldLast12mo))}
    </table>
    <div style="margin-top:20px;padding-bottom:6px;">
      <a href="${href}" style="display:inline-block;background:${EMAIL_NAVY};color:${EMAIL_CREAM};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:12px 26px;">SEE THE FULL ${escapeHtml(area.areaLabel.toUpperCase())} REPORT &rarr;</a>
    </div>
  </td></tr>`
}

/** One area's plain-text block. */
function areaBlockText(area: MarketReportAreaBlock): string {
  const lines: string[] = []
  lines.push(area.areaLabel)
  if (area.marketVerdict != null) {
    lines.push(`${verdictLabel(area.marketVerdict)} - ${formatMonths(area.monthsOfSupply)} of supply`)
  }
  lines.push(`Median sale price: ${formatCurrencyRounded(area.medianPrice)}`)
  lines.push(`Price change: ${formatYoy(area.yoyPct)}`)
  lines.push(`Active listings: ${area.activeListings != null ? formatCount(area.activeListings) : '-'}`)
  lines.push(`Median days on market: ${formatDays(area.domMedian)}`)
  lines.push(`Homes sold, last 12 months: ${area.soldLast12mo != null ? formatCount(area.soldLast12mo) : '-'}`)
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
  const mastheadArea = areas.length === 1 ? areas[0].areaLabel : 'Central Oregon'

  // Raw for the preheader (the shell escapes it), escaped inline for the body.
  const introRaw =
    areas.length === 1
      ? `Here is where the ${areas[0].areaLabel} market stands as of ${asOf}.`
      : `Here is where your Central Oregon markets stand as of ${asOf}.`
  const introLine = escapeHtml(introRaw)

  const headerHtml = `<tr><td style="padding:30px 34px 0;">
    <p style="margin:0 0 10px;font-size:16px;color:${EMAIL_INK};">${greeting}</p>
    <p style="margin:0;font-size:16px;line-height:1.6;color:${EMAIL_INK};">${introLine}</p>
  </td></tr>`

  const blocksHtml = areas.map(areaBlockHtml).join('')

  const methodologyHtml = `<tr><td style="padding:28px 34px 6px;">
    <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};border-top:1px solid ${EMAIL_BORDER};padding-top:16px;">Every figure here comes from closed and active Central Oregon MLS data for single-family homes, refreshed daily. Reply to this email if you want a pricing read on a specific home.</p>
  </td></tr>`

  const html = wrapBrandedEmail({
    bodyHtml: headerHtml + blocksHtml + methodologyHtml,
    previewText: introRaw,
    mastheadLine: `MARKET REPORT · ${mastheadArea}`,
    senderBroker: input.senderBroker ?? null,
    unsubscribeUrl: input.unsubscribeUrl,
    audienceLine: 'You are receiving this market update because you subscribed to Ryan Realty reports.',
  })

  const textParts: string[] = []
  textParts.push(fn ? `Hi ${fn},` : 'Hi,')
  textParts.push('')
  textParts.push(introRaw)
  textParts.push('')
  for (const area of areas) {
    textParts.push(areaBlockText(area))
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
