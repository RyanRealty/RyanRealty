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

// ── Shells ──────────────────────────────────────────────────────────────────

const NAVY = '#102742'
const CREAM = '#faf8f4'

/**
 * The broker the report is from, as the door shows them. Every field is
 * optional: a broker read that times out still renders the door, only without
 * the face and the phone.
 */
export type CmaGateBroker = {
  name: string
  title: string | null
  /** E.164 publishable line (brokers.twilio_number), never a personal cell. */
  phone: string | null
  photoUrl: string | null
  license: string | null
}

/**
 * The broker row (getCmaBrokerBySlugOrEmail) as the door needs it. The door
 * shows the alpha-matted portrait: every /images/brokers/*.jpg has a .png
 * sibling with a transparent edge (design system, broker headshots).
 */
export function gateBrokerFromRow(row: Record<string, unknown> | null | undefined): CmaGateBroker | null {
  if (!row) return null
  const name = String(row.display_name ?? '').trim()
  if (!name) return null
  const rawPhoto = String(row.photo_url ?? '').trim()
  const photoUrl = /^\/images\/brokers\/[a-z0-9-]+\.jpg$/i.test(rawPhoto) ? rawPhoto.replace(/\.jpg$/i, '.png') : rawPhoto || null
  return {
    name,
    title: String(row.title ?? '').trim() || null,
    phone: String(row.twilio_number ?? '').trim() || null,
    photoUrl,
    license: String(row.license_number ?? '').trim() || null,
  }
}

/** +15417033095 -> 541.703.3095, the way every Ryan Realty surface prints it. */
function dottedPhone(e164: string): string {
  const m = e164.replace(/[^\d]/g, '').match(/^1?(\d{3})(\d{3})(\d{4})$/)
  return m ? `${m[1]}.${m[2]}.${m[3]}` : e164
}

function telHref(e164: string): string {
  const digits = e164.replace(/[^\d]/g, '')
  return digits.length === 10 ? `+1${digits}` : `+${digits}`
}

/** "2566 Keats, Bend, OR 97701" -> ["2566 Keats", "Bend, OR 97701"]. */
function splitAddress(address: string | null): { street: string | null; rest: string | null } {
  const a = (address ?? '').trim()
  if (!a) return { street: null, rest: null }
  const i = a.indexOf(',')
  if (i < 0) return { street: a, rest: null }
  return { street: a.slice(0, i).trim() || a, rest: a.slice(i + 1).trim() || null }
}

