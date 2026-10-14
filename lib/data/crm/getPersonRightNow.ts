/**
 * Person-page v3 right-now strip. Derives last activity, last message, and
 * the next step from the merged timeline plus open tasks.
 */
import { derivePersonRightNow, type PersonRightNow, type PersonRightNowTask } from '@/lib/data/crm/person-right-now'
import { getPersonTimeline } from '@/lib/data/crm/getPersonTimeline'

export async function getPersonRightNow(
  personId: number,
  tasks: PersonRightNowTask[],
  nowLine?: string | null,
): Promise<PersonRightNow> {
  const timeline = await getPersonTimeline(personId)
  return derivePersonRightNow({ timeline, tasks, nowLine })
}
