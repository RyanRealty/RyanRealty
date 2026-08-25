'use server'

/**
 * Public newsletter signup — identity stitch (Broker OS A12 / D4).
 *
 * Finds-or-creates ONE crm_people row (email-first), links
 * newsletter_subscribers.crm_person_id, then stitches the browser the same
 * way seller LP + auth/callback do: backfillSessionToFub when a uuid-v4
 * sessionId is present, stitchVisitorIdentity via the rr_vid cookie always.
 * Dual-intent reuses the existing person. No broker task. No send.
 */

import { cookies, headers } from 'next/headers'
import { getAuthLimiter } from '@/lib/rate-limit'
import { subscribeToNewsletter, type NewsletterSegment } from '@/lib/data'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { tagNativeLead } from '@/lib/canonical-lead-tagger'
import { stitchFormSubmitIdentity } from '@/lib/visitor-backfill'

const SEGMENTS: NewsletterSegment[] = ['general', 'buyer', 'seller', 'past-client']
function asSegment(v: FormDataEntryValue | null | undefined): NewsletterSegment {
  const s = String(v ?? 'general')
  return (SEGMENTS as string[]).includes(s) ? (s as NewsletterSegment) : 'general'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Public newsletter signup (footer / CTA form). No auth. */
export async function subscribeNewsletterAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  // 1. Honeypot. A filled hidden field means a bot. Pretend success, do nothing.
  const company = String(formData.get('company') ?? '')
  if (company.trim() !== '') {
    return { ok: true }
  }

  // 2. Per-IP rate limit. Server actions bypass the middleware /api limiter.
  //    FAIL CLOSED in production: if Upstash is unconfigured or down, a missing
  //    throttle must not silently open the floodgate. Same contract as
  //    submitSearchAlertSignup (sibling lease — do not merge the two).
  const isProd = process.env.NODE_ENV === 'production'
  try {
    const limiter = getAuthLimiter()
    if (!limiter) {
      if (isProd) return { ok: false, error: 'Too many requests. Please try again later.' }
    } else {
      const h = await headers()
      const ip =
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        h.get('x-real-ip') ||
        h.get('cf-connecting-ip') ||
        '127.0.0.1'
      const { success } = await limiter.limit(`newsletter:${ip}`)
      if (!success) return { ok: false, error: 'Too many requests. Please try again in a minute.' }
    }
  } catch {
    if (isProd) return { ok: false, error: 'Too many requests. Please try again later.' }
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim() || null
  const source = String(formData.get('source') ?? 'site')
  const segment = asSegment(formData.get('segment'))
  const sessionId = String(formData.get('sessionId') ?? '').trim()

  // 3. Validate email before any CRM write (RFC 5321 max is 254).
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'invalid_email' }
  }

  // 4. Email-first find-or-create. Dual-intent (buyer newsletter + existing
  //    seller/owner) reuses the row — never a second person.
  let personId = 0
  try {
    const native = await ensureNativeLead({
      name,
      email,
      source: 'newsletter',
      tags: ['audience:buyer', 'source:newsletter'],
    })
    if (native.personId > 0) personId = native.personId
  } catch (e) {
    console.warn('[newsletter] ensureNativeLead failed (non-blocking):', e)
  }

  if (personId > 0) {
    try {
      await tagNativeLead({
        personId,
        audience: 'buyer',
        source: 'newsletter',
        originContext: {
          source: 'newsletter',
          sourceLabel: 'Newsletter signup',
          landingPage: '/',
          audience: 'buyer',
        },
      })
    } catch (e) {
      console.warn('[newsletter] canonical tag failed (non-blocking):', e)
    }
  }

  const r = await subscribeToNewsletter({
    email,
    name,
    source,
    segment,
    crmPersonId: personId > 0 ? personId : null,
    // The person just submitted the signup form. Someone who unsubscribed and
    // then deliberately signs up again is opting in, not being resurrected.
    reactivate: 'allowed',
  })
  if (!r.ok) return { ok: false, error: r.error }

  // 5. Stitch the browser (session backfill + rr_vid). Native person id only.
  if (personId > 0) {
    const rrVid = (await cookies()).get('rr_vid')?.value ?? null
    try {
      await stitchFormSubmitIdentity({
        personId,
        email,
        rrVid,
        sessionId: sessionId && UUID_V4_RE.test(sessionId) ? sessionId : null,
      })
    } catch (e) {
      console.warn('[newsletter] visitor stitch failed (non-blocking):', e)
    }
  }

  return { ok: true }
}