function shell(title: string, body: string, broker: CmaGateBroker | null = null): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @font-face { font-family:'Amboqia Boriango'; src:url('/fonts/Amboqia_Boriango.otf') format('opentype'); font-display:swap; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background:${CREAM}; color:${NAVY}; min-height:100vh; display:flex; flex-direction:column;
    align-items:center; justify-content:center; padding:32px 16px; -webkit-font-smoothing:antialiased; }
  .card { max-width:440px; width:100%; background:${CREAM}; border:1px solid rgba(16,39,66,0.12);
    border-radius:14px; padding:28px 24px; box-shadow:0 8px 30px rgb(16 39 66 / 0.08); }
  .mark { display:block; width:84px; height:auto; margin:0 0 20px; }
  .eyebrow { font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(16,39,66,0.6); margin-bottom:8px; }
  h1 { font-family:'Amboqia Boriango', Georgia, serif; font-weight:400; font-size:30px; line-height:1.15;
    letter-spacing:-0.01em; margin-bottom:8px; }
  p { font-size:15px; line-height:1.55; color:rgba(16,39,66,0.85); }
  .place { font-size:14px; color:rgba(16,39,66,0.7); }
  ul.benefits { list-style:none; margin:20px 0 22px; display:flex; flex-direction:column; gap:10px; }
  ul.benefits li { display:flex; gap:10px; font-size:15px; line-height:1.45; }
  ul.benefits li::before { content:''; width:6px; height:6px; border-radius:50%;
    background:${NAVY}; flex:none; margin-top:8px; }
  .cta { display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
    min-height:48px; border-radius:10px; background:${NAVY}; color:${CREAM};
    font:600 16px/1.2 Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-decoration:none; border:none; cursor:pointer; }
  .cta:hover { background:rgba(16,39,66,0.85); }
  .cta.quiet { background:transparent; color:${NAVY}; border:1px solid rgba(16,39,66,0.25); }
  .cta.quiet:hover { background:rgba(16,39,66,0.06); }
  .or { display:flex; align-items:center; gap:12px; margin:18px 0 14px; font-size:13px; color:rgba(16,39,66,0.55); }
  .or::before, .or::after { content:''; flex:1; height:1px; background:rgba(16,39,66,0.12); }
  form.link label { display:block; font-size:14px; font-weight:500; margin-bottom:8px; }
  form.link input[type=email] { width:100%; min-height:48px; border-radius:10px; border:1px solid rgba(16,39,66,0.25);
    background:${CREAM}; color:${NAVY}; padding:0 14px; font:400 16px/1.2 Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    margin-bottom:10px; }
  form.link input[type=email]:focus { outline:2px solid ${NAVY}; outline-offset:1px; }
  .fine { margin-top:12px; font-size:12px; line-height:1.5; color:rgba(16,39,66,0.6); }
  .fine a { color:inherit; }
  a.back { display:inline-flex; align-items:center; min-height:44px; font-size:14px; color:rgba(16,39,66,0.75); }
  .broker { display:flex; gap:14px; align-items:flex-end; margin-top:24px; padding-top:20px;
    border-top:1px solid rgba(16,39,66,0.12); }
  .broker img { width:56px; height:84px; object-fit:contain; object-position:bottom; flex:none; }
  .broker .who { flex:1; min-width:0; }
  .broker .name { font-size:16px; font-weight:600; }
  .broker .role { font-size:13px; color:rgba(16,39,66,0.7); margin-top:2px; }
  .broker .reach { display:flex; gap:8px; margin-top:10px; }
  .broker .reach a { display:inline-flex; align-items:center; justify-content:center; min-height:44px; min-width:72px;
    padding:0 16px; border-radius:10px; border:1px solid rgba(16,39,66,0.25); color:${NAVY};
    font-size:15px; font-weight:600; text-decoration:none; }
  .broker .reach a:hover { background:rgba(16,39,66,0.06); }
  label.consent { display:flex; gap:10px; align-items:flex-start; font-size:13px;
    line-height:1.5; color:rgba(16,39,66,0.8); margin:0 0 14px; }
  label.consent input { margin-top:3px; width:16px; height:16px; flex:none; }
  .g { width:20px; height:20px; background:${CREAM}; border-radius:50%; display:inline-flex;
    align-items:center; justify-content:center; font-weight:700; color:${NAVY}; font-size:13px; }
  .foot { max-width:440px; width:100%; margin-top:14px; padding:0 4px; font-size:12px; line-height:1.5;
    color:rgba(16,39,66,0.55); }
  .foot a { color:inherit; }
</style>
</head>
<body><main class="card">
<img class="mark" src="/images/brand/logo-blue.png" alt="Ryan Realty" width="84" height="55">
${body}
${brokerBlock(broker)}
</main>
<p class="foot">Private report. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>${
    broker?.license ? ` · ${escapeHtml(broker.name)}, Oregon license ${escapeHtml(broker.license)}` : ''
  }</p>
