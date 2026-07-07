/**
 * buildListingAlertEmail — the branded saved-search / guest listing-alert email.
 *
 * PURE render, mirroring lib/crm/market-report-email.ts: the caller (the alert
 * cron in app/actions/saved-search-alerts.ts) diffs the new listings, resolves
 * the recipient's CRM person + broker, and passes plain data in. This module
 * turns it into a brand-clean, email-safe { subject, html, text }. No data
 * access, no send, no tracking — attribution + open/click instrumentation is
 * applied by the caller via attributeOutbound AFTER this HTML is built.
 *
 * Brand voice (CLAUDE.md §3): sentence case, every number carries units, no
 * em-dash, no semicolon, no exclamation mark, no banned words in visible copy.
 * List prices render exactly as listed ($749,900 style with commas) per §0 —
 * a listing's price is a fact, not a stat to round.
 *
 * Email-safe styling: inline hex from the locked two-color v2 palette (navy
 * #102742 on cream #faf8f4) via lib/email/brand. Table-based layout for
 * Outlook/Gmail. No web fonts (clients do not load them).
 */

import { EMAIL_FONT_STACK, EMAIL_NAVY, EMAIL_CREAM, EMAIL_BORDER } from '@/lib/email/brand'
import { BRAND } from '@/lib/brand/contact'

const CHARCOAL = '#1a1a1a'
const MUTED = '#667085'

export interface ListingAlertListing {
  /** Street address line, e.g. "61542 Hosmer Lake Dr". */
  address: string
  city?: string | null
  /** Exact list price in dollars. Null renders "Price on request". */
  price: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  photoUrl?: string | null
  /** Absolute listing detail URL (plain — the caller attributes + wraps it). */
  detailUrl: string
  status?: string | null
}

export interface BuildListingAlertEmailInput {
  /** The saved search's display name, e.g. "Bend under 800k". */
  searchName: string
  /** Human summary of the filters, e.g. "3+ Beds, Max $800,000, Bend". */
  filtersSummary?: string | null
  /** The new listings to show (already capped by the caller). */
  listings: ListingAlertListing[]
  /**
   * Total NEW matches in this diff. When it exceeds listings.length the email
   * carries a "+N more" link to browseAllUrl. Defaults to listings.length.
   */
  totalNewCount?: number
  /** Absolute URL to the full results page for this search. */
  browseAllUrl: string
  /** Absolute unsubscribe URL (left untracked by attributeOutbound). */
  unsubscribeUrl: string
  /** Absolute URL of the recipient's alert-management page (optional). */
  manageUrl?: string | null
  /** Optional intro sentence above the cards. */
  intro?: string | null
}

export interface BuiltListingAlertEmail {
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

/** Exact list price with $ and commas. Null renders "Price on request". */
export function formatListingPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Price on request'
  return '$' + Math.round(value).toLocaleString('en-US')
}

/** "3 beds · 2.5 baths · 1,850 sqft" — every number carries its unit. */
export function formatListingMeta(listing: ListingAlertListing): string {
  const parts: string[] = []
  if (listing.beds != null && Number.isFinite(listing.beds) && listing.beds > 0) {
    parts.push(`${listing.beds} ${listing.beds === 1 ? 'bed' : 'beds'}`)
  }
  if (listing.baths != null && Number.isFinite(listing.baths) && listing.baths > 0) {
    parts.push(`${listing.baths} ${listing.baths === 1 ? 'bath' : 'baths'}`)
  }
  if (listing.sqft != null && Number.isFinite(listing.sqft) && listing.sqft > 0) {
    parts.push(`${Math.round(listing.sqft).toLocaleString('en-US')} sqft`)
  }
  return parts.join(' · ')
}

/** Specific, no-hype subject: "6 new listings for Bend under 800k". */
export function buildListingAlertSubject(count: number, searchName: string): string {
  const safeCount = Math.max(1, Math.trunc(count))
  const noun = safeCount === 1 ? 'listing' : 'listings'
  return `${safeCount} new ${noun} for ${searchName.trim()}`
}

