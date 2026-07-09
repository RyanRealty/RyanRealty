/**
 * Per-broker HTML email signature for every client-facing CRM email
 * (manual 1:1 sends + sequence-engine sends). Built from the live
 * public.brokers row (via the getBrokers DAL) so a phone or license change
 * propagates without a code edit.
 *
 * Precedence (Matt directive 2026-07-09 — CRM signatures must MATCH Gmail):
 *   1. Gmail-synced signature (brokers.gmail_signature_html, pulled verbatim
 *      from the broker's Gmail sendAs settings by
 *      lib/crm/gmail-signature-sync.ts) — used as-is, so what a client sees
 *      from the CRM is byte-identical to what they see from Gmail.
 *   2. Broker-authored custom signature (brokers.email_signature, §9 My
 *      Settings) — plain text, replaces the generated identity block.
 *   3. Generated identity block (name/title/license/contact from the row).
 * Every variant appends the Oregon agency-pamphlet compliance line (below).
 *
 * Carries the Oregon Initial Agency Disclosure Pamphlet link — ORS 696.820 +
 * OAR 863-015-0215 require delivery at first contact, and email is an
 * approved medium, so every outbound email satisfies the requirement by
 * construction. The pamphlet is self-hosted (the official OREA PDF, fetched
 * 2026-06-12 from oregon.gov/rea/licensing/Documents/Initial-Agency-Disclosure-Pamphlet.pdf)
 * so links in old emails never rot.
 *
 * Email-client reality: web fonts don't load in Gmail/Outlook, so the stack
 * falls back from Geist to system sans. Inline styles only. Table layout.
 */
import { getBrokers } from '@/lib/data'
import type { Broker } from '@/lib/data/types/broker'
import { htmlToPlainText } from '@/lib/crm/email-body'

export const AGENCY_PAMPHLET_URL =
  'https://ryan-realty.com/docs/oregon-initial-agency-disclosure-pamphlet.pdf'

const SITE = 'https://ryan-realty.com'
const FONT = `Geist,'Segoe UI',Helvetica,Arial,sans-serif`

export type BrokerSignature = { html: string; plain: string }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The ORS 696.820 pamphlet line — appended to EVERY signature variant (the
 *  compliance-by-construction guarantee must survive a custom signature). */
function pamphletHtml(): string {
  return `<div style="font-size:11px;margin-top:10px;line-height:1.5;font-family:${FONT}">
        <a href="${AGENCY_PAMPHLET_URL}" style="color:#5b6573;text-decoration:underline">Oregon Initial Agency Disclosure Pamphlet</a>
        <span style="color:#8a93a0">&nbsp;&middot;&nbsp;provided at first contact per ORS 696.820</span>
      </div>`
}

/**
 * Custom-signature variant (P1-6, 2026-07-02): when the broker saved a
 * plain-text signature in §9 My Settings (brokers.email_signature), it
 * REPLACES the generated identity block — escaped, newlines → <br>, same
 * navy-rule shell — and the Oregon pamphlet compliance line is still appended.
 */
function buildCustomSignature(custom: string): BrokerSignature {
  const lines = esc(custom).replace(/\r\n/g, '\n')
  const html = `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:collapse;font-family:${FONT}">
  <tr>
    <td style="border-left:2px solid #102742;padding-left:16px;vertical-align:top">
      <div style="font-size:13px;color:#102742;line-height:1.6;white-space:pre-line">${lines.replace(/\n/g, '<br>')}</div>
      ${pamphletHtml()}
    </td>
  </tr>
</table>`

  const plain = [
    '',
    '--',
    custom.trim(),
    `Oregon Initial Agency Disclosure Pamphlet (ORS 696.820): ${AGENCY_PAMPHLET_URL}`,
  ].join('\n')

  return { html, plain }
}

