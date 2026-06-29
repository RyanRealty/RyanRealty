'use server'

/**
 * Server action backing the global CRM Activity tab's "Load more" pagination.
 * Access-guarded the same way as the rest of the CRM (getCrmAccess). Returns the
 * next page of the cross-contact activity feed for the given filter + cursor.
 */
import { getCrmAccess } from '@/app/actions/crm'
import {
  getGlobalActivityFeed,
  type GlobalActivityFilter,
  type GlobalActivityResult,
} from '@/lib/data/crm/getGlobalActivityFeed'

const FILTERS: GlobalActivityFilter[] = ['all', 'email', 'website', 'new_leads']

export async function loadGlobalActivity(input: {
  filter?: string
  before?: string | null
}): Promise<GlobalActivityResult> {
  const access = await getCrmAccess()
  if (!access) return { items: [], nextCursor: null }
  const filter = (FILTERS as string[]).includes(input.filter ?? '')
    ? (input.filter as GlobalActivityFilter)
    : 'all'
  return getGlobalActivityFeed({ filter, before: input.before ?? null, limit: 50 })
}
