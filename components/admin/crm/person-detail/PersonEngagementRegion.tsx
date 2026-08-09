/**
 * Streamed engagement / shopping-signal panels for the person-workspace rail.
 *
 * Uncached per-request reads (no revalidateTag). Isolates viewed/saved homes,
 * behavior, email engagement, newsletter history, and saved-search lists from
 * the critical send + conversation path.
 *
 * 11F: on the LOCKED admin v2 language. PRESENTATION ONLY — same reads, same
 * actions, same strings. The "Liked" marker is a plain token-styled span rather
 * than StateWord: .av2-state uppercases, and this marker sits on a listing card
 * where the surrounding words are sentence case.
 */

import { deleteSavedSearchForm, setReportSubsForm } from '@/app/admin/(protected)/crm/[id]/form-actions'
import { ContactQuickActions } from '@/components/admin/crm/ContactQuickActions'
import ContactBehaviorPanel from '@/components/admin/crm/ContactBehaviorPanel'
import ContactEmailEngagement from '@/components/admin/crm/ContactEmailEngagement'
import { ContactNewsletterHistory } from '@/components/admin/crm/ContactNewsletterHistory'
import ContactDeliveryPanel from '@/components/admin/crm/ContactDeliveryPanel'
import { ContactListingAlertsPanel } from '@/components/admin/crm/ContactListingAlertsPanel'
import ViewedHomeCard from '@/components/admin/crm/ViewedHomeCard'
import { StatusPill } from '@/components/console/StatusPill'
import { Button } from '@/components/admin/v2'
import { getListingAlertsForLead, getViewedListingsForLead } from '@/lib/data'
import { getContactSavedHomes, buildHomesPanelUnion } from '@/lib/data/crm/getContactSavedHomes'
import { getContactBehaviorSummary } from '@/lib/data/crm/getContactBehaviorSummary'
import { getContactEmailEngagement } from '@/lib/data/crm/getContactEmailEngagement'
import { getNewsletterHistoryForPerson } from '@/lib/data/newsletter/perLead'
import { getContactListingAlerts } from '@/lib/data/crm/getContactListingAlerts'
import type { ContactMemberships } from '@/lib/data/crm/getContactMemberships'
import type {
  ContactReportSubscription,
  MarketReportArea,
} from '@/lib/data/crm/getContactReportSubscriptions'
import { describeSearch } from '@/app/admin/(protected)/crm/[id]/person-view-model'

export async function PersonEngagementRegion({
  personId,
  fubLegacyId,
  personEmails,
  primaryEmail,
  contactMemberships,
  reportSub,
  reportAreas,
}: {
  personId: number
  fubLegacyId: number | null
  personEmails: string[]
  primaryEmail: string | null
  contactMemberships: ContactMemberships
  reportSub: ContactReportSubscription | null
  reportAreas: MarketReportArea[]
}) {
  const [
    savedSearches,
    viewedListings,
    savedHomes,
    behaviorSummary,
    emailEngagementSummary,
    newsletterHistory,
    contactAlerts,
  ] = await Promise.all([
    getListingAlertsForLead({ crmPersonId: personId, fubPersonId: fubLegacyId, emails: personEmails }),
    getViewedListingsForLead({ crmPersonId: personId, fubLegacyId, emails: personEmails }),
    getContactSavedHomes({ crmPersonId: personId, fubLegacyId, emails: personEmails }),
    getContactBehaviorSummary(personId),
    getContactEmailEngagement(personId),
    getNewsletterHistoryForPerson({ crmPersonId: personId, emails: personEmails }),
    getContactListingAlerts(personId),
  ])

  const homesPanel = buildHomesPanelUnion(viewedListings, savedHomes)

  return (
    <div data-slot="person-website-activity" className="space-y-3">
      <ContactQuickActions
        personId={personId}
        newsletterSubscribed={contactMemberships.newsletter.subscribed}
        automations={contactMemberships.sequences}
        savedSearches={contactAlerts.map((a) => ({ id: a.id, label: a.label, url: a.url, active: a.active }))}
        reportSub={
          reportSub
            ? { isActive: reportSub.isActive, areas: reportSub.areas, frequency: reportSub.frequency }
            : null
        }
        reportAreas={reportAreas}
        reportSetAction={setReportSubsForm.bind(null, personId)}
      />
      <ContactBehaviorPanel summary={behaviorSummary} />
      {homesPanel.length > 0 ? (
        <div className="space-y-2">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--a-text-2)' }}
          >
            Homes viewed &amp; saved ({homesPanel.length})
          </p>
          {homesPanel.slice(0, 4).map((l) => (
            <div key={l.listingKey} className="relative">
              <ViewedHomeCard home={l} />
              {l.consumerSources?.includes('liked') ? (
                <span
                  className="absolute right-2 top-2 rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: 'var(--a-inset)',
                    color: 'var(--a-text)',
                    border: '1px solid var(--a-border)',
                  }}
                >
                  Liked
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <ContactEmailEngagement engagement={emailEngagementSummary} />
      <ContactNewsletterHistory history={newsletterHistory} />
      <ContactDeliveryPanel personId={personId} email={primaryEmail} />
      <ContactListingAlertsPanel alerts={contactAlerts} />
      <div className="space-y-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--a-text-2)' }}
        >
          Saved searches ({savedSearches.length})
        </p>
        {savedSearches.slice(0, 4).map((s) => {
          const origin = s.origin ?? 'user'
          const originTone = origin === 'broker' ? 'info' : origin === 'system' ? 'warning' : 'neutral'
          return (
            <div
              key={s.id}
              className="rounded-lg px-2.5 py-2"
              style={{ border: '1px solid var(--a-border)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium" style={{ color: 'var(--a-accent)' }}>
                    {describeSearch(s.filters)}
                  </span>
                  <StatusPill tone={originTone} label={origin} />
                </div>
                <form action={deleteSavedSearchForm}>
                  <input type="hidden" name="personId" value={personId} />
                  <input type="hidden" name="id" value={s.id} />
                  {/* av2-textlink is the barrel's stripped-Button treatment for an
                      inline text action; it keeps this row compact and carries its
                      own hover (underline) plus the quiet button's focus ring. */}
                  <Button variant="quiet" className="av2-textlink" type="submit">
                    Remove
                  </Button>
                </form>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