/**
 * Gmail-synced variant: the broker's real Gmail sendAs signature HTML is used
 * VERBATIM (Gmail signatures are already email-client-safe inline-styled
 * HTML), so CRM sends match Gmail sends exactly. The Oregon pamphlet
 * compliance line is still appended — that guarantee survives every variant.
 */
function buildGmailSignature(gmailHtml: string): BrokerSignature {
  const html = `<div style="margin-top:28px">${gmailHtml}${pamphletHtml()}</div>`
  const plain = [
    '',
    '--',
    htmlToPlainText(gmailHtml),
    `Oregon Initial Agency Disclosure Pamphlet (ORS 696.820): ${AGENCY_PAMPHLET_URL}`,
  ].join('\n')
  return { html, plain }
}

export function buildSignature(broker: Broker): BrokerSignature {
  // Gmail-synced signature wins outright — see precedence in the file header.
  const gmailSig = (broker.gmailSignatureHtml ?? '').trim()
  if (gmailSig) return buildGmailSignature(gmailSig)

  // §9 My Settings custom signature next (falls back to the generated
  // identity block below when blank/unset).
  const custom = (broker.emailSignature ?? '').trim()
  if (custom) return buildCustomSignature(custom)

  const name = broker.fullName
  const title = broker.title || 'Broker'
  const phone = broker.phoneDirect // already dotted per the Broker type contract
  const tel = phone ? `+1${phone.replace(/\D/g, '').slice(-10)}` : null
  const photo = broker.headshotPng ? `${SITE}${broker.headshotPng}` : null
  const license = broker.licenseNumber

  const contactBits = [
    phone && tel
      ? `<a href="tel:${tel}" style="color:#102742;text-decoration:none">${phone}</a>`
      : null,
    broker.email
      ? `<a href="mailto:${broker.email}" style="color:#102742;text-decoration:none">${esc(broker.email)}</a>`
      : null,
    `<a href="${SITE}" style="color:#102742;text-decoration:none">ryan-realty.com</a>`,
  ].filter(Boolean)

  const html = `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:collapse;font-family:${FONT}">
  <tr>
    ${photo ? `<td style="padding-right:16px;vertical-align:top"><img src="${photo}" width="64" height="96" alt="${esc(name)}" style="display:block;border-radius:8px;background-color:#faf8f4;object-fit:cover" /></td>` : ''}
    <td style="border-left:2px solid #102742;padding-left:16px;vertical-align:top">
      <div style="font-size:15px;font-weight:600;color:#102742;line-height:1.35">${esc(name)}</div>
      <div style="font-size:12px;color:#5b6573;line-height:1.5">${esc(title)} &middot; Ryan Realty &middot; BEND &middot; OREGON</div>
      ${license ? `<div style="font-size:12px;color:#5b6573;line-height:1.5">Licensed in Oregon &middot; #${esc(license)}</div>` : ''}
      <div style="font-size:12px;line-height:1.7;margin-top:6px">${contactBits.join(' &nbsp;&middot;&nbsp; ')}</div>
      ${pamphletHtml()}
    </td>
  </tr>
</table>`

  const plain = [
    '',
    '--',
    name,
    `${title} · Ryan Realty · BEND · OREGON`,
    license ? `Licensed in Oregon · #${license}` : null,
    [phone, broker.email, 'ryan-realty.com'].filter(Boolean).join(' · '),
    `Oregon Initial Agency Disclosure Pamphlet (ORS 696.820): ${AGENCY_PAMPHLET_URL}`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  return { html, plain }
}

/** Signature for the broker who owns a CRM mailbox, or null when unmatched. */
export async function getSignatureForMailbox(mailboxEmail: string): Promise<BrokerSignature | null> {
  try {
    const brokers = await getBrokers()
    const b = brokers.find((x) => (x.email ?? '').toLowerCase() === mailboxEmail.toLowerCase())
    if (!b) return null
    return buildSignature(b)
  } catch {
    return null
  }
}
