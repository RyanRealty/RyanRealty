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
 * The frame is the ONE branded shell (lib/email/shell.ts): navy masthead
 * ("NEW LISTINGS · <search name>") → editorial listing cards (serif display
 * prices, hard hairline rules, tabular figures, navy CTA) → optional broker
 * close card → CAN-SPAM footer with the audience line + manage + unsubscribe.
 *
 * Brand voice (CLAUDE.md §3): sentence case, every number carries units, no
 * em-dash, no semicolon, no exclamation mark, no banned words in visible copy.
 * List prices render exactly as listed ($749,900 style with commas) per §0 —
 * a listing's price is a fact, not a stat to round.
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
import { BRAND } from '@/lib/brand/contact'

const MUTED = EMAIL_BODY_MUTED

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
  /** The subscription's assigned broker — renders the close card when set. */
  senderBroker?: ShellBroker | null
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

/**
 * One listing's editorial card: full-width photo, status kicker, serif display
 * price, address, meta line, closed by a hard hairline rule.
 */
function listingCardHtml(listing: ListingAlertListing): string {
  const address = escapeHtml(listing.address.trim() || 'New listing')
  const cityLine = (listing.city ?? '').trim()
  const fullAddress = cityLine ? `${address}, ${escapeHtml(cityLine)}` : address
  const price = formatListingPrice(listing.price)
  const meta = formatListingMeta(listing)
  const status = (listing.status ?? '').trim()
  const href = escapeHtml(listing.detailUrl)

  const photo = listing.photoUrl?.trim()
    ? `<a href="${href}"><img src="${escapeHtml(listing.photoUrl.trim())}" alt="${fullAddress}" width="572" style="display:block;width:100%;height:auto;"></a>`
    : ''

  return `<tr><td style="padding:26px 34px 0;">
    ${photo}
    <div style="padding:16px 0 22px;border-bottom:1px solid ${EMAIL_BORDER};">
      ${status ? `<div style="font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};margin-bottom:8px;">${escapeHtml(status)}</div>` : ''}
      <div style="font-family:${EMAIL_SERIF};font-size:28px;line-height:1.15;color:${EMAIL_NAVY};font-variant-numeric:tabular-nums;margin-bottom:6px;">${price}</div>
      <div style="font-size:16px;font-weight:700;line-height:1.4;margin-bottom:4px;">
        <a href="${href}" style="color:${EMAIL_INK};text-decoration:none;">${fullAddress}</a>
      </div>
      ${meta ? `<div style="font-size:14px;color:${MUTED};font-variant-numeric:tabular-nums;">${meta}</div>` : ''}
    </div>
  </td></tr>`
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

  const headerHtml = `<tr><td style="padding:32px 34px 0;">
    <div style="font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};margin-bottom:10px;">${escapeHtml(searchName)}</div>
    <div style="font-family:${EMAIL_SERIF};font-size:26px;line-height:1.2;color:${EMAIL_NAVY};font-variant-numeric:tabular-nums;">${escapeHtml(countLine)}</div>
    ${filtersSummary ? `<div style="font-size:13px;color:${MUTED};margin-top:8px;">${escapeHtml(filtersSummary)}</div>` : ''}
    ${intro ? `<div style="font-size:16px;line-height:1.6;color:${EMAIL_INK};margin-top:14px;">${escapeHtml(intro)}</div>` : ''}
  </td></tr>`

  const cardsHtml = shown.map(listingCardHtml).join('')

  const moreHtml = moreCount > 0
    ? `<tr><td style="padding:20px 34px 0;font-size:15px;font-variant-numeric:tabular-nums;">
        <a href="${browseHref}" style="color:${EMAIL_NAVY};font-weight:700;text-decoration:underline;">+${moreCount} more new ${moreCount === 1 ? 'listing' : 'listings'} on the site</a>
      </td></tr>`
    : ''

  const ctaHtml = `<tr><td align="center" style="padding:28px 34px 8px;">
    <a href="${browseHref}" style="display:inline-block;background:${EMAIL_NAVY};color:${EMAIL_CREAM};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:14px 32px;">SEE ALL MATCHING HOMES &rarr;</a>
  </td></tr>`

  const html = wrapBrandedEmail({
    bodyHtml: headerHtml + cardsHtml + moreHtml + ctaHtml,
    previewText: countLine,
    mastheadLine: `NEW LISTINGS · ${searchName}`,
    heroUrl: null, // the listing photos are the visual — no brand hero
    senderBroker: input.senderBroker ?? null,
    unsubscribeUrl: input.unsubscribeUrl,
    manageUrl: input.manageUrl?.trim() || null,
    audienceLine: "You're receiving this because you asked for listing alerts at ryan-realty.com.",
  })

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
