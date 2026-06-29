'use server'

/**
 * Server action backing the global CRM Activity tab: re-fetches the feed when
 * the user toggles activity types, and pages "Load more". Access-guarded the
 * same way as the rest of the CRM (getCrmAccess).
 */
import { getCrmAccess } from '@/app/actions/crm'
import {
  getGlobalActivityFeed,
  ALL_ACTIVITY_TYPE_KEYS,
  type GlobalActivityResult,
} from '@/lib/data/crm/getGlobalActivityFeed'

const VALID = new Set<string>(ALL_ACTIVITY_TYPE_KEYS)

export async function loadGlobalActivity(input: {
  types?: string[]
  before?: string | null
}): Promise<GlobalActivityResult> {
  const access = await getCrmAccess()
  if (!access) return { items: [], nextCursor: null }
  // Sanitize to known type keys. `types` undefined = all; explicit [] = none.
  const types = Array.isArray(input.types) ? input.types.filter((t) => VALID.has(t)) : ALL_ACTIVITY_TYPE_KEYS
  return getGlobalActivityFeed({ types, before: input.before ?? null, limit: 50 })
}
