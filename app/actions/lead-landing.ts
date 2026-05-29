'use server'

import { sendEvent, findPersonByEmail, type FubEventPerson } from '@/lib/followupboss'
import { sendContactNotification } from '@/lib/resend'
import type { LeadLandingAudience } from '@/lib/lead-landing-content'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { backfillSessionToFub } from '@/lib/visitor-backfill'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function websiteSource(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'
}

type LpContextInput = {
  lp_variant?: string
  lp_source?: string
  lp_medium?: string
  lp_campaign?: string
  lp_content?: string
  lp_term?: string
}

type SubmitLeadLandingInput = {
  audience: LeadLandingAudience
  pageTitle: string
  pagePath: string
  leadIntent: string
  name: string
  email: string
  phone?: string
  timeframe?: string
  message?: string
  /** Real first-touch attribution captured client-side (utm_* from the URL +
   *  persisted rr_lp_context). When the visitor arrived from a Facebook ad,
   *  lp_source='facebook' — so the FUB person carries the true origin instead
   *  of a hardcoded 'landing_page'. */
  lpContext?: LpContextInput
  /** Anonymous visitor session id (uuid v4) from localStorage. When present,
   *  we stitch this lead's prior browsing history to the FUB person and mark
   *  the visitor_sessions row identified — which is what the Marketing ROI
   *  dashboard counts as "matched to a name". */
  sessionId?: string
}

export async function submitLeadLandingForm(input: SubmitLeadLandingInput): Promise<{ error: string | null }> {
  try {
    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    const phone = input.phone?.trim() || ''
    const timeframe = input.timeframe?.trim() || ''
    const message = input.message?.trim() || ''

    if (!name) return { error: 'Please enter your name' }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email address' }

    const nameParts = name.split(/\s+/)
    const person: FubEventPerson = {
      firstName: nameParts[0] ?? undefined,
      lastName: nameParts.slice(1).join(' ') || undefined,
      emails: [{ value: email }],
      ...(phone ? { phones: [{ value: phone }] } : {}),
    }

    const eventType = input.audience === 'seller' ? 'Seller Inquiry' : 'General Inquiry'
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
    const sourceUrl = `${siteUrl}${input.pagePath}`
    const details = [
      `intent=${input.leadIntent}`,
      timeframe ? `timeframe=${timeframe}` : null,
      message ? `message=${message}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const result = await sendEvent({
      type: eventType,
      person,
      source: websiteSource(),
      sourceUrl,
      pageUrl: sourceUrl,
      pageTitle: input.pageTitle,
      message: details || `intent=${input.leadIntent}`,
      campaign: {
        source: input.lpContext?.lp_source ?? 'landing_page',
        medium: input.lpContext?.lp_medium ?? 'website',
        campaign: input.lpContext?.lp_campaign ?? input.leadIntent,
        content: input.lpContext?.lp_content ?? input.audience,
        ...(input.lpContext?.lp_term ? { term: input.lpContext.lp_term } : {}),
      },
    })
    if (!result.ok) return { error: result.error ?? 'Could not submit request right now' }

    const eventId = generateEventId()
    const leadValue = input.audience === 'seller' ? 500 : 300
    fetch(`${SITE_URL}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        email,
        phone: phone || undefined,
        firstName: nameParts[0] ?? undefined,
        lastName: nameParts.slice(1).join(' ') || undefined,
        eventId,
        eventSourceUrl: sourceUrl,
        customData: {
          content_name: `lead_landing_${input.audience}`,
          lead_type: input.audience === 'seller' ? 'seller_inquiry' : 'buyer_inquiry',
          intent: input.leadIntent,
          value: leadValue,
          currency: 'USD',
        },
      }),
    }).catch((err) => {
      console.warn('[Lead Landing CAPI]', err)
    })

    await sendContactNotification({
      name,
      email,
      phone,
      inquiryType: input.audience === 'seller' ? 'Seller Lead Landing' : 'Buyer Lead Landing',
      message: `${input.pageTitle} | ${details || `intent=${input.leadIntent}`}`,
    }).catch((err) => console.error('[lead-landing] sendContactNotification failed:', err))

    // Canonical tagging + session stitch so dashboards see this lead alongside
    // the gold-standard LP submissions. Fire-and-forget; failures never block
    // the response.
    void (async () => {
      try {
        const found = await findPersonByEmail(email)
        if (found?.id) {
          await canonicallyTagLead({
            fubPersonId: found.id,
            audience: input.audience === 'seller' ? 'seller' : 'buyer',
            source: input.audience === 'seller' ? 'seller-lp' : 'buyer-lp',
          })

          // Stitch the anonymous browsing history to this FUB person and mark
          // the visitor_sessions row identified. This is the join that ties a
          // Facebook ad click (utm_source=facebook, stored on the session) to a
          // real name — and what the Marketing ROI dashboard counts as
          // "matched to a name". Mirrors the buyer LP gold standard.
          if (input.sessionId && UUID_V4_RE.test(input.sessionId)) {
            await backfillSessionToFub({
              sessionId: input.sessionId,
              fubPersonId: found.id,
              email,
              identifiedVia: 'form_submit',
            })
          }
        }
      } catch (err) {
        console.warn('[lead-landing] canonical tagging / session stitch failed (non-blocking):', err)
      }
    })()

    // GA4 Measurement Protocol mirror.
    await fireLeadGenerated({
      lp_variant: `lead-landing-${input.audience}`,
      lead_type: input.audience === 'seller' ? 'seller' : 'buyer',
      value: leadValue,
      event_id: eventId,
      extra: {
        intent: input.leadIntent,
        page_path: input.pagePath,
        timeframe: timeframe || undefined,
      },
    })

    return { error: null }
  } catch (err) {
    console.error('[submitLeadLandingForm]', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
