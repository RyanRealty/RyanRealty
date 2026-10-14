/**
 * Person-page v3 timeline reader. Unions conversation, activity feed, notes,
 * page views, and email engagement through the same merge PersonWorkspace uses
 * when those rows are already on the request.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md: CRM timeline/events, not listings cache.
 */
import { getContactActivityFeed } from '@/lib/data/crm/getContactActivityFeed'
import { getContactConversation } from '@/lib/data/crm/getContactConversation'
import { getContactEmailEngagement } from '@/lib/data/crm/getContactEmailEngagement'
import { getPersonNotes } from '@/lib/data/crm/getPersonNotes'
import { getPersonSiteActivity } from '@/lib/data/crm/getSiteActivity'
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'
import {
  mergePersonTimeline,
  pageViewsFromVisits,
  type PersonTimelineItem,
} from '@/lib/data/crm/person-timeline'

export async function getPersonTimeline(personId: number): Promise<PersonTimelineItem[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []
  const identity = await resolvePersonIdentity(personId)
  const [conversation, feed, notes, emailTracking, site] = await Promise.all([
    getContactConversation(personId, { limit: 50 }),
    getContactActivityFeed(personId, 30),
    getPersonNotes(personId),
    getContactEmailEngagement(personId),
    getPersonSiteActivity({
      personId,
      fubLegacyId: identity.fubLegacyId,
      emails: identity.emails,
      days: 30,
    }),
  ])
  return mergePersonTimeline({
    conversation: conversation.items,
    feed,
    notes,
    pageViews: pageViewsFromVisits(site.visits),
    emailSends: emailTracking.sends,
  })
}
