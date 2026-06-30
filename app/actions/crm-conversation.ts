'use server'

/**
 * Server action backing the Comms-tab "load older messages" pager. Same CRM
 * auth + per-person scope as the rest of the contact 360.
 */
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { getContactConversation, type ContactConversationResult } from '@/lib/data/crm/getContactConversation'

export async function loadContactConversation(
  personId: number,
  before: string | null,
): Promise<ContactConversationResult> {
  const access = await getCrmAccess()
  if (!access) return { items: [], nextCursor: null }
  const scoped = await requirePersonInScope(personId, access)
  if (!scoped.ok) return { items: [], nextCursor: null }
  return getContactConversation(personId, { before, limit: 50 })
}
