'use server'

/**
 * getContactNextStep — resolve the record card's one-click next step for a
 * contact (Stream 3).
 *
 * Matt's rule: the recommended action is home-driven.
 *   owns a home      → Send CMA
 *   does not own one → Send newsletter
 *
 * "Owns a home" mirrors the lead page's resolution exactly: read the person's
 * geocoded point (fub_person_geo via their fub_legacy_id), run the proximity
 * candidate finder (getOwnedHomeMatches), and treat ownership as confirmed only
 * when a candidate's street address actually matches the owner's (addressMatched).
 * A near miss (proximity but no address match) is NOT ownership, so we never
 * recommend a CMA on a neighbor's house.
 *
 * Access-guarded with the same pattern as the rest of the CRM actions. Never
 * throws: any failure resolves to the safe default (newsletter).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { getOwnedHomeMatches, type OwnedHomeMatch } from '@/lib/data/crm/getOwnedHome'
import { decideContactNextStep, type ContactNextStep } from '@/lib/crm/next-step'

export type ContactOwnedHomeSummary = {
  listingKey: string | null
  address: string
  city: string | null
  status: string | null
  photoUrl: string | null
  listPrice: number | null
  closePrice: number | null
  closeDate: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
}

export type ContactNextStepResult = {
  ok: boolean
  ownsHome: boolean
  step: ContactNextStep
  /** The confirmed owned home (address-matched), or null when none. */
  ownedHome: ContactOwnedHomeSummary | null
  error?: string
}

/** The safe default when we cannot confirm ownership: recommend the newsletter. */
function defaultResult(error?: string): ContactNextStepResult {
  return {
    ok: !error,
    ownsHome: false,
    step: decideContactNextStep({ ownsHome: false }),
    ownedHome: null,
    error,
  }
}

function summarize(match: OwnedHomeMatch): ContactOwnedHomeSummary {
  return {
    listingKey: match.listingKey,
    address: match.address,
    city: match.city,
    status: match.status,
    photoUrl: match.photoUrl,
    listPrice: match.listPrice,
    closePrice: match.closePrice,
    closeDate: match.closeDate,
    beds: match.beds,
    baths: match.baths,
    sqft: match.sqft,
    yearBuilt: match.yearBuilt,
  }
}

export async function getContactNextStep(personId: number): Promise<ContactNextStepResult> {
  try {
    if (!personId || !Number.isFinite(personId)) return defaultResult('Bad personId')

    const access = await getCrmAccess()
    if (!access) return defaultResult('Unauthorized')
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return defaultResult(scoped.error)

    const sb = createServiceClient()
    const { data: person } = await sb
      .from('crm_people')
      .select('id,fub_legacy_id')
      .eq('id', personId)
      .maybeSingle()
    if (!person) return defaultResult('Person not found')

    const fubId = (person.fub_legacy_id as number | null) ?? null
    if (!fubId) return defaultResult()

    // Resolve the geocoded point + owner address the same way the lead page does.
    const { data: geo } = await sb
      .from('fub_person_geo')
      .select('latitude,longitude,formatted_address,source_address')
      .eq('fub_person_id', fubId)
      .maybeSingle()
    const lat = typeof geo?.latitude === 'number' ? geo.latitude : null
    const lng = typeof geo?.longitude === 'number' ? geo.longitude : null
    const ownerAddress = (geo?.formatted_address as string | null) ?? (geo?.source_address as string | null) ?? null
    if (lat === null || lng === null) return defaultResult()

    const matches = await getOwnedHomeMatches(lat, lng, ownerAddress)
    // Ownership is confirmed only on an address match, never on proximity alone.
    const confirmed = matches.filter((m) => m.addressMatched)
    const ownsHome = confirmed.length > 0
    // Prefer a confirmed row that carries facts/photo for the UI summary.
    const best = confirmed.find((m) => m.photoUrl) ?? confirmed.find((m) => m.beds || m.sqft) ?? confirmed[0] ?? null

    return {
      ok: true,
      ownsHome,
      step: decideContactNextStep({ ownsHome }),
      ownedHome: best ? summarize(best) : null,
    }
  } catch (e) {
    return defaultResult(e instanceof Error ? e.message : 'Failed to resolve next step')
  }
}
