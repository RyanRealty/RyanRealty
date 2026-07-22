'use server'

/**
 * Out-of-area city referral capture (W12 referral tier).
 *
 * The /oregon/[city] form for visitors buying or selling OUTSIDE the Central
 * Oregon home market. Reuses the consent-guarded native lead-create path
 * (ensureNativeLead, which never touches suppressions and never subscribes a
 * channel) and tags the lead `geo:out-of-area` + `referral:candidate`.
 *
 * NOTHING auto-sends to the lead:
 *   - no canonicallyTagLead / autoEnrollByFubId call here, and
 *   - the referral:candidate tag hard-gates autoEnrollPerson
 *     (lib/crm/enroll.ts) so the 15-min catch-all cron cannot enroll them
 *     into a drip either.
 * The only automated messages are INTERNAL: a queued broker alert and a
 * follow-up task, so the handoff happens by hand from the referral queue
 * (/admin/crm/referrals).
 *
 * Email-only form by design. No phone field, so no SMS consent surface is
 * required (A2P gate scripts/check-sms-consent-compliance.mjs).
 */

import { ensureNativeLead, enrichNativeLead, createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { fireLeadGenerated } from '@/lib/lead-tracking'
import { getOutOfAreaCity } from '@/lib/data/geo/getOutOfAreaCities'
import { GEO_OUT_OF_AREA_TAG, REFERRAL_CANDIDATE_TAG } from '@/lib/referral-geo'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type OutOfAreaReferralInput = {
  /** Route slug of the city page the form sits on, e.g. 'klamath-falls'. */
  citySlug: string
  name?: string
  email: string
  /** What they are looking for. Free text, optional. */
  notes?: string
  /** Honeypot. Humans never see it; a filled value gets a fake success. */
  company?: string
}

export async function submitOutOfAreaReferral(
  input: OutOfAreaReferralInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email?.trim().toLowerCase() ?? ''
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  // Honeypot: report success, create nothing.
  if (input.company?.trim()) return { ok: true }

  const slug = input.citySlug?.trim().toLowerCase() ?? ''
  const city = slug ? await getOutOfAreaCity(slug) : null
  if (!city) return { ok: false, error: 'City not recognized. Try again from the city page.' }

  try {
    const tags = [
      'audience:buyer',
      'buyer:nurture',
      'source:out-of-area-lp',
      GEO_OUT_OF_AREA_TAG,
      REFERRAL_CANDIDATE_TAG,
      `city-interest:${city.slug}`,
    ]
    const { personId } = await ensureNativeLead({
      name: input.name,
      email,
      source: 'out-of-area-lp',
      tags,
      assignedBroker: 'matt',
    })
    if (!personId) return { ok: false, error: 'Something went wrong. Please try again.' }

    const notes = input.notes?.trim().slice(0, 1000) ?? ''
    await enrichNativeLead({
      personId,
      custom: { outOfAreaCity: city.name },
      assignedBroker: 'matt',
      originNote: {
        title: 'Out-of-area referral request',
        body: [
          `Market: ${city.name}, Oregon (outside the Central Oregon service area).`,
          notes ? `What they want: ${notes}` : null,
          `Source page: /oregon/${city.slug}`,
          'Routing: referral queue (/admin/crm/referrals). No drip enrolled. Connect them with a local broker by hand.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    })

    // Internal follow-up only: a task for the broker, due same business day.
    await createNativeTask({
      personId,
      name: `Referral handoff: connect ${city.name} lead with a local broker`,
      type: 'Referral',
      dueInMinutes: 240,
      assignedBroker: 'matt',
    })

    // Internal broker alert (queued SMS to the broker's own phone, the same
    // mechanism every lead path uses). Never a message to the lead.
    await queueBrokerAlert({
      broker: 'matt',
      personId,
      kind: 'new-lead',
      body: [
        `Out-of-area referral lead: ${input.name?.trim() || email} wants ${city.name}, Oregon.`,
        'No drip enrolled. Refer to a local broker from the referral queue.',
        `Open the lead: ryan-realty.com/admin/crm/${personId}`,
      ].join('\n'),
    }).catch(() => {})

    // GA4 Measurement Protocol mirror (analytics, not a message).
    await fireLeadGenerated({
      lp_variant: 'out-of-area-city',
      lead_type: 'buyer',
      value: 100,
      fub_person_id: personId,
      extra: { city: city.slug, referral: 'out-of-area' },
    }).catch(() => {})

    return { ok: true }
  } catch (err) {
    console.error('[submitOutOfAreaReferral]', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
