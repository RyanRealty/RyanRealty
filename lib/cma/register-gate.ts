/**
 * /cma/[slug] consent ask + the access decision the consent POST still uses.
 *
 * NO SIGN-IN TO VIEW A REPORT (Matt 2026-10-07: "Don't require a sign in to
 * view the report"). A finalized or delivered report opens for anyone who has
 * the link. Drafts stay 404 for the public, and the document stays noindex.
 * The Google door this file used to render (Matt 2026-08-05), its consent
 * shell and its wrong-person page are gone; lib/cma/serve-document.test.ts
 * holds the rule.
 *
 * What remains:
 *  - renderConsentBarHtml: the optional email/SMS ask, a bar inside the report
 *    for the recipient who came in on the tracked link. Never a wall.
 *  - decideCmaAccess: /api/cma/register's POST checks a Google-signed-in
 *    answer against the document's person with it (bind-on-first-register for
 *    phone-only leads, refuse a different person's answer).
 *
 * Consent is ASKED, never required: TCPA express consent cannot be a
 * condition of service, and the carrier-verified sentence
 * (components/site/SmsConsentDisclosure.tsx SMS_CONSENT_TEXT) is reused
 * verbatim (ci:sms-consent locks its wording).
 */

export type CmaGateDecision =
  | { kind: 'serve'; via?: 'recipient' }
  | { kind: 'register' }
  | { kind: 'consent' }
  | { kind: 'claim-and-consent' }
  | { kind: 'wrong-person' }

export function decideCmaAccess(params: {
  isAdmin: boolean
  viewerEmail: string | null
  clientEmail: string | null
  personEmails: string[]
  claimedBy: string | null
  consentRecorded: boolean
  /** rr_google_comms cookie already recorded the comms ask (boxes may be unchecked). */
  commsConsentRecorded?: boolean
  /** crm_people.id the document was built for (cmas.person_id). */
  personId?: number | null
  /**
   * crm_people.id the visitor arrived as: `?_pid=` on the tracked email link,
   * or the rr_pid cookie that link set. Matt 2026-09-09: the person the email
   * was sent to reads the report straight away; the Google door stays for
   * everyone else, and the consent ask becomes a bar inside the report.
   */
  recipientPersonId?: number | null
}): CmaGateDecision {
  if (params.isAdmin) return { kind: 'serve' }
  const recipient = params.recipientPersonId ?? null
  const owner = params.personId ?? null
  if (recipient && owner && recipient === owner) return { kind: 'serve', via: 'recipient' }
  const viewer = (params.viewerEmail ?? '').trim().toLowerCase()
  if (!viewer) return { kind: 'register' }

  const known = new Set(
    [params.clientEmail, ...params.personEmails, params.claimedBy]
      .map((e) => (e ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  if (known.size === 0) {
    // Phone-only lead: first registrant claims the doc. CRM consent on THIS
    // person means the claim already landed (callback wrote cmaClaimedBy).
    // A site-wide comms cookie alone is not a claim.
    return params.consentRecorded ? { kind: 'serve' } : { kind: 'claim-and-consent' }
  }
  if (!known.has(viewer)) return { kind: 'wrong-person' }
  const asked = params.consentRecorded || params.commsConsentRecorded === true
  return asked ? { kind: 'serve' } : { kind: 'consent' }
}

// ── Consent bar ─────────────────────────────────────────────────────────────

const NAVY = '#102742'
const CREAM = '#faf8f4'

/**
 * The consent ask as a bar inside the report, for a recipient who came in on
 * the tracked email link (no Google session). Posts to /api/cma/register with
 * the person id; the route checks it against the rr_pid cookie and the
 * document's person. Optional choices, dismissable, never a wall.
 */
export function renderConsentBarHtml(params: {
  slug: string
  personId: number
  address: string | null
  smsConsentText: string
}): string {
  const addr = params.address ? escapeHtml(params.address) : 'your home'
  return `
<div id="rr-consent-bar" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:${CREAM};color:${NAVY};border-top:1px solid rgba(16,39,66,0.12);box-shadow:0 -8px 30px rgb(16 39 66 / 0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <form method="POST" action="/api/cma/register" style="max-width:920px;margin:0 auto;padding:14px 20px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;">
    <input type="hidden" name="slug" value="${escapeHtml(params.slug)}">
    <input type="hidden" name="pid" value="${params.personId}">
    <span style="font-size:14px;font-weight:600;flex:1 1 220px;">Keep this report current?</span>
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.4;flex:1 1 260px;"><input type="checkbox" name="emailOptIn" value="1" style="margin-top:2px"><span>Email me when the market moves for ${addr}.</span></label>
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.4;flex:2 1 320px;color:rgba(16,39,66,0.8);"><input type="checkbox" name="smsOptIn" value="1" style="margin-top:2px"><span>${escapeHtml(params.smsConsentText)}</span></label>
    <button type="submit" style="background:${NAVY};color:${CREAM};border:0;border-radius:10px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;">Save</button>
    <button type="button" id="rr-consent-bar-close" aria-label="Not now" style="background:transparent;border:0;color:${NAVY};font-size:13px;cursor:pointer;text-decoration:underline;">Not now</button>
  </form>
</div>
<script>(function(){try{var k='rr-consent-bar:${escapeHtml(params.slug)}';var b=document.getElementById('rr-consent-bar');if(!b)return;if(localStorage.getItem(k)==='1'){b.remove();return;}var c=document.getElementById('rr-consent-bar-close');c&&c.addEventListener('click',function(){localStorage.setItem(k,'1');b.remove();});}catch(e){}})();</script>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