<script src="/rr-doc-tracker.js" defer></script>
</body>
</html>`
}

/** The face and the phone of the broker the report is from. Call and Text say Call and Text. */
function brokerBlock(broker: CmaGateBroker | null): string {
  if (!broker) return ''
  const photo = broker.photoUrl
    ? `<img src="${escapeHtml(broker.photoUrl)}" alt="${escapeHtml(broker.name)}" width="56" height="84">`
    : ''
  const reach = broker.phone
    ? `<div class="reach"><a href="tel:${telHref(broker.phone)}" aria-label="Call ${escapeHtml(broker.name)} at ${dottedPhone(broker.phone)}">Call</a><a href="sms:${telHref(broker.phone)}" aria-label="Text ${escapeHtml(broker.name)} at ${dottedPhone(broker.phone)}">Text</a></div>`
    : ''
  return `<div class="broker">${photo}<div class="who"><div class="name">${escapeHtml(broker.name)}</div><div class="role">${escapeHtml(
    broker.title ? `${broker.title}, Ryan Realty` : 'Ryan Realty',
  )}${broker.phone ? ` · ${dottedPhone(broker.phone)}` : ''}</div>${reach}</div></div>`
}

/** The "email me the link" form. Posts to /api/cma/email-link. */
function emailLinkForm(slug: string, label: string, button = 'Email me the link'): string {
  return `<form class="link" method="POST" action="/api/cma/email-link">
      <input type="hidden" name="slug" value="${escapeHtml(slug)}">
      <label for="rr-link-email">${escapeHtml(label)}</label>
      <input id="rr-link-email" type="email" name="email" required autocomplete="email" inputmode="email" placeholder="you@example.com">
      <button class="cta quiet" type="submit">${escapeHtml(button)}</button>
      <p class="fine">We send it only to the email we have for this home.</p>
    </form>`
}

/** Pre-auth: what is inside, Continue with Google, or a private link by email. */
export function renderRegisterShell(params: {
  slug: string
  address: string | null
  clientName: string | null
  broker?: CmaGateBroker | null
  /**
   * Offer "Email me the link". False when nothing is on file to match (a
   * phone-only lead claims the report through Google instead), so the form is
   * never a dead end that says "Check your email". Defaults to true.
   */
  emailLink?: boolean
}): string {
  const { street, rest } = splitAddress(params.address)
  const name = street ? escapeHtml(street) : 'this home'
  const startHref = `/api/cma/register?slug=${encodeURIComponent(params.slug)}&start=1`
  const brokerName = params.broker?.name ? escapeHtml(params.broker.name) : null
  const place = [rest ? escapeHtml(rest) : null, brokerName ? `Prepared by ${brokerName} for the owner` : 'Prepared for the owner']
    .filter(Boolean)
    .join(' · ')
  return shell(
    `Your report on ${name} · Ryan Realty`,
    `
    <p class="eyebrow">Private report</p>
    <h1>Your report on ${name} is ready</h1>
    <p class="place">${place}</p>
    <ul class="benefits">
      <li>Where we would list your home, and why</li>
      <li>What nearby homes sold for after concessions</li>
      <li>The homes you would compete with today</li>
    </ul>
    <a class="cta" href="${startHref}"><span class="g">G</span> Continue with Google</a>
    ${params.emailLink === false ? '' : `<div class="or">or</div>
    ${emailLinkForm(params.slug, 'Get a private link by email')}`}
  `,
    params.broker ?? null,
  )
}

/**
 * After the email form. Says the same thing whether or not the address is on
 * file, so the form never tells a stranger which email owns a home.
 */
export function renderEmailLinkSentShell(params: {
  slug: string
  address: string | null
  broker?: CmaGateBroker | null
  /** The per-IP limiter refused the post: say so instead of claiming a send. */
  limited?: boolean
}): string {
  const { street } = splitAddress(params.address)
  const name = street ? escapeHtml(street) : 'this home'
  const from = params.broker?.name ? escapeHtml(params.broker.name) : 'Ryan Realty'
  if (params.limited) {
    return shell(
      `One moment · Ryan Realty`,
      `
    <p class="eyebrow">Private report</p>
    <h1>Too many tries</h1>
    <p>Give it a minute and try again, or call or text and we will send the link another way.</p>
    <p style="margin-top:8px"><a class="back" href="/cma/${encodeURIComponent(params.slug)}">Back</a></p>
  `,
      params.broker ?? null,
    )
  }
  return shell(
    `Check your email · Ryan Realty`,
    `
    <p class="eyebrow">Private report</p>
    <h1>Check your email</h1>
    <p>If that is the email we have for ${name}, a private link is on its way from ${from}. It can take a minute, and it may land in spam or promotions.</p>
    <p style="margin-top:12px">Nothing after a few minutes? Call or text and we will send it another way.</p>
    <p style="margin-top:8px"><a class="back" href="/cma/${encodeURIComponent(params.slug)}">Back</a></p>
  `,
    params.broker ?? null,
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
    <h1>Signed in as ${escapeHtml(params.viewerEmail)}</h1>
    <p>Two optional choices.</p>
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

/**
 * Signed in as someone the doc was not prepared for. Not a dead end: the owner
 * may simply have picked the wrong Google account, or reads mail somewhere
 * Google cannot sign in to (Outlook, MSN, iCloud), so the door offers another
 * account, the email link, and a person to call.
 */
export function renderWrongPersonShell(params: {
  viewerEmail: string
  slug?: string | null
  broker?: CmaGateBroker | null
  /** As on the register shell: offer the email link only when an email is on file. */
  emailLink?: boolean
}): string {
  const slug = params.slug ?? null
  const offerLink = params.emailLink !== false
  const switchHref = slug ? `/api/cma/register?slug=${encodeURIComponent(slug)}&start=1&switch=1` : null
  return shell(
    'This report is private · Ryan Realty',
    `
    <p class="eyebrow">Private report</p>
    <h1>This report is private to the homeowner</h1>
    <p>You are signed in as ${escapeHtml(params.viewerEmail)}, and that is not the email we have for this home.</p>
    ${
      switchHref
        ? `<p style="margin-top:12px">Is this your home? ${
            offerLink
              ? 'Try the Google account you got our email at, or have the link sent to the email we have on file.'
              : 'Try the Google account you got our message at.'
          }</p>
    <a class="cta" style="margin-top:18px" href="${switchHref}"><span class="g">G</span> Use a different Google account</a>
    ${offerLink ? `<div class="or">or</div>
    ${emailLinkForm(slug as string, 'Send the link to the owner', 'Send the link')}` : ''}`
        : ''
    }
    <p style="margin-top:18px">Want a report for your own home? Call or text and we will build one.</p>
  `,
    params.broker ?? null,
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
