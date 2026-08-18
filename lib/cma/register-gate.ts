/**
 * /cma/[slug] access gate + register shell (Matt 2026-08-05).
 *
 * The CMA web page is the consent door: the recipient signs in with Google to
 * view it, ONLY the lead the CMA was built for gets access, and registration
 * is where SMS/email consent is captured. Decision logic is pure (tested);
 * the shells are self-contained branded HTML served by the route handler.
 *
 * Identity rules:
 *  - A viewer matches when their signed-in email equals the CMA's client
 *    email or any email on the linked person.
 *  - A phone-only lead (no email anywhere on file — the SMS-intro path) can
 *    never email-match, so the FIRST signed-in viewer claims the doc
 *    (bind-on-first-register, audited); later different emails are refused.
 *  - Admins always pass (the review iframe and broker preview).
 *
 * Consent: capture is ASKED on the Google comms card (and once at CMA
 * registration if that cookie is missing), never required — TCPA express
 * consent cannot be a condition of service, and the carrier-verified sentence
 * (components/site/SmsConsentDisclosure.tsx SMS_CONSENT_TEXT) is reused
 * verbatim (ci:sms-consent locks its wording).
 */

export type CmaGateDecision =
  | { kind: 'serve' }
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
}): CmaGateDecision {
  if (params.isAdmin) return { kind: 'serve' }
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

// ── Shells ──────────────────────────────────────────────────────────────────

const NAVY = '#102742'
const CREAM = '#faf8f4'

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background:${CREAM}; color:${NAVY}; min-height:100vh; display:flex;
    align-items:center; justify-content:center; padding:24px; }
  .card { max-width:440px; width:100%; background:#FFFFFF; border:1px solid rgba(16,39,66,0.08);
    border-radius:14px; padding:32px 28px; box-shadow:0 8px 30px rgb(16 39 66 / 0.08); }
  h1 { font-size:24px; line-height:1.25; letter-spacing:-0.01em; margin-bottom:10px; }
  p { font-size:15px; line-height:1.55; color:rgba(16,39,66,0.85); }
  ul.benefits { list-style:none; margin:18px 0 22px; display:flex; flex-direction:column; gap:12px; }
  ul.benefits li { display:flex; gap:10px; font-size:15px; line-height:1.45; }
  ul.benefits li::before { content:''; width:8px; height:8px; border-radius:50%;
    background:${NAVY}; flex:none; margin-top:7px; }
  .cta { display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
    min-height:48px; border-radius:10px; background:${NAVY}; color:${CREAM};
    font-size:16px; font-weight:600; text-decoration:none; border:none; cursor:pointer; }
  .cta:hover { background:rgba(16,39,66,0.85); }
  .fine { margin-top:14px; font-size:12px; line-height:1.5; color:rgba(16,39,66,0.6); }
  .who { margin-top:16px; font-size:13px; color:rgba(16,39,66,0.6); }
  label.consent { display:flex; gap:10px; align-items:flex-start; font-size:13px;
    line-height:1.5; color:rgba(16,39,66,0.8); margin:0 0 14px; }
  label.consent input { margin-top:3px; width:16px; height:16px; flex:none; }
  .g { width:20px; height:20px; background:#FFFFFF; border-radius:50%; display:inline-flex;
    align-items:center; justify-content:center; font-weight:700; color:${NAVY}; font-size:13px; }
</style>
</head>
<body><div class="card">${body}</div>
<script src="/rr-doc-tracker.js" defer></script>
</body>
</html>`
}

/** Pre-auth: benefits + Continue with Google. */
export function renderRegisterShell(params: { slug: string; address: string | null; clientName: string | null }): string {
  const addr = params.address ? escapeHtml(params.address) : 'this home'
  const startHref = `/api/cma/register?slug=${encodeURIComponent(params.slug)}&start=1`
  return shell(
    `Your report on ${addr} · Ryan Realty`,
    `
    <h1>Your report on ${addr} is ready</h1>
    <p>One quick sign-in confirms it reaches the right person.</p>
    <ul class="benefits">
      <li>The recommended list for ${addr}, and why</li>
      <li>What Zillow says, and whether that number holds</li>
      <li>Who you are competing with at that price</li>
      <li>The sales that set the number</li>
      <li>What you would net, with numbers you can change</li>
    </ul>
    <a class="cta" href="${startHref}"><span class="g">G</span> Continue with Google</a>
    ${params.clientName ? `<p class="who">Prepared for ${escapeHtml(params.clientName)}. Sign in to confirm it is you.</p>` : ''}
    <p class="fine">Private report. We never share your information. <a href="/privacy" style="color:inherit">Privacy</a> · <a href="/terms" style="color:inherit">Terms</a></p>
  `,
  )
}

/** Post-auth, identity OK: the one-time consent ask. Choices are optional. */
export function renderConsentShell(params: {
  slug: string
  address: string | null
  viewerEmail: string
  smsConsentText: string
  claiming: boolean
}): string {
  const addr = params.address ? escapeHtml(params.address) : 'your home'
  return shell(
    `Your report on ${addr} · Ryan Realty`,
    `
    <h1>You're in, ${escapeHtml(params.viewerEmail)}</h1>
    <p>Two optional choices before your report on ${addr} opens. Your report opens either way.</p>
    <form method="POST" action="/api/cma/register" style="margin-top:18px">
      <input type="hidden" name="slug" value="${escapeHtml(params.slug)}">
      <label class="consent">
        <input type="checkbox" name="emailOptIn" value="1">
        <span>Email me when the market moves for ${addr}: new comparable sales, price shifts, and updates to this report.</span>
      </label>
      <label class="consent">
        <input type="checkbox" name="smsOptIn" value="1">
        <span>${escapeHtml(params.smsConsentText)}</span>
      </label>
      <button class="cta" type="submit">View my report</button>
      <p class="fine">Reply STOP any time to end texts. Unsubscribe links in every email.</p>
    </form>
  `,
  )
}

/** Signed in as someone the doc was not prepared for. */
export function renderWrongPersonShell(params: { viewerEmail: string }): string {
  return shell(
    'This report is private · Ryan Realty',
    `
    <h1>This report was prepared for someone else</h1>
    <p>You are signed in as ${escapeHtml(params.viewerEmail)}, and this report is private to the homeowner it was built for.</p>
    <p style="margin-top:12px">Want your own? Text us at 541.703.3095 and we will build one for your home.</p>
    <p class="fine" style="margin-top:18px"><a href="/" style="color:inherit">ryan-realty.com</a></p>
  `,
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
