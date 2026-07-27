/**
 * Streamed mobile Homes tab — viewed + saved union for this person only.
 * Uncached request-scoped reads (force-dynamic parent; no shared cache tags).
 */

import { MobileHomesTab } from '@/components/admin/crm/mobile/MobileHomesTab'
import { getViewedListingsForLead } from '@/lib/data'
import { getContactSavedHomes, buildHomesPanelUnion } from '@/lib/data/crm/getContactSavedHomes'

export async function PersonMobileHomesRegion({
  personId,
  fubLegacyId,
  personEmails,
}: {
  personId: number
  fubLegacyId: number | null
  personEmails: string[]
}) {
  const [viewedListings, savedHomes] = await Promise.all([
    getViewedListingsForLead({ crmPersonId: personId, fubLegacyId, emails: personEmails }),
    getContactSavedHomes({ crmPersonId: personId, fubLegacyId, emails: personEmails }),
  ])
  const homesPanel = buildHomesPanelUnion(viewedListings, savedHomes)
  return <MobileHomesTab listings={homesPanel} />
}
