/**
 * SendSection (P11B B2) — mounts ContactSendCenter, THE deliverable
 * chokepoint (BPO / CMA / market report / newsletter / listing alerts), as-is
 * inside the v2 layout (restyle comes later). Async — streams under Suspense.
 */
import { SectionHead } from '@/components/admin/v2'
import { ContactSendCenter } from '@/components/admin/crm/ContactSendCenter'
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import { getContactMemberships } from '@/lib/data/crm/getContactMemberships'
import {
  getContactReportSubscription,
  listAvailableMarketReportAreas,
} from '@/lib/data/crm/getContactReportSubscriptions'
import { getLatestNewsletterIssue } from '@/lib/data/crm/getLatestNewsletterIssue'
import { sendDeliverableForPerson } from '@/app/actions/send-deliverable'
import { startBpoFromPerson } from '../actions'

export async function SendSection({
  personId,
  emailSuppressed,
  defaultCity,
  cmas,
  bpos,
}: {
  personId: number
  emailSuppressed: boolean
  defaultCity: string | null
  cmas: ContactCma[]
  bpos: ContactBpo[]
}) {
  const [memberships, reportSub, reportAreas, latestNewsletter] = await Promise.all([
    getContactMemberships(personId),
    getContactReportSubscription(personId),
    listAvailableMarketReportAreas(),
    getLatestNewsletterIssue(),
  ])

  return (
    <section aria-label="Send">
      <SectionHead>Send</SectionHead>
      <ContactSendCenter
      triggerClassName="av2-btn av2-btn--quiet av2-btn--touch"
        personId={personId}
        emailSuppressed={emailSuppressed}
        bpos={bpos}
        cmas={cmas}
        reportAreas={reportAreas}
        subscribedAreas={reportSub?.areas ?? []}
        defaultCity={defaultCity}
        cmaBuildHref="?intent=cma"
        bpoGenerateAction={startBpoFromPerson.bind(null, personId)}
        newsletterSubscribed={memberships.newsletter.subscribed}
        latestNewsletter={
          latestNewsletter
            ? {
                subject: latestNewsletter.subject,
                status: latestNewsletter.status,
                sentAt: latestNewsletter.sentAt,
              }
            : null
        }
        newsletterSendAction={sendDeliverableForPerson.bind(null, personId, 'newsletter')}
      />
    </section>
  )
}
