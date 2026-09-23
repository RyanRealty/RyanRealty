/**
 * SiteActivitySection (P7 identity loop, Matt 2026-09-23): "when I go and look
 * at them, I can see exactly what they're looking at."
 *
 * Every visit this contact made in the last 30 days, page by page, across every
 * browser and device the identity loop has stitched to them: the page, the
 * home's current address and list price when it was a listing, the time they
 * spent on it, and how the visit arrived. Plus their personal site link, for the
 * channels we cannot decorate automatically (DMs, Gmail replies, texts from a
 * broker's own phone).
 *
 * Async server component; streams under Suspense. Data: getPersonSiteActivity
 * (lib/data/crm/getSiteActivity.ts). Automation-flagged sessions are excluded.
 */
import { SectionHead } from '@/components/admin/v2'
import { SiteActivityVisits } from '@/app/admin/(protected)/visitors/_components/SiteActivityVisits'
import { PersonalLinkCopy } from './PersonalLinkCopy'
import { getPersonSiteActivity } from '@/lib/data/crm/getSiteActivity'
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'
import { personalSiteLink } from '@/lib/identity/outbound-links'
import { agoLabel } from '@/lib/format/relative-ago'

export async function SiteActivitySection({
  personId,
  personEmails,
  assignedBroker,
}: {
  personId: number
  personEmails: string[]
  assignedBroker: string | null
}) {
  const identity = await resolvePersonIdentity(personId)
  const activity = await getPersonSiteActivity({
    personId,
    fubLegacyId: identity.fubLegacyId,
    emails: personEmails,
    days: 30,
  })
  const link = personalSiteLink(personId, assignedBroker)
  const nowMs = Date.now()

  return (
    <section aria-label="On the site" id="site-activity">
      <SectionHead>On the site</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 10px' }}>
        {activity.pageViews > 0
          ? `${activity.pageViews} ${activity.pageViews === 1 ? 'page' : 'pages'} in ${activity.visits.length} ${
              activity.visits.length === 1 ? 'visit' : 'visits'
            } over the last ${activity.windowDays} days, ${activity.listingViews} of them homes. Last seen ${agoLabel(
              activity.lastSeenAt,
              nowMs,
            )}.`
          : `No visits identified to this contact in the last ${activity.windowDays} days.`}
      </p>
      <SiteActivityVisits visits={activity.visits} listings={activity.listings} maxPages={40} />
      <div style={{ marginTop: 12 }}>
        <PersonalLinkCopy href={link} />
      </div>
    </section>
  )
}
