'use server'

import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { findPersonByEmail, sendEvent, addPersonTags, type FubEventPerson } from '@/lib/followupboss'
import { recordPartnerReferral } from '@/app/actions/partnership-revenue'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { canonicallyTagLead, type LeadSource } from '@/lib/canonical-lead-tagger'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { backfillSessionToFub } from '@/lib/visitor-backfill'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function fireCapiLead(args: {
  eventName: 'Lead' | 'ViewContent'
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  eventSourceUrl: string
  contentName: string
  value: number
}): Promise<string | null> {
  const eventId = generateEventId()
  try {
    await fetch(`${SITE_URL}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: args.eventName,
        email: args.email ?? undefined,
        phone: args.phone ?? undefined,
        firstName: args.firstName ?? undefined,
        lastName: args.lastName ?? undefined,
        eventId,
        eventSourceUrl: args.eventSourceUrl,
        customData: {
          content_name: args.contentName,
          value: args.value,
          currency: 'USD',
        },
      }),
    })
    return eventId
  } catch (err) {
    console.warn(`[lead-capture CAPI ${args.eventName}]`, err)
    return null
  }
}

type CampaignInput = {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
}

function websiteSource(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'
}

function partnerSlugFromCampaign(source?: string): 'lender_referral' | 'relocation_referral' | null {
  const value = source?.trim().toLowerCase() ?? ''
  if (!value) return null
  if (value.includes('lender') || value.includes('mortgage')) return 'lender_referral'
  if (value.includes('relocation')) return 'relocation_referral'
  return null
}

export async function trackHomeValuationCta(campaign?: CampaignInput, sessionId?: string): Promise<void> {
  const [session, fubPersonId] = await Promise.all([getSession(), getPersonIdFromCookie()])
  const email = session?.user?.email?.trim() ?? null
  let person: FubEventPerson | null = null
  let resolvedPersonId: number | null = fubPersonId ?? null
  if (email) {
    const existing = await findPersonByEmail(email)
    person = existing ? { id: existing.id } : { emails: [{ value: email }] }
    if (existing?.id) resolvedPersonId = existing.id
  } else if (fubPersonId != null && fubPersonId > 0) {
    person = { id: fubPersonId }
  }
  if (!person) return

  // Stitch the anonymous browsing session to this known person at the moment
  // they click the valuation CTA. Requires a resolved FUB id + a valid session
  // uuid. Non-blocking; this is what lets the dashboard match the visit to a
  // name even when the lead never fills a separate form.
  if (resolvedPersonId && sessionId && UUID_V4_RE.test(sessionId)) {
    void backfillSessionToFub({
      sessionId,
      fubPersonId: resolvedPersonId,
      email: email ?? undefined,
      identifiedVia: 'form_submit',
    }).catch((err) => console.warn('[home-valuation-cta] session stitch failed (non-blocking):', err))
  }

  await sendEvent({
    type: 'Seller Inquiry',
    person,
    source: websiteSource(),
    sourceUrl: `${SITE_URL}/sell/valuation`,
    pageTitle: 'Home Valuation CTA',
    message: 'home-valuation-cta',
    campaign,
  })

  // A home-valuation CTA fires a Seller Inquiry into FUB — tag it into the
  // canonical seller audience (nurture tier; it's a mid-funnel click, not a full
  // submit) so it enters the workflow + is measured instead of landing untagged.
  if (resolvedPersonId) {
    await canonicallyTagLead({
      fubPersonId: resolvedPersonId,
      audience: 'seller',
      source: 'home-valuation',
      tier: 'nurture',
    }).catch(() => {})
  }

  await fireCapiLead({
    eventName: 'ViewContent',
    email,
    eventSourceUrl: `${SITE_URL}/sell/valuation`,
    contentName: 'home_valuation_cta_click',
    value: 0,
  })

  // GA4 Measurement Protocol — fire the CTA-click event distinctly from a
  // form submission so dashboard pivots don't double-count intent. This is
  // a mid-funnel signal, not a generate_lead.
  await fireLeadGenerated({
    event_name: 'home_valuation_cta_click',
    lp_variant: 'home-valuation-cta',
    lead_type: 'cta_click',
    fub_person_id: fubPersonId ?? null,
    extra: {
      utm_source: campaign?.source,
      utm_medium: campaign?.medium,
      utm_campaign: campaign?.campaign,
    },
  })

  const partnerSlug = partnerSlugFromCampaign(campaign?.source)
  if (partnerSlug) {
    await recordPartnerReferral({
      partnerSlug,
      leadSource: 'home_valuation_cta',
      leadIdentifier: email ?? (fubPersonId ? String(fubPersonId) : null),
      campaignSource: campaign?.source ?? null,
      campaignMedium: campaign?.medium ?? null,
      estimatedValue: partnerSlug === 'lender_referral' ? 300 : 2500,
      notes: 'Auto-attributed from valuation CTA campaign source.',
    })
  }
}

export async function submitExitIntentLead(input: {
  email: string
  context?: string
  pageUrl?: string
  campaign?: CampaignInput
  /** Anonymous visitor session id (uuid v4). When present we stitch the prior
   *  browsing history to this person and mark the session identified. */
  sessionId?: string
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Invalid email' }
  }

  const existing = await findPersonByEmail(email)
  const person: FubEventPerson = existing ? { id: existing.id } : { emails: [{ value: email }] }

  const result = await sendEvent({
    type: 'Registration',
    person,
    source: websiteSource(),
    sourceUrl: input.pageUrl?.trim() || `${SITE_URL}/`,
    pageUrl: input.pageUrl?.trim(),
    pageTitle: 'Exit Intent Lead',
    message: input.context?.trim() || 'exit-intent-popup',
    campaign: input.campaign,
  })

  await fireCapiLead({
    eventName: 'Lead',
    email,
    eventSourceUrl: input.pageUrl?.trim() || `${SITE_URL}/`,
    contentName: 'exit_intent_popup',
    value: 100,
  })

  // Canonical tagging — fire-and-forget. Re-look-up the FUB person and apply
  // the canonical schema so this lead shows up in marketing_assignments and
  // the FUB automation rule can enroll them in the nurture workflow.
  void (async () => {
    try {
      const reFound = await findPersonByEmail(email)
      if (reFound?.id) {
        await canonicallyTagLead({
          fubPersonId: reFound.id,
          audience: 'buyer',
          source: 'unknown',
          tier: 'nurture',
        })

        // Stitch the anonymous browsing history to this person and mark the
        // visitor_sessions row identified — what the Marketing ROI dashboard
        // counts as "matched to a name".
        if (input.sessionId && UUID_V4_RE.test(input.sessionId)) {
          await backfillSessionToFub({
            sessionId: input.sessionId,
            fubPersonId: reFound.id,
            email,
            identifiedVia: 'form_submit',
          })
        }
      }
    } catch (err) {
      console.warn('[exit-intent] canonical tagging / session stitch failed (non-blocking):', err)
    }
  })()

  // GA4 Measurement Protocol mirror.
  await fireLeadGenerated({
    lp_variant: 'exit-intent',
    lead_type: 'exit_intent',
    value: 100,
    extra: {
      context: input.context,
      page_url: input.pageUrl,
      utm_source: input.campaign?.source,
      utm_medium: input.campaign?.medium,
      utm_campaign: input.campaign?.campaign,
    },
  })

  const partnerSlug = partnerSlugFromCampaign(input.campaign?.source)
  if (partnerSlug) {
    await recordPartnerReferral({
      partnerSlug,
      leadSource: 'exit_intent_popup',
      leadIdentifier: email,
      campaignSource: input.campaign?.source ?? null,
      campaignMedium: input.campaign?.medium ?? null,
      estimatedValue: partnerSlug === 'lender_referral' ? 300 : 2500,
      notes: 'Auto-attributed from exit intent campaign source.',
    })
  }

  return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'Lead capture failed' }
}

/**
 * Submit a contextual page CTA lead (email/phone capture from city, community, or content pages).
 * Creates a General Inquiry in FUB.
 */
export async function submitPageCTA(input: {
  email?: string
  phone?: string
  leadType?: 'general' | 'buyer' | 'seller' | 'newsletter'
  context?: string
  area?: string
}): Promise<{ error: string | null }> {
  try {
    const email = input.email?.trim().toLowerCase()
    const phone = input.phone?.trim()

    if (!email && !phone) {
      return { error: 'Please provide an email or phone number' }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Please enter a valid email address' }
    }

    let person: FubEventPerson
    if (email) {
      const existing = await findPersonByEmail(email)
      person = existing
        ? { id: existing.id }
        : { emails: [{ value: email }], ...(phone ? { phones: [{ value: phone }] } : {}) }
    } else if (phone) {
      person = { phones: [{ value: phone }] }
    } else {
      return { error: 'Contact information required' }
    }

    const eventType = input.leadType === 'seller' ? 'Seller Inquiry' : 'General Inquiry'

    await sendEvent({
      type: eventType,
      person,
      source: websiteSource(),
      sourceUrl: `${SITE_URL}/`,
      pageTitle: `Page CTA${input.area ? ` — ${input.area}` : ''}`,
      message: input.context ?? 'page-cta',
    })

    const value =
      input.leadType === 'seller' ? 500 :
      input.leadType === 'buyer' ? 300 :
      input.leadType === 'newsletter' ? 50 :
      150
    await fireCapiLead({
      eventName: 'Lead',
      email,
      phone,
      eventSourceUrl: `${SITE_URL}/`,
      contentName: `page_cta_${input.leadType ?? 'general'}${input.area ? `_${input.area}` : ''}`,
      value,
    })

    // Canonical tagging + ledger row.
    void (async () => {
      try {
        if (!email) return
        const found = await findPersonByEmail(email)
        if (found?.id) {
          const audience = input.leadType === 'seller' ? 'seller' : 'buyer'
          const source: LeadSource = input.leadType === 'seller'
            ? 'homepage-cta'
            : input.leadType === 'newsletter'
              ? 'blog-email'
              : 'homepage-cta'
          await canonicallyTagLead({
            fubPersonId: found.id,
            audience,
            source,
          })
        }
      } catch (err) {
        console.warn('[page-cta] canonical tagging failed (non-blocking):', err)
      }
    })()

    // GA4 Measurement Protocol mirror.
    await fireLeadGenerated({
      lp_variant: `page-cta-${input.leadType ?? 'general'}${input.area ? `-${input.area}` : ''}`,
      lead_type: input.leadType === 'seller' ? 'seller' : input.leadType === 'buyer' ? 'buyer' : 'page_cta',
      value,
      extra: {
        area: input.area,
        context: input.context,
      },
    })

    return { error: null }
  } catch (err) {
    console.error('[submitPageCTA]', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

/**
 * Rental property calculator lead — a visitor running the numbers on a rental
 * asks a Ryan Realty broker to pull real rent comps + underwrite a deal. An
 * investor is a buyer-side lead, so audience:'buyer', source:'contact-form',
 * tier:'nurture' (researching, not yet hot), plus 'rental-calculator'/'investor'
 * context tags. Routes to Matt by default (canonicallyTagLead handles routing).
 *
 * Mirrors submitTetherowLead's FUB-event -> Meta-CAPI -> canonical-tags -> GA4
 * pattern, with the property + analysis context in the message.
 */
export async function submitRentalLead(input: {
  name?: string
  email?: string
  phone?: string
  /** Property address from the calculator, when launched from a listing. */
  propertyLabel?: string
  listingKey?: string
  /** One-line analysis context, e.g. "$650K · cash flow -$1,431/mo · cap 3.7%". */
  contextNote?: string
  pageUrl?: string
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email?.trim().toLowerCase()
  const phone = input.phone?.trim()
  if (!email && !phone) return { ok: false, error: 'Email or phone is required' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address' }
  }
  try {
    const fullName = input.name?.trim() || ''
    const nameParts = fullName.split(/\s+/).filter(Boolean)
    const firstName = nameParts[0] || undefined
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

    let person: FubEventPerson
    if (email) {
      const existing = await findPersonByEmail(email)
      person = existing
        ? { id: existing.id }
        : {
            emails: [{ value: email }],
            ...(phone ? { phones: [{ value: phone }] } : {}),
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
          }
    } else {
      person = {
        phones: [{ value: phone! }],
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      }
    }

    const pageUrl = input.pageUrl?.trim() || `${SITE_URL}/tools/rental-property-calculator`
    const message = `Rental calculator lead. ${[input.propertyLabel, input.contextNote].filter(Boolean).join(' · ') || 'standalone tool'}`

    const result = await sendEvent({
      type: 'General Inquiry',
      person,
      source: websiteSource(),
      sourceUrl: pageUrl,
      pageUrl,
      pageTitle: 'Rental Property Calculator',
      message,
    })

    await fireCapiLead({
      eventName: 'Lead', email, phone, firstName, lastName,
      eventSourceUrl: pageUrl,
      contentName: 'rental_calculator_lead',
      value: 300,
    })

    // Canonical tags MUST be awaited on serverless (the lambda freezes on return).
    try {
      if (email) {
        const found = await findPersonByEmail(email)
        if (found?.id) {
          await canonicallyTagLead({
            fubPersonId: found.id,
            audience: 'buyer',
            source: 'contact-form',
            tier: 'nurture',
            originContext: {
              source: 'rental-calculator',
              sourceLabel: 'Rental property calculator',
              landingPage: pageUrl,
              audience: 'buyer',
              tier: 'nurture',
              ...(input.propertyLabel || input.contextNote
                ? { want: [input.propertyLabel, input.contextNote].filter(Boolean).join(' · ') }
                : {}),
            },
          })
          await addPersonTags(found.id, ['rental-calculator', 'investor'])
        }
      }
    } catch (err) {
      console.warn('[rental-lead] canonical tagging failed (non-blocking):', err)
    }

    await fireLeadGenerated({
      lp_variant: 'rental-calculator',
      lead_type: 'buyer',
      value: 300,
      extra: { listing_key: input.listingKey, property: input.propertyLabel },
    })

    return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'Lead capture failed' }
  } catch (err) {
    console.error('[submitRentalLead]', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}

/**
 * Tetherow landing-page lead capture (buyer showings/alerts/guide + seller
 * valuation + exit-intent). The /api/cma POST endpoint calls this.
 *
 * BUG FIX 2026-05-31: all 5 Tetherow forms POSTed to /api/cma, which had no
 * top-level route handler (only /api/cma/[slug]/* existed) — so every luxury
 * paid-traffic lead 404'd and was silently lost while the form showed a fake
 * green success. This restores capture: FUB event -> Meta CAPI -> CANONICAL
 * tags (audience:seller|buyer — NOT the old 'seller-intent' string that never
 * triggered the FUB workflow) -> GA4 mirror. Tetherow is high-intent paid
 * traffic, so tier='hot'.
 */
export async function submitTetherowLead(input: {
  intent: 'buyer' | 'seller'
  name?: string
  email?: string
  phone?: string
  resort?: string
  campaign?: string
  /** comma-separated context tags from the form (resort:*, lp:*, etc.) */
  contextTags?: string
  // seller context
  address?: string
  subdivision?: string
  timing?: string
  bedrooms?: string
  bathrooms?: string
  // buyer context
  property?: string
  pageUrl?: string
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email?.trim().toLowerCase()
  const phone = input.phone?.trim()
  if (!email && !phone) return { ok: false, error: 'Email or phone is required' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address' }
  }
  try {
    const fullName = input.name?.trim() || ''
    const nameParts = fullName.split(/\s+/).filter(Boolean)
    const firstName = nameParts[0] || undefined
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

    let person: FubEventPerson
    if (email) {
      const existing = await findPersonByEmail(email)
      person = existing
        ? { id: existing.id }
        : {
            emails: [{ value: email }],
            ...(phone ? { phones: [{ value: phone }] } : {}),
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
          }
    } else {
      person = {
        phones: [{ value: phone! }],
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      }
    }

    const isSeller = input.intent === 'seller'
    const eventType = isSeller ? 'Seller Inquiry' : 'General Inquiry'
    const ctxBits = isSeller
      ? [input.address, input.subdivision, input.timing,
         input.bedrooms ? `${input.bedrooms} bd` : '', input.bathrooms ? `${input.bathrooms} ba` : '']
      : [input.property]
    const message = `Tetherow ${input.intent} lead. ${ctxBits.filter(Boolean).join(' · ') || 'no extra detail'}`
    const pageUrl = input.pageUrl?.trim() || `${SITE_URL}/lp/tetherow/`

    const result = await sendEvent({
      type: eventType,
      person,
      source: websiteSource(),
      sourceUrl: pageUrl,
      pageUrl,
      pageTitle: 'Tetherow Landing Page',
      message,
    })

    // Luxury Tetherow paid leads are high-value.
    const value = isSeller ? 1000 : 600
    await fireCapiLead({
      eventName: 'Lead', email, phone, firstName, lastName,
      eventSourceUrl: pageUrl,
      contentName: `tetherow_${input.intent}`,
      value,
    })

    // Canonical tags (correct audience trigger) + preserved resort context.
    // MUST be awaited: on Vercel serverless the lambda freezes the instant the
    // handler returns, so a fire-and-forget here was being killed mid-flight —
    // leads landed with only the bare sendEvent default tag and lost their
    // resort:tetherow / audience:seller tagging. Awaiting guarantees the tags
    // write before the function returns. The inner try/catch preserves the
    // original intent (a tagging blip never fails the capture itself).
    try {
      if (email) {
        const found = await findPersonByEmail(email)
        if (found?.id) {
          await canonicallyTagLead({
            fubPersonId: found.id,
            audience: isSeller ? 'seller' : 'buyer',
            source: isSeller ? 'seller-lp' : 'buyer-lp',
            tier: 'hot',
            ...(isSeller && input.address ? { address: input.address, state: 'OR' } : {}),
          })
          // Keep the resort/campaign context tags, but DROP the legacy
          // 'seller-intent'/'buyer-intent' strings (they never triggered the FUB
          // workflow — canonicallyTagLead applies the real audience:* trigger).
          const ctx = (input.contextTags ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t && !/-intent$/.test(t))
          ctx.push('resort:tetherow', 'lp:tetherow-landing-v1')
          await addPersonTags(found.id, [...new Set(ctx)])
        }
      }
    } catch (err) {
      console.warn('[tetherow-lead] canonical tagging failed (non-blocking):', err)
    }

    await fireLeadGenerated({
      lp_variant: 'tetherow-landing-v1',
      lead_type: isSeller ? 'seller' : 'buyer',
      value,
      extra: { resort: input.resort ?? 'tetherow', campaign: input.campaign, intent: input.intent },
    })

    return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'Lead capture failed' }
  } catch (err) {
    console.error('[submitTetherowLead]', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