/** One listing's HTML card. */
function listingCardHtml(listing: ListingAlertListing): string {
  const address = escapeHtml(listing.address.trim() || 'New listing')
  const cityLine = (listing.city ?? '').trim()
  const fullAddress = cityLine ? `${address}, ${escapeHtml(cityLine)}` : address
  const price = formatListingPrice(listing.price)
  const meta = formatListingMeta(listing)
  const status = (listing.status ?? '').trim()
  const href = escapeHtml(listing.detailUrl)

  const photo = listing.photoUrl?.trim()
    ? `<tr><td><a href="${href}"><img src="${escapeHtml(listing.photoUrl.trim())}" alt="${fullAddress}" width="552" style="display:block;width:100%;height:auto;border-radius:12px 12px 0 0;" /></a></td></tr>`
    : ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#ffffff;border:1px solid ${EMAIL_BORDER};border-radius:14px;">
    ${photo}
    <tr><td style="padding:16px 20px;">
      ${status ? `<p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(status)}</p>` : ''}
      <p style="margin:0 0 4px;font-size:16px;font-weight:700;">
        <a href="${href}" style="color:${EMAIL_NAVY};text-decoration:none;">${fullAddress}</a>
      </p>
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:${CHARCOAL};font-variant-numeric:tabular-nums;">${price}</p>
      ${meta ? `<p style="margin:0;font-size:14px;color:${MUTED};font-variant-numeric:tabular-nums;">${meta}</p>` : ''}
    </td></tr>
  </table>`
}

/** One listing's plain-text block. */
function listingCardText(listing: ListingAlertListing): string {
  const lines: string[] = []
  const cityLine = (listing.city ?? '').trim()
  lines.push(cityLine ? `${listing.address.trim()}, ${cityLine}` : listing.address.trim())
  lines.push(formatListingPrice(listing.price))
  const meta = formatListingMeta(listing)
  if (meta) lines.push(meta)
  lines.push(listing.detailUrl)
  return lines.join('\n')
}

/**
 * Render the listing-alert email. Pure given the inputs. The caller routes the
 * returned html through attributeOutbound (broker attribution + open/click
 * tracking) before sendEmail — never send this raw.
 */
export function buildListingAlertEmail(input: BuildListingAlertEmailInput): BuiltListingAlertEmail {
  const searchName = input.searchName.trim() || 'your saved search'
  const shown = Array.isArray(input.listings) ? input.listings : []
  const total = Math.max(shown.length, Math.trunc(input.totalNewCount ?? shown.length))
  const moreCount = Math.max(0, total - shown.length)

  const subject = buildListingAlertSubject(total, searchName)
  const countLine = `${total} new ${total === 1 ? 'listing matches' : 'listings match'} your search`
  const intro = (input.intro ?? '').trim()
  const filtersSummary = (input.filtersSummary ?? '').trim()
  const browseHref = escapeHtml(input.browseAllUrl)

  const cardsHtml = shown.map(listingCardHtml).join('')

  const moreHtml = moreCount > 0
    ? `<p style="margin:0 0 16px;font-size:14px;color:${CHARCOAL};"><a href="${browseHref}" style="color:${EMAIL_NAVY};font-weight:600;">+${moreCount} more new ${moreCount === 1 ? 'listing' : 'listings'} on the site</a></p>`
    : ''

  const manageHtml = input.manageUrl?.trim()
    ? ` <a href="${escapeHtml(input.manageUrl.trim())}" style="color:${MUTED};text-decoration:underline;">Manage your alerts</a>.`
    : ''

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${EMAIL_CREAM};font-family:${EMAIL_FONT_STACK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_CREAM};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:${EMAIL_NAVY};padding:20px 24px;border-radius:14px 14px 0 0;">
        <span style="color:${EMAIL_CREAM};font-size:18px;font-weight:700;letter-spacing:0.04em;">RYAN REALTY</span>
      </td></tr>
      <tr><td style="background:#ffffff;padding:24px;border-left:1px solid ${EMAIL_BORDER};border-right:1px solid ${EMAIL_BORDER};">
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:${EMAIL_NAVY};">${escapeHtml(searchName)}</p>
        <p style="margin:0 0 4px;font-size:15px;color:${CHARCOAL};">${escapeHtml(countLine)}</p>
        ${filtersSummary ? `<p style="margin:0 0 16px;font-size:13px;color:${MUTED};">${escapeHtml(filtersSummary)}</p>` : '<p style="margin:0 0 16px;"></p>'}
        ${intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${CHARCOAL};">${escapeHtml(intro)}</p>` : ''}
        ${cardsHtml}
        ${moreHtml}
        <p style="margin:8px 0 0;">
          <a href="${browseHref}" style="display:inline-block;background:${EMAIL_NAVY};color:${EMAIL_CREAM};font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">See all matching homes</a>
        </p>
      </td></tr>
      <tr><td style="background:#ffffff;padding:18px 24px 24px;border:1px solid ${EMAIL_BORDER};border-top:none;border-radius:0 0 14px 14px;color:${MUTED};font-size:12px;line-height:1.6;">
        Ryan Realty · Bend, Oregon · <a href="${BRAND.url}" style="color:${MUTED};">ryan-realty.com</a><br>
        ${escapeHtml(BRAND.mailingAddress)}<br>
        You are receiving this because you asked for listing alerts at ryan-realty.com.${manageHtml}
        <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const textParts: string[] = []
  textParts.push(searchName)
  textParts.push(countLine)
  if (filtersSummary) textParts.push(filtersSummary)
  textParts.push('')
  for (const listing of shown) {
    textParts.push(listingCardText(listing))
    textParts.push('')
  }
  if (moreCount > 0) {
    textParts.push(`+${moreCount} more new ${moreCount === 1 ? 'listing' : 'listings'}: ${input.browseAllUrl}`)
    textParts.push('')
  }
  textParts.push(`See all matching homes: ${input.browseAllUrl}`)
  if (input.manageUrl?.trim()) textParts.push(`Manage your alerts: ${input.manageUrl.trim()}`)
  textParts.push(`Stop these alerts: ${input.unsubscribeUrl}`)
  textParts.push('')
  textParts.push(`Ryan Realty, ${BRAND.mailingAddress}`)

  return { subject, html, text: textParts.join('\n') }
}
