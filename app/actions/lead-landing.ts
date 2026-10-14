'use server'

import { siteOrigin } from '@/lib/site-origin'
import { sendEvent, type LeadEventPerson } from '@/lib/crm/send-event'
import { sendContactNotification } from '@/lib/resend'
import type { LeadLandingAudience } from '@/lib/lead-landing-content'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { signupAttribution } from '@/lib/crm/visit-attribution'
import {
  attributionParamsFromSearch,
  attributionQueryString,
  fireLeadGenerated,
  mergeLeadAttribution,
  persistGaClientIdFromCookies,
  type LeadAttributionParams,
} from '@/lib/lead-tracking'
import type { LeadFormId, LeadType } from '@/lib/analytics/lead-event'
import { visitorCapiConsent } from '@/lib/meta-capi-visitor'
import { stitchFormSubmitIdentity } from '@/lib/visitor-backfill'
import { ensureNativeLead, enrichNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { adMatchConsentCustom } from '@/lib/identity/form-ad-consent'
import { cookies, headers } from 'next/headers'

const SITE_URL = siteOrigin()

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type LpContextInput = {
  lp_variant?: string
  lp_source?: string
  lp_medium?: string
  lp_campaign?: string
  lp_content?: string
  lp_term?: string
  gclid?: string
  fbclid?: string
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
  /** The page's own link: utm_* / gclid / fbclid on the address the form is
   *  submitted from (getLpContext). A visitor who clicked around first is
   *  credited to the visit's landing link on the server instead
   *  (lib/crm/visit-attribution.ts). */
  lpContext?: LpContextInput
  /** Anonymous visitor session id (uuid v4) from localStorage. When present,
   *  we stitch this lead's prior browsing history to the CRM person and mark
   *  the visitor_sessions row identified — which is what the Marketing ROI
   *  dashboard counts as "matched to a name". */
  sessionId?: string
  /** Override generate_lead form_id. Existing /buy/[intent] callers stay `lead_landing`. */
  formId?: LeadFormId
  /** Override generate_lead lead_type. Existing buyer callers stay `buyer_question`. */
  leadType?: LeadType
  /** Override generate_lead lp_variant. Existing callers stay `lead-landing-${audience}`. */
  lpVariant?: string
  /** #465 EU hashed-match box. Stored on the person; never on generate_lead. */
  adMatchConsent?: boolean
}

function lpContextToAttribution(lp?: LpContextInput): LeadAttributionParams {
  if (!lp) return {}
  const out: LeadAttributionParams = {}
  if (lp.lp_source?.trim()) out.lp_source = lp.lp_source.trim()
  if (lp.lp_medium?.trim()) out.lp_medium = lp.lp_medium.trim()
  if (lp.lp_campaign?.trim()) out.lp_campaign = lp.lp_campaign.trim()
  if (lp.lp_content?.trim()) out.lp_content = lp.lp_content.trim()
  if (lp.lp_term?.trim()) out.lp_term = lp.lp_term.trim()
  if (lp.gclid?.trim()) out.gclid = lp.gclid.trim()
  if (lp.fbclid?.trim()) out.fbclid = lp.fbclid.trim()
  return out
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
    const person: LeadEventPerson = {
      firstName: nameParts[0] ?? undefined,
      lastName: nameParts.slice(1).join(' ') || undefined,
      emails: [{ value: email }],
      ...(phone ? { phones: [{ value: phone }] } : {}),
    }

    // Paid-channel attribution: channel:*, campaign:* and ad-content:* from the
    // link that started the visit the submit happens in, else the page's utm
    // (Matt 2026-10-09, "Visit they signed up in"; lib/crm/visit-attribution.ts).
    // buyer- and seller-lead-attribution match a lead to the post or ad that
    // sent it by these tags and nothing else, and this form is the live buyer LP
    // (/buy/<intent>, /buy/leverage; no page renders a seller config). Empty
    // when neither carried a utm_source. Started here and awaited after the CRM
    // write, so the visit read adds nothing to the submit's wait.
    const signupPending = signupAttribution({
      page: {
        source: input.lpContext?.lp_source,
        medium: input.lpContext?.lp_medium,
        campaign: input.lpContext?.lp_campaign,
        content: input.lpContext?.lp_content,
      },
      sessionId: input.sessionId,
    })

    let refererAttr: LeadAttributionParams = {}
    try {
      const referer = (await headers()).get('referer') ?? ''
      if (referer) refererAttr = attributionParamsFromSearch(new URL(referer).searchParams)
    } catch {
      // malformed referer
    }
    const attribution = mergeLeadAttribution(refererAttr, lpContextToAttribution(input.lpContext))
    const attrQuery = attributionQueryString(attribution)

    const eventType = input.audience === 'seller' ? 'Seller Inquiry' : 'General Inquiry'
    const siteUrl = siteOrigin()
    const sourceUrl = attrQuery ? `${siteUrl}${input.pagePath}?${attrQuery}` : `${siteUrl}${input.pagePath}`
    const formId = input.formId ?? 'lead_landing'
    const leadType: LeadType =
      input.leadType ??
      (input.audience === 'seller'
        ? /valu|worth|cma|apprais/i.test(input.leadIntent)
          ? 'seller_valuation'
          : 'seller_listing'
        : 'buyer_question')
    const lpVariant = input.lpVariant ?? `lead-landing-${input.audience}`
    const details = [
      `intent=${input.leadIntent}`,
      timeframe ? `timeframe=${timeframe}` : null,
      message ? `message=${message}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    // crm_people.source is the door, not the site host (FUNNEL-4, 2026-09-23).
    const leadDoor = input.audience === 'seller' ? 'seller-lp' : 'buyer-lp'
    const result = await sendEvent({
      type: eventType,
      person,
      // The door (FUNNEL-4), the same label the fallback and the canonical tag write.
      source: leadDoor,
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
    const paidTags = (await signupPending).tags
    if (!result.ok) {
      // ─── Native-capture fallback on a CRM push failure (CONTACT360 Phase 0.2)
      // The CRM push failed (likely a CRM outage) — without a native record this
      // buyer/seller LP lead would be dropped entirely. Capture it in crm_people
      // + crm_contact_points so the lead is tracked, then still surface the error
      // so the visitor is prompted to retry (the native row dedupes on retry).
      try {
        const native = await ensureNativeLead({
          name,
          email,
          phone,
          source: leadDoor,
          tags: [`audience:${input.audience}`, `source:${leadDoor}`, 'fub-fallback', ...paidTags],
        })
        if (native.created || native.personId > 0) {
          console.warn(
            `[lead-landing] CRM push failed. native fallback lead ${native.created ? 'created' : 'reused'} crm person ${native.personId}`,
          )
          await persistGaClientIdFromCookies(native.personId)
        }
      } catch (e) {
        console.warn('[lead-landing] native fallback lead failed:', e)
      }
      return { error: result.error ?? 'Could not submit request right now' }
    }

    const eventId = generateEventId()
    {
      const sharing = await visitorCapiConsent()
      if (sharing.allowed) {
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
            consentCookie: sharing.consentCookie,
            secGpc: sharing.secGpc,
            customData: {
              content_name: formId,
              lead_type: leadType,
              intent: input.leadIntent,
            },
          }),
        }).catch((err) => {
          console.warn('[Lead Landing CAPI]', err)
        })
      }
    }

    await sendContactNotification({
      name,
      email,
      phone,
      inquiryType: input.audience === 'seller' ? 'Seller Lead Landing' : 'Buyer Lead Landing',
      message: `${input.pageTitle} | ${details || `intent=${input.leadIntent}`}`,
    }).catch((err) => console.error('[lead-landing] sendContactNotification failed:', err))

    // Canonical tagging + session stitch so dashboards see this lead alongside
    // the gold-standard LP submissions. Gates on the native person id sendEvent
    // returned (the old CRM findPersonByEmail re-lookup was a dead no-op
    // post-decommission). MUST be awaited: on Vercel serverless the lambda
    // freezes the instant the handler returns, so a fire-and-forget IIFE gets
    // killed mid-flight. The try/catch keeps a blip from failing the capture.
    try {
      if (result.personId) {
        await canonicallyTagLead({
          fubPersonId: result.personId,
          audience: input.audience === 'seller' ? 'seller' : 'buyer',
          source: leadDoor,
          extraTags: paidTags,
        })

        // Stitch via rr_vid always. Session-only writes missed submits that
        // had no tracker session yet.
        const rrVid = (await cookies()).get('rr_vid')?.value ?? null
        await stitchFormSubmitIdentity({
          personId: result.personId,
          email,
          rrVid,
          sessionId: input.sessionId && UUID_V4_RE.test(input.sessionId) ? input.sessionId : null,
        })
        if (input.adMatchConsent != null) {
          await enrichNativeLead({
            personId: result.personId,
            custom: adMatchConsentCustom(input.adMatchConsent === true, new Date().toISOString()),
          })
        }
      }
    } catch (err) {
      console.warn('[lead-landing] canonical tagging / session stitch failed (non-blocking):', err)
    }

    // First-touch `_ga` on the contact, then the one generate_lead.
    await persistGaClientIdFromCookies(result.personId)
    await fireLeadGenerated({
      lp_variant: lpVariant,
      lead_type:
        input.leadType ??
        (input.audience === 'seller'
          ? /valu|worth|cma|apprais/i.test(input.leadIntent)
            ? 'seller_valuation'
            : 'seller_listing'
          : 'buyer_question'),
      form_id: input.formId ?? 'lead_landing',
      event_id: eventId,
      crm_person_id: result.personId,
      attribution,
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
