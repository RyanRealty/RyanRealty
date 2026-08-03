/**
 * DSCR deal-list email — a facade over THE one branded email shell
 * (lib/email/shell.ts), same pattern as newsletter-shell.ts.
 *
 * This email carries investment figures to a real person who may act on them,
 * so CLAUDE.md §0 applies at full force: every number is labelled with where it
 * came from and when it was pulled, the financing assumptions behind the maths
 * are stated in the body rather than implied, and the known-weak inputs are
 * disclosed instead of smoothed over.
 *
 * Two figures that look similar are deliberately both shown. DSCR is the
 * lender's coverage test and ignores operating costs; cash flow is net of
 * vacancy, management, maintenance and reserves. A property can clear DSCR 1.00
 * and still lose money every month, and a recipient who is not told that will
 * misread the list.
 */

import { wrapBrandedEmail, escapeHtml, type ShellBroker } from '@/lib/email/shell'
import { EMAIL_NAVY, EMAIL_BORDER, EMAIL_INK, EMAIL_BODY_MUTED } from '@/lib/email/brand'

export type DscrEmailProperty = {
  address: string
  city: string | null
  beds: number | null
  sqft: number | null
  propertySubType: string | null
  price: number
  rent: number | null
  rentSource: string | null
  pitia: number
  dscr: number | null
  cashFlowMonthly: number | null
  cashOnCashPct: number | null
  maxPriceForDscr: number | null
  priceDelta: number | null
  dealScore: number | null
  listingUrl: string
}

export type DscrEmailArgs = {
  properties: DscrEmailProperty[]
  /** Financing terms the figures were computed under. Stated, never implied. */
  assumptions: { ratePct: number; downPct: number; termYears: number; opexPct: number }
  /** When the rent estimates were pulled. */
  rentAsOf: string
  intro?: string | null
  senderBroker?: ShellBroker | null
  siteUrl?: string
}

const usd = (v: number | null | undefined) =>
  v == null ? '—' : `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`

function rentSourceLabel(source: string | null): string {
  if (source === 'zillow-rentzestimate') return 'Zillow Rent Zestimate'
  if (source === 'hud-fmr') return 'HUD Fair Market Rent (county)'
  return 'estimate unavailable'
}

