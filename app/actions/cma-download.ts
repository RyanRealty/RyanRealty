'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { getAuthLimiter } from '@/lib/rate-limit'
import { sendEvent } from '@/lib/followupboss'
import { ensureNativeLead, enrichNativeLead, createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { registerForCmaDocument, CMA_DOCUMENT_TERMS_VERSION } from '@/lib/data/cma/getPublishedCma'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
import { fireLeadGenerated } from '@/lib/lead-tracking'

/**
 * "Download the full market analysis" — the registration behind a published CMA.
 *
 * Matt asked for this as a LEAD FUNNEL ("require them to register, etc."). It
 * also happens to be the display boundary: ODS Rules (Aug 2024) §5-4 A.4 counts
 * sold data as MLS listing information, and §5-4 C requires a name, a valid
 * email and an affirmative terms agreement before a consumer retrieves that
 * information on a website. One gate, both jobs.
 *
 * The DOCUMENT is untouched. ODS §7-5 D preserves a broker's right to use sold
 * and comparable data "to support valuations on particular properties for
 * clients and customers", so what gets delivered is a normal CMA with full
 * comps.
 *
 * This is a PUBLIC server-action write into the CRM and the DB, so it follows
 * the hardened path app/actions/search-alert-capture.ts established:
 *   1. honeypot   2. per-IP rate limit, fail closed in production
 *   3. validation   4. native lead via sendEvent → ensureNativeLead
 *   5. broker routing from the agent-attribution cookie
 *
 * There is exactly one lead pipeline in this shop and this uses it.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type CmaDownloadInput = {
  listingKey: string
  fullName: string
  email: string
  phone?: string
  termsVersion: string
  agreed: boolean
  /** Separate, explicit SMS opt-in (A2P 10DLC). Never bundled with `agreed`. */
  smsConsent?: boolean
  /** Honeypot, a hidden field humans never fill. */
  company?: string
}

export type CmaDownloadResult = { ok: true; url: string } | { ok: false; error: string }

export async function registerForCmaDocumentAction(input: CmaDownloadInput): Promise<CmaDownloadResult> {
  // 1. Honeypot. Pretend nothing is wrong, do nothing, hand back a dead link.
  if (typeof input.company === 'string' && input.company.trim() !== '') {
    return { ok: false, error: 'We could not process that request.' }
  }

  const isProd = process.env.NODE_ENV === 'production'
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    '127.0.0.1'

  // 2. Per-IP rate limit. Server actions bypass the middleware /api limiter.
  //    Fail CLOSED in production: an unconfigured throttle must not open the
  //    floodgate on a path that mints document links.
  try {
    const limiter = getAuthLimiter()
    if (!limiter) {
      if (isProd) return { ok: false, error: 'Too many requests. Please try again later.' }
    } else {
      const { success } = await limiter.limit(`cma-download:${ip}`)
      if (!success) return { ok: false, error: 'Too many requests. Please try again in a minute.' }
    }
  } catch {
    if (isProd) return { ok: false, error: 'Too many requests. Please try again later.' }
  }

  // 3. Validate.
  const listingKey = String(input.listingKey ?? '').trim()
  const fullName = String(input.fullName ?? '').trim().slice(0, 120)
  const email = String(input.email ?? '').trim().toLowerCase()
  const phone = String(input.phone ?? '').trim().slice(0, 40) || null

  if (!listingKey) return { ok: false, error: 'We could not tell which property that was.' }
  if (fullName.length < 2) return { ok: false, error: 'Please enter your name.' }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter an email address we can reach you at.' }
  }
  // ODS §5-4 F requires an affirmative act, so a missing checkbox is a hard stop
  // and not something the server quietly assumes.
  if (input.agreed !== true) {
    return { ok: false, error: 'Please agree to the terms so we can send the analysis.' }
  }
  if (input.termsVersion !== CMA_DOCUMENT_TERMS_VERSION) {
    return { ok: false, error: 'Those terms are out of date. Reload the page and try again.' }
  }

  // SMS is fail-closed. Nothing on this path sends an automated text, so the
  // opt-in is what tells the broker whether replying by SMS is permitted at all.
  const smsTag = input.smsConsent === true ? 'sms-consent:yes' : 'sms-consent:no'

  // 4. Route to the attributed broker, falling back to the default.
  const attributed = await readAttributedAgentServer()
  const assignedBroker = attributed?.broker ?? 'matt'

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const sourceUrl = `${base}/listing/${encodeURIComponent(listingKey)}`

  // 5. The one lead pipeline: sendEvent → ensureNativeLead, with the same
  //    ensureNativeLead fallback every LP action uses when sendEvent does not
  //    resolve a person id. Best-effort so a CRM blip never costs the visitor
  //    the document they registered for.
  let personId: number | null = null
  try {
    const [firstName, ...rest] = fullName.split(/\s+/)
    const result = await sendEvent({
      type: 'Property Inquiry',
      person: {
        firstName,
        lastName: rest.join(' ') || undefined,
        emails: [{ value: email }],
        phones: phone ? [{ value: phone }] : undefined,
      },
      source: base.replace(/^https?:\/\//, '').toLowerCase() || 'ryan-realty.com',
      system: 'Ryan Realty Website',
      sourceUrl,
      message: `Downloaded the published market analysis for listing ${listingKey}`,
      brokerAttribution: { brokerSlug: assignedBroker },
    })
    personId = result.ok ? result.personId : null
  } catch {
    // fall through to the direct native capture below
  }

  if (!personId) {
    try {
      const native = await ensureNativeLead({
        name: fullName,
        email,
        phone,
        source: 'published-cma',
        tags: ['audience:buyer', 'source:published-cma', smsTag],
        assignedBroker: assignedBroker as never,
      })
      personId = native.personId > 0 ? native.personId : null
    } catch {
      // best-effort
    }
  }

  // 6. Mint the registration + delivery token. This re-checks the publish flag,
  //    so a registration can never exist for an unpublished document.
  const registration = await registerForCmaDocument({
    listingKey,
    fullName,
    email,
    phone,
    termsVersion: input.termsVersion,
    // Hashed, never raw. An IP is personal data and a hash answers the only
    // question we would ever ask of it.
    ipHash: createHash('sha256').update(ip).digest('hex'),
    userAgent: h.get('user-agent')?.slice(0, 400) ?? null,
    personId,
    assignedBroker,
  })
  if (!registration.ok) return { ok: false, error: registration.error }

  // 7. Stamp the CRM and put it in front of the broker. Best-effort.
  if (personId) {
    try {
      await enrichNativeLead({
        personId,
        tags: ['source:published-cma', smsTag],
        assignedBroker: assignedBroker as never,
        originNote: {
          title: 'Downloaded a published market analysis',
          body: `Listing ${listingKey}. Agreed to terms version ${input.termsVersion}. SMS consent: ${input.smsConsent === true ? 'yes' : 'no'}.`,
        },
      })
      await createNativeTask({
        personId,
        name: `Market analysis downloaded for listing ${listingKey}`,
        type: 'Follow Up',
        dueInMinutes: 15,
        assignedBroker: assignedBroker as never,
      })
    } catch {
      // best-effort
    }
  }

  try {
    await fireLeadGenerated({
      lp_variant: 'published-cma',
      lead_type: 'buyer',
      value: 0,
      fub_person_id: personId ?? undefined,
    })
  } catch {
    // best-effort
  }

  return { ok: true, url: `/api/cma-document/${registration.token}` }
}
