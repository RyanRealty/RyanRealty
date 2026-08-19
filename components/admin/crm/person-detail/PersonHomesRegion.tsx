/**
 * Streamed homes + prospect cluster for the person-workspace right rail.
 *
 * Fetches are uncached (route stays force-dynamic for auth). Streaming means
 * the identity/send/conversation shell paints without waiting on MLS media,
 * viewed/saved unions, or prospect-story reads. No cross-person cache tags —
 * every call is keyed on the personId prop for this request only.
 */

import { getContactNextStep } from '@/app/actions/contact-next-step'
import { startBpoForm } from '@/app/admin/(protected)/crm/[id]/form-actions'
import { cmaCrmComposeHref } from '@/lib/cma/crm-compose-href'
import { OwnedHomeCard } from '@/components/admin/crm/OwnedHomeCard'
import { ContactCmaCard } from '@/components/admin/crm/ContactCmaCard'
import { ContactBpoCard } from '@/components/admin/crm/ContactBpoCard'
import { ContactProspectHistoryCard } from '@/components/admin/crm/ContactProspectHistoryCard'
import { getOwnedHomeMatches, type OwnedHomeMatch } from '@/lib/data'
import { getOwnedHomeMedia } from '@/lib/crm/owned-home-media'
import { getContactProspectStory } from '@/lib/data/crm/getContactProspectStory'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import { usd } from '@/app/admin/(protected)/crm/[id]/person-view-model'

export async function PersonHomesRegion({
  personId,
  fubLegacyId,
  homeLat,
  homeLng,
  homeAddress,
  contactCmas,
  contactBpos,
  reviewableCmaId,
}: {
  personId: number
  fubLegacyId: number | null
  homeLat: number | null
  homeLng: number | null
  homeAddress: string | null
  contactCmas: ContactCma[]
  contactBpos: ContactBpo[]
  /** Ready CMA delivery id from identity core; only applied when next step is CMA. */
  reviewableCmaId: string | null
}) {
  const [nextStep, homeMedia, homeMatches, prospectStories] = await Promise.all([
    getContactNextStep(personId),
    homeLat !== null && homeLng !== null ? getOwnedHomeMedia(homeLat, homeLng) : Promise.resolve(null),
    homeLat !== null && homeLng !== null
      ? getOwnedHomeMatches(homeLat, homeLng, homeAddress)
      : Promise.resolve([] as OwnedHomeMatch[]),
    getContactProspectStory({ personId, fubLegacyId }),
  ])

  const confirmedMatches = homeMatches.filter((m) => m.addressMatched)
  const homeMlsPhoto = confirmedMatches.find((m) => m.photoUrl)?.photoUrl ?? null
  const homeActiveListing =
    confirmedMatches.find((m) =>
      ['Active', 'Coming Soon', 'Active Under Contract', 'Pending'].includes(m.status ?? ''),
    ) ?? null
  const homeFacts = confirmedMatches.find((m) => m.beds || m.sqft) ?? null
  const reviewId = nextStep.step.kind === 'cma' ? reviewableCmaId : null

  return (
    <>
      {nextStep.ownsHome && homeAddress ? (
        <OwnedHomeCard
          address={homeAddress}
          photoUrl={homeMlsPhoto ?? homeMedia?.streetViewUrl ?? null}
          factsLine={
            [
              homeFacts?.beds ? `${homeFacts.beds} bed` : null,
              homeFacts?.baths ? `${homeFacts.baths} bath` : null,
              homeFacts?.sqft ? `${Math.round(homeFacts.sqft).toLocaleString('en-US')} sqft` : null,
            ]
              .filter(Boolean)
              .join(' · ') || null
          }
          mapsLink={homeMedia?.googleMapsLink ?? null}
          onMarket={
            homeActiveListing
              ? `${homeActiveListing.status}${usd(homeActiveListing.listPrice) ? ` · ${usd(homeActiveListing.listPrice)}` : ''}`
              : null
          }
          reviewDeliveryId={reviewId}
          buildHref="?intent=cma"
          composeHref={reviewId ? cmaCrmComposeHref({ personId, slug: reviewId, channel: 'email' }) : null}
        />
      ) : null}
      {contactCmas.length > 0 ? (
        <div className={nextStep.ownsHome && homeAddress ? 'mt-2.5' : undefined}>
          <ContactCmaCard personId={personId} cmas={contactCmas} />
        </div>
      ) : null}
      <div className={nextStep.ownsHome && homeAddress ? 'mt-2.5' : undefined}>
        <ContactBpoCard bpos={contactBpos} generateAction={startBpoForm.bind(null, personId)} />
      </div>
      {prospectStories.length > 0 ? (
        <div className="mt-2.5">
          <ContactProspectHistoryCard stories={prospectStories} />
        </div>
      ) : null}
    </>
  )
}