function card(p: DscrEmailProperty, siteUrl: string): string {
  const url = p.listingUrl.startsWith('http') ? p.listingUrl : `${siteUrl}${p.listingUrl}`
  const cfPositive = (p.cashFlowMonthly ?? 0) > 0
  const specs = [
    p.beds != null ? `${p.beds} bd` : null,
    p.sqft ? `${p.sqft.toLocaleString()} sqft` : null,
    p.propertySubType,
  ]
    .filter(Boolean)
    .join(' · ')

  // Manufactured rent estimates rest on thin comp sets. Say so on the row that
  // carries the number rather than in a footnote nobody reads.
  const caveat =
    p.propertySubType === 'Manufactured On Land'
      ? `<div style="margin-top:8px;font-size:13px;color:${EMAIL_BODY_MUTED};">Rent estimate for manufactured homes rests on a thinner set of rental comparables. Verify before relying on it.</div>`
      : ''

  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:4px 0;font-size:14px;color:${EMAIL_BODY_MUTED};">${label}</td>
      <td style="padding:4px 0;font-size:14px;color:${EMAIL_INK};text-align:right;${strong ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${EMAIL_BORDER};border-radius:10px;margin:0 0 16px;">
    <tr><td style="padding:18px 20px;">
      <div style="font-size:18px;font-weight:700;color:${EMAIL_NAVY};">
        <a href="${escapeHtml(url)}" style="color:${EMAIL_NAVY};text-decoration:none;">${escapeHtml(p.address)}</a>
      </div>
      <div style="margin-top:2px;font-size:14px;color:${EMAIL_BODY_MUTED};">
        ${escapeHtml([p.city, specs].filter(Boolean).join(' · '))}
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        ${row('Asking', usd(p.price))}
        ${row(`Estimated rent`, usd(p.rent))}
        ${row('Payment, taxes, insurance, HOA', usd(p.pitia))}
        ${row('DSCR', p.dscr != null ? p.dscr.toFixed(2) : '—', true)}
        ${row('Monthly cash flow', usd(p.cashFlowMonthly), true)}
        ${row('Cash-on-cash', p.cashOnCashPct != null ? `${p.cashOnCashPct.toFixed(1)}%` : '—')}
        ${row('Price to reach DSCR 1.00', usd(p.maxPriceForDscr))}
      </table>
      <div style="margin-top:10px;font-size:13px;color:${EMAIL_BODY_MUTED};">
        Rent source: ${escapeHtml(rentSourceLabel(p.rentSource))}.
        ${cfPositive ? 'Cash flow is positive after operating costs.' : 'This one does not cover its costs at the asking price.'}
      </div>
      ${caveat}
    </td></tr>
  </table>`
}

export function buildDscrDealListEmail(args: DscrEmailArgs): { html: string; text: string } {
  const siteUrl = (args.siteUrl ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const { ratePct, downPct, termYears, opexPct } = args.assumptions

  const intro = args.intro?.trim()
    ? `<p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${EMAIL_INK};">${escapeHtml(args.intro.trim())}</p>`
    : ''

  const body = `
    <div style="padding:28px 24px;">
      ${intro}
      ${args.properties.map((p) => card(p, siteUrl)).join('')}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${EMAIL_BORDER};margin-top:8px;">
        <tr><td style="padding:18px 0 0;">
          <div style="font-size:14px;font-weight:700;color:${EMAIL_NAVY};">How these numbers were built</div>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_BODY_MUTED};">
            Figures assume ${downPct}% down on a ${termYears}-year fixed investor loan at ${ratePct}%,
            with ${opexPct}% of rent set aside for vacancy, management, maintenance and capital reserves.
            Property taxes use the current reported tax bill. Under Oregon Measure 50 assessed value does
            not reset when a property sells, so that bill carries to a buyer.
          </p>
          <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_BODY_MUTED};">
            DSCR is a lender's coverage test, calculated as rent divided by the total payment. It does not
            subtract operating costs, so a property can clear 1.00 and still lose money each month. The cash
            flow line is the figure net of those costs. Roughly 1.30 is where a property truly breaks even.
          </p>
          <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${EMAIL_BODY_MUTED};">
            Rent figures are estimates pulled ${escapeHtml(args.rentAsOf)}, not signed leases, and the loan
            rate is a market assumption rather than a quote. Confirm rent and financing before you rely on
            any figure here. Listing data comes from the Oregon Datashare MLS and can change without notice.
          </p>
        </td></tr>
      </table>
    </div>`

  const html = wrapBrandedEmail({
    bodyHtml: body,
    previewText: `${args.properties.length} Central Oregon ${args.properties.length === 1 ? 'property' : 'properties'} that pencil at today's rates`,
    mastheadLine: 'INVESTMENT DESK · CENTRAL OREGON',
    senderBroker: args.senderBroker ?? null,
    // Transactional broker-to-client mail, not a list send.
    unsubscribeUrl: null,
    // No audience line. The shell defaults to "you asked for updates from Ryan
    // Realty", which is both false here and the kind of explaining-the-obvious
    // filler §2 bans. Someone who gets a list of houses from their broker knows
    // why they got it. Saying it out loud is pandering, so the line is omitted.
    audienceLine: null,
  })

  const text = [
    args.intro?.trim() ?? '',
    '',
    ...args.properties.map((p) =>
      [
        p.address,
        [p.city, p.beds != null ? `${p.beds} bd` : null, p.sqft ? `${p.sqft} sqft` : null].filter(Boolean).join(' · '),
        `Asking ${usd(p.price)} · Est. rent ${usd(p.rent)} · Payment ${usd(p.pitia)}`,
        `DSCR ${p.dscr != null ? p.dscr.toFixed(2) : '—'} · Cash flow ${usd(p.cashFlowMonthly)}/mo · Price to reach DSCR 1.00 ${usd(p.maxPriceForDscr)}`,
        `Rent source: ${rentSourceLabel(p.rentSource)}`,
        `${siteUrl}${p.listingUrl}`,
        '',
      ].join('\n'),
    ),
    `Assumes ${downPct}% down, ${termYears}-year fixed at ${ratePct}%, ${opexPct}% of rent for vacancy, management, maintenance and reserves.`,
    `DSCR is a lender coverage test and excludes operating costs; about 1.30 is true break-even.`,
    `Rent figures are estimates pulled ${args.rentAsOf}, not signed leases. Listing data from Oregon Datashare MLS.`,
  ].join('\n')

  return { html, text }
}
