/**
 * Resend-based email alert to Matt on every new seller-LP lead.
 *
 * Independent of the broker-notification email that fires from createCmaRequest
 * (which goes to the round-robin-assigned broker). This one ALWAYS goes to
 * Matt — he asked to be alerted on every new seller lead regardless of who
 * the lead is assigned to.
 *
 * Fire-and-forget from app/lp/seller-home-value/actions.ts. Never throws to
 * the caller (lead capture is the priority).
 *
 * Configured via MATT_ALERT_EMAIL (defaults to matt@ryan-realty.com).
 */

import { sendEmail } from '@/lib/resend'

const ALERT_TO = process.env.MATT_ALERT_EMAIL ?? 'matt@ryan-realty.com'
const ALERT_FROM = process.env.RESEND_FROM ?? 'alerts@mail.ryan-realty.com'

export type SellerLeadAlertParams = {
  fubPersonId: number | null
  email: string | null
  phone: string | null
  name: string | null
  address: string
  timeline: string | null
  classification: 'hot' | 'warm' | 'nurture' | 'unknown'
  assignedBroker: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  alreadyKnown: boolean
}

function fubLink(personId: number | null): string {
  if (!personId) return '(FUB record pending)'
  return `https://app.followupboss.com/people/${personId}`
}

function tierBadge(classification: SellerLeadAlertParams['classification']): string {
  switch (classification) {
    case 'hot': return '🔥 HOT'
    case 'warm': return '🌡️ Warm'
    case 'nurture': return '🌱 Nurture'
    default: return '— Unknown tier'
  }
}

export async function sendSellerLeadAlertEmail(
  params: SellerLeadAlertParams,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const subject = `New seller lead — ${tierBadge(params.classification)} — ${params.address}`

  const utmRows: string[] = []
  if (params.utmSource) utmRows.push(`<li>Source: <strong>${params.utmSource}</strong></li>`)
  if (params.utmMedium) utmRows.push(`<li>Medium: <strong>${params.utmMedium}</strong></li>`)
  if (params.utmCampaign) utmRows.push(`<li>Campaign: <strong>${params.utmCampaign}</strong></li>`)
  if (params.utmContent) utmRows.push(`<li>Content / ad: <strong>${params.utmContent}</strong></li>`)

  const utmSection = utmRows.length > 0
    ? `<h3>Attribution</h3><ul>${utmRows.join('')}</ul>`
    : '<p style="color: #888;">No UTM attribution captured — visitor likely from organic / direct traffic.</p>'

  const contactSection: string[] = []
  if (params.name) contactSection.push(`<li>Name: <strong>${params.name}</strong></li>`)
  if (params.email) contactSection.push(`<li>Email: <a href="mailto:${params.email}">${params.email}</a></li>`)
  if (params.phone) contactSection.push(`<li>Phone: <a href="tel:${params.phone.replace(/\D/g, '')}">${params.phone}</a></li>`)

  const knownNote = params.alreadyKnown
    ? '<p style="color: #888;">⚠️ This person was already in FUB before this submission (re-engagement).</p>'
    : ''

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="margin: 0 0 8px;">${tierBadge(params.classification)} seller lead</h2>
  <p style="margin: 0 0 16px; color: #555;">Submitted via <code>/lp/seller-home-value</code> · assigned to <strong>${params.assignedBroker}</strong></p>
  ${knownNote}

  <h3>Property</h3>
  <p style="font-size: 18px; margin: 4px 0;"><strong>${params.address}</strong></p>
  <p style="margin: 4px 0; color: #555;">Move timeline: <strong>${params.timeline ?? 'not specified'}</strong></p>

  <h3>Contact</h3>
  <ul>${contactSection.join('') || '<li style="color: #888;">No contact details captured</li>'}</ul>

  ${utmSection}

  <h3>Next step</h3>
  <p>
    <a href="${fubLink(params.fubPersonId)}" style="display: inline-block; padding: 10px 18px; background: #102742; color: #fff; text-decoration: none; border-radius: 4px;">
      Open in Follow Up Boss →
    </a>
  </p>

  <p style="font-size: 12px; color: #999; margin-top: 24px;">
    Automated alert from <code>app/lp/seller-home-value/actions.ts</code> →
    <code>lib/seller-lead-alert.ts</code>. Override the destination via the
    <code>MATT_ALERT_EMAIL</code> env var. CMA is being generated in parallel
    and will be emailed to the lead automatically when ready.
  </p>
</body>
</html>
  `.trim()

  try {
    const result = await sendEmail({
      to: ALERT_TO,
      from: ALERT_FROM,
      subject,
      html,
      replyTo: params.email || undefined,
    })
    if (result.error) return { ok: false, error: result.error }
    return { ok: true, id: result.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
