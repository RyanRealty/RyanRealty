'use server'

import { siteOrigin } from '@/lib/site-origin'
import { after } from 'next/server'
import { cookies } from 'next/headers'
import { generateEventId } from '@/lib/meta-pixel-helpers'
import { sendEvent } from '@/lib/crm/send-event'
import { sendContactNotification } from '@/lib/resend'
import { canonicallyTagLead } from '@/lib/canonical-lead-tagger'
import { resolvePaidAttributionTags } from '@/lib/crm/lead-source'
import { stitchFormSubmitIdentity } from '@/lib/visitor-backfill'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { visitorCapiConsent } from '@/lib/meta-capi-visitor'
import { ensureNativeLead } from '@/lib/data/crm/ensureNativeLead'
import { TRAP } from './_v3/constants'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SOURCE_URL = `${siteOrigin()}/buy/concessions`
const DOOR = 'buyer-lp'

export type ConcessionsFormState = { error?: string; success?: boolean; eventId?: string }

function creativeTag(cr: string | undefined): string | undefined {
  const slug = (cr ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `creative:${slug}` : undefined
}

export async function submitConcessionsLead(formData: FormData): Promise<ConcessionsFormState> {
  const name = formData.get('name')?.toString()?.trim() ?? ''
  const email = formData.get('email')?.toString()?.trim() ?? ''
  const phone = formData.get('phone')?.toString()?.trim() ?? ''
  const timeline = formData.get('timeline')?.toString()?.trim() ?? ''
  const sessionId = formData.get('sessionId')?.toString()?.trim() ?? ''
  const smsConsent = formData.get('smsConsent') === 'yes'
  const adMatchConsent = formData.get('adMatchConsent') === 'yes'
  const honeypot = (formData.get(TRAP.name)?.toString() ?? '').trim() !== ''
  const cr = formData.get('cr')?.toString()?.trim() ?? ''
  const lpSource = formData.get('lp_source')?.toString()?.trim() || undefined
  const lpMedium = formData.get('lp_medium')?.toString()?.trim() || undefined
  const lpCampaign = formData.get('lp_campaign')?.toString()?.trim() || undefined
  const lpContent = formData.get('lp_content')?.toString()?.trim() || undefined
  const lpTerm = formData.get('lp_term')?.toString()?.trim() || undefined
  const gclid = formData.get('gclid')?.toString()?.trim() || undefined
  const fbclid = formData.get('fbclid')?.toString()?.trim() || undefined

  if (!name) return { error: 'Please enter your name' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email address' }

  const paidTags = resolvePaidAttributionTags({
    utmSource: lpSource,
    utmMedium: lpMedium,
    utmCampaign: lpCampaign,
    utmContent: lpContent,
  })
  const creative = creativeTag(cr)
  const extraTags = [...paidTags, ...(creative ? [creative] : [])]
  const details = [
    'intent=buy-concessions',
    timeline ? `timeline=${timeline}` : null,
    cr ? `cr=${cr}` : null,
    gclid ? `gclid=${gclid}` : null,
    fbclid ? `fbclid=${fbclid}` : null,
  ]
    .filter(Boolean)
    .join(' | ')

  const res = await sendEvent({
    type: 'General Inquiry',
    person: {
      firstName: name.split(/\s+/)[0] ?? undefined,
      lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
      emails: [{ value: email }],
      ...(phone ? { phones: [{ value: phone }] } : {}),
    },
    source: DOOR,
    sourceUrl: SOURCE_URL,
    pageUrl: SOURCE_URL,
    pageTitle: 'Seller concessions for Bend buyers',
    message: details,
    campaign: {
      source: lpSource ?? 'landing_page',
      medium: lpMedium ?? 'website',
      campaign: lpCampaign ?? 'buy-concessions',
      content: lpContent ?? cr ?? 'buyer',
      ...(lpTerm ? { term: lpTerm } : {}),
    },
    screen: { honeypot },
  })

  let capturedPersonId: number | null = res.ok ? res.personId : null
  let suspect = res.ok ? res.suspect : false
  if (!res.ok) {
    try {
      const native = await ensureNativeLead({
        name,
        email,
        phone,
        source: DOOR,
        tags: [`audience:buyer`, `source:${DOOR}`, 'fub-fallback', ...extraTags],
        screen: { honeypot, note: details },
      })
      if (!native.created && native.personId === 0) {
        return { error: res.error ?? 'Failed to send' }
      }
      capturedPersonId = native.personId > 0 ? native.personId : null
      suspect = native.quality?.suspect === true
    } catch (e) {
      console.warn('[buy-concessions] native fallback failed:', e)
      return { error: res.error ?? 'Failed to send' }
    }
  }

  await sendContactNotification({
    name,
    email,
    phone,
    inquiryType: suspect ? 'Likely script, tagged quality:suspect (Buyer concessions)' : 'Buyer concessions',
    message: details,
  }).catch(() => {})

  if (suspect) {
    return { success: true }
  }

  after(async () => {
    try {
      if (capturedPersonId) {
        if (adMatchConsent) {
          try {
            const { enrichNativeLead } = await import('@/lib/data/crm/ensureNativeLead')
            const { adMatchConsentCustom } = await import('@/lib/identity/form-ad-consent')
            await enrichNativeLead({
              personId: capturedPersonId,
              custom: adMatchConsentCustom(true, new Date().toISOString()),
            })
          } catch (e) {
            console.warn('[buy-concessions] ad-match consent write failed:', e)
          }
        }
        await canonicallyTagLead({
          fubPersonId: capturedPersonId,
          audience: 'buyer',
          source: 'buyer-lp',
          extraTags,
          originContext: {
            source: DOOR,
            sourceLabel: 'Buy concessions',
            landingPage: SOURCE_URL,
            audience: 'buyer',
            utmSource: lpSource,
            utmMedium: lpMedium,
            utmCampaign: lpCampaign,
            utmContent: lpContent,
            want: timeline ? `timeline=${timeline}` : undefined,
            extra: [cr && `cr=${cr}`, gclid && `gclid=${gclid}`, fbclid && `fbclid=${fbclid}`]
              .filter(Boolean)
              .join(' '),
          },
        })
        const { autoEnrollByPersonId } = await import('@/lib/crm/enroll')
        await autoEnrollByPersonId(capturedPersonId, { smsConsent }).catch((e: unknown) =>
          console.warn('[buy-concessions] instant auto-enroll failed:', e),
        )
        const rrVid = (await cookies()).get('rr_vid')?.value ?? null
        await stitchFormSubmitIdentity({
          personId: capturedPersonId,
          email,
          rrVid,
          sessionId: sessionId && UUID_V4_RE.test(sessionId) ? sessionId : null,
        })
      }
    } catch (err) {
      console.warn('[buy-concessions] canonical tagging failed (non-blocking):', err)
    }
  })

  const eventId = generateEventId()
  const sharing = await visitorCapiConsent()
  if (sharing.allowed) {
    await fetch(`${siteOrigin()}/api/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        email,
        phone: phone || undefined,
        firstName: name.split(/\s+/)[0] ?? undefined,
        lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
        eventId,
        consentCookie: sharing.consentCookie,
        secGpc: sharing.secGpc,
        customData: {
          content_name: 'buy_concessions',
          lead_type: 'buyer_question',
          form_id: 'buy_concessions',
        },
        eventSourceUrl: SOURCE_URL,
      }),
    }).catch((err) => {
      console.warn('[buy-concessions] CAPI call failed:', err)
    })
  }

  await fireLeadGenerated({
    lp_variant: 'buy-concessions',
    lead_type: 'buyer_question',
    form_id: 'buy_concessions',
    event_id: eventId,
    crm_person_id: capturedPersonId,
  })

  return { success: true, eventId }
}
