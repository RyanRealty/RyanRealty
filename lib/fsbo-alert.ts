/**
 * Resend-based email alert for newly-detected FSBO listings.
 *
 * Companion to lib/expired-alert.ts. Same visual treatment, same recipient
 * (MATT_ALERT_EMAIL), same brand voice §4.7. Subject line includes the
 * address + city + price so the alert is scannable in the inbox.
 */

import { sendEmail } from '@/lib/resend'
import { EMAIL_FONT_STACK, EMAIL_BORDER } from '@/lib/email/brand'

const ALERT_TO = process.env.MATT_ALERT_EMAIL ?? 'matt@ryan-realty.com'
const ALERT_FROM = process.env.RESEND_FROM ?? 'alerts@mail.ryan-realty.com'

export type FsboAlertParams = {
  fsboUrl: string
  fsboSource: string
  streetAddress: string
  city: string
  state: string
  postalCode: string | null
  listPrice: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lotSizeSqft: number | null
  propertyType: string | null
  yearBuilt: number | null
  daysListed: number | null
  photoUrl: string | null
  ownerName: string | null
  contactPhone: string | null
  contactEmail: string | null
  ownerLookupStatus: 'matched-fub' | 'matched-dial' | 'matched-apollo' | 'pending' | 'direct-from-listing'
  ownerMailingAddress: string | null
  fubPersonId: number | null
  enrichmentNotes: string | null
}

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  return '$' + new Intl.NumberFormat('en-US').format(Math.round(n))
}

function fmtPhone(digits: string | null): string {
  if (!digits) return '—'
  const d = digits.replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  if (d.length === 11 && d.startsWith('1')) return `${d.slice(1, 4)}.${d.slice(4, 7)}.${d.slice(7)}`
  return digits
}

function fubLink(personId: number | null): string {
  if (!personId) return '(no FUB record)'
  return `https://app.followupboss.com/people/${personId}`
}

export async function sendFsboAlertEmail(params: FsboAlertParams): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ownerSection = (() => {
    if (params.ownerLookupStatus === 'pending' && !params.contactPhone && !params.contactEmail && !params.ownerName) {
      return `<p><strong>Owner lookup:</strong> pending. The Zillow listing did not surface direct contact info. Manual skiptrace is the next step.</p>`
    }
    const rows: string[] = []
    if (params.ownerName) rows.push(`<li><strong>Owner:</strong> ${params.ownerName}</li>`)
    if (params.contactPhone) rows.push(`<li><strong>Phone:</strong> ${fmtPhone(params.contactPhone)}</li>`)
    if (params.contactEmail) rows.push(`<li><strong>Email:</strong> ${params.contactEmail}</li>`)
    if (params.ownerMailingAddress) rows.push(`<li><strong>Mailing:</strong> ${params.ownerMailingAddress}</li>`)
    return `<p><strong>Owner lookup:</strong> ${params.ownerLookupStatus}</p><ul style="margin:0 0 16px 0;padding-left:20px;">${rows.join('')}</ul>`
  })()

  const photoBlock = params.photoUrl
    ? `<p style="margin:16px 0;"><img src="${params.photoUrl}" alt="" style="max-width:100%;height:auto;border-radius:8px;border:1px solid ${EMAIL_BORDER};" /></p>`
    : ''

  const html = `<!doctype html>
<html><body style="font-family:${EMAIL_FONT_STACK};color:#1a1a1a;font-size:14px;line-height:1.55;max-width:640px;margin:0 auto;padding:24px;">

<h2 style="margin:0 0 8px 0;color:#102742;">New FSBO listing detected</h2>
<p style="margin:0 0 16px 0;color:#666;">Source: ${params.fsboSource} · ${params.city}, ${params.state}</p>

<p style="font-size:18px;font-weight:600;margin:0 0 4px 0;">${params.streetAddress}</p>
<p style="margin:0 0 16px 0;color:#666;">${params.city}, ${params.state} ${params.postalCode ?? ''}</p>

${photoBlock}

<h3 style="margin:24px 0 8px 0;color:#102742;">Listing context</h3>
<ul style="margin:0 0 16px 0;padding-left:20px;">
  <li><strong>List price:</strong> ${fmtPrice(params.listPrice)}</li>
  ${params.daysListed != null ? `<li><strong>Days listed on Zillow:</strong> ${params.daysListed}</li>` : ''}
  ${params.bedrooms ? `<li><strong>Beds:</strong> ${params.bedrooms}</li>` : ''}
  ${params.bathrooms ? `<li><strong>Baths:</strong> ${params.bathrooms}</li>` : ''}
  ${params.sqft ? `<li><strong>Sqft:</strong> ${new Intl.NumberFormat('en-US').format(params.sqft)}</li>` : ''}
  ${params.lotSizeSqft ? `<li><strong>Lot:</strong> ${new Intl.NumberFormat('en-US').format(params.lotSizeSqft)} sqft</li>` : ''}
  ${params.yearBuilt ? `<li><strong>Year built:</strong> ${params.yearBuilt}</li>` : ''}
  ${params.propertyType ? `<li><strong>Type:</strong> ${params.propertyType}</li>` : ''}
  <li><strong>Listing URL:</strong> <a href="${params.fsboUrl}">${params.fsboUrl}</a></li>
</ul>

<h3 style="margin:24px 0 8px 0;color:#102742;">Owner</h3>
${ownerSection}

<h3 style="margin:24px 0 8px 0;color:#102742;">Next step</h3>
<p>FUB record: <a href="${fubLink(params.fubPersonId)}">${fubLink(params.fubPersonId)}</a></p>
<p>Approach: reach the owner directly. FSBO sellers chose to skip representation, so the pitch is the same conversation Matt would have at a listing appointment. Pricing accuracy, exposure, time saved. Lead with value, not a critique of their decision.</p>

${params.enrichmentNotes ? `<p style="margin-top:24px;color:#666;font-size:12px;"><em>Enrichment notes: ${params.enrichmentNotes}</em></p>` : ''}

</body></html>`

  const subject = `[FSBO] ${params.streetAddress}, ${params.city} (${fmtPrice(params.listPrice)}${params.daysListed != null ? `, ${params.daysListed}d listed` : ''})`

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
