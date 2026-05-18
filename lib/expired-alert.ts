/**
 * Resend-based email alert for newly-detected expired listings.
 *
 * Goes to matt@ryan-realty.com (configurable via MATT_ALERT_EMAIL env var).
 * Subject includes the address + status so the alert is scannable in the
 * inbox. Body has the full listing context + owner-lookup result + a direct
 * link to the FUB person record.
 */

import { sendEmail } from '@/lib/resend'

const ALERT_TO = process.env.MATT_ALERT_EMAIL ?? 'matt@ryan-realty.com'
const ALERT_FROM = process.env.RESEND_FROM ?? 'alerts@mail.ryan-realty.com'

export type ExpiredAlertParams = {
  listingKey: string
  listNumber: string | null
  streetAddress: string
  city: string
  postalCode: string | null
  status: string
  statusChangedAt: string  // ISO
  listPrice: number | null
  originalListPrice: number | null
  daysOnMarket: number | null
  listAgentName: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  subdivision: string | null
  ownerLookupStatus: 'matched-fub' | 'matched-dial' | 'matched-apollo' | 'pending'
  ownerName: string | null
  ownerMailingAddress: string | null
  ownerEmail: string | null
  ownerPhone: string | null
  fubPersonId: number | null
  enrichmentNotes: string | null
}

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  return '$' + new Intl.NumberFormat('en-US').format(Math.round(n))
}

function fubLink(personId: number | null): string {
  if (!personId) return '(no FUB record)'
  return `https://app.followupboss.com/people/${personId}`
}

export async function sendExpiredAlertEmail(params: ExpiredAlertParams): Promise<{ ok: boolean; id?: string; error?: string }> {
  const priceDropLine = (() => {
    if (!params.originalListPrice || !params.listPrice) return ''
    const drop = params.originalListPrice - params.listPrice
    if (drop <= 0) return ''
    const dropPct = ((drop / params.originalListPrice) * 100).toFixed(1)
    return `<li>Original list: <strong>${fmtPrice(params.originalListPrice)}</strong> (dropped ${fmtPrice(drop)} = ${dropPct}%)</li>`
  })()

  const ownerSection = (() => {
    if (params.ownerLookupStatus === 'pending') {
      return `<p><strong>Owner lookup:</strong> pending — manual skiptrace needed. We have the property address + MLS history, but no contact info yet.</p>`
    }
    const rows: string[] = []
    if (params.ownerName) rows.push(`<li><strong>Owner:</strong> ${params.ownerName}</li>`)
    if (params.ownerMailingAddress) rows.push(`<li><strong>Mailing:</strong> ${params.ownerMailingAddress}</li>`)
    if (params.ownerEmail) rows.push(`<li><strong>Email:</strong> ${params.ownerEmail}</li>`)
    if (params.ownerPhone) rows.push(`<li><strong>Phone:</strong> ${params.ownerPhone}</li>`)
    return `<p><strong>Owner lookup:</strong> ${params.ownerLookupStatus}</p><ul>${rows.join('')}</ul>`
  })()

  const html = `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.55;max-width:640px;margin:0 auto;padding:24px;">

<h2 style="margin:0 0 8px 0;color:#102742;">New expired listing detected</h2>
<p style="margin:0 0 16px 0;color:#666;">${params.status} on ${params.statusChangedAt.slice(0, 10)} · ${params.city}, OR</p>

<p style="font-size:18px;font-weight:600;margin:0 0 4px 0;">${params.streetAddress}</p>
<p style="margin:0 0 16px 0;color:#666;">${params.city}, OR ${params.postalCode ?? ''}</p>

<h3 style="margin:24px 0 8px 0;color:#102742;">Listing context</h3>
<ul style="margin:0 0 16px 0;padding-left:20px;">
  <li><strong>Last list price:</strong> ${fmtPrice(params.listPrice)}</li>
  ${priceDropLine}
  ${params.daysOnMarket != null ? `<li><strong>Days on market:</strong> ${params.daysOnMarket}</li>` : ''}
  ${params.bedrooms ? `<li><strong>Beds:</strong> ${params.bedrooms}</li>` : ''}
  ${params.bathrooms ? `<li><strong>Baths:</strong> ${params.bathrooms}</li>` : ''}
  ${params.sqft ? `<li><strong>Sqft:</strong> ${new Intl.NumberFormat('en-US').format(params.sqft)}</li>` : ''}
  ${params.subdivision ? `<li><strong>Subdivision:</strong> ${params.subdivision}</li>` : ''}
  <li><strong>MLS #:</strong> ${params.listNumber ?? params.listingKey}</li>
  ${params.listAgentName ? `<li><strong>Prior list agent:</strong> ${params.listAgentName}</li>` : ''}
</ul>

<h3 style="margin:24px 0 8px 0;color:#102742;">Owner</h3>
${ownerSection}

<h3 style="margin:24px 0 8px 0;color:#102742;">Next step</h3>
<p>FUB record: <a href="${fubLink(params.fubPersonId)}">${fubLink(params.fubPersonId)}</a></p>
<p>Landing page to drive them to: <a href="https://ryan-realty.com/lp/expired-listing">ryan-realty.com/lp/expired-listing</a></p>

${params.enrichmentNotes ? `<p style="margin-top:24px;color:#666;font-size:12px;"><em>Enrichment notes: ${params.enrichmentNotes}</em></p>` : ''}

</body></html>`

  const subject = `[Expired] ${params.streetAddress}, ${params.city} (${params.status}, ${params.daysOnMarket ?? '?'} DOM, ${fmtPrice(params.listPrice)})`

  try {
    const r = await sendEmail({
      to: ALERT_TO,
      from: `Ryan Realty Brain <${ALERT_FROM}>`,
      subject,
      html,
    })
    if (r.error) return { ok: false, error: r.error }
    return { ok: true, id: r.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
