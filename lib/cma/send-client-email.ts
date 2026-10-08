/**
 * The send rail reads cmas.client_email. The review page can show the linked
 * CRM person's primary email while that column is still blank. Fill the column
 * from the person before refusing the send. This is a fill, not an eligibility
 * gate. Inbound seller and lead-form CMAs use the same column.
 */
import { updateCmaRowFieldsBySlug } from '@/lib/data'
import { getPersonForCmaKickoff } from '@/lib/data/crm/cmaKickoff'
import { hasSendableEmail } from '@/lib/data/prospecting/types'

export async function resolveSendableClientEmail(opts: {
  slug: string
  columnEmail: string | null | undefined
  personId: number | string | null | undefined
}): Promise<string | null> {
  const column = (opts.columnEmail ?? '').trim().toLowerCase()
  if (hasSendableEmail(column)) return column
  const personId = typeof opts.personId === 'number' ? opts.personId : Number(opts.personId)
  if (!Number.isFinite(personId) || personId <= 0) return null
  const person = await getPersonForCmaKickoff(personId)
  const email = (person?.primaryEmail ?? '').trim().toLowerCase()
  if (!hasSendableEmail(email)) return null
  await updateCmaRowFieldsBySlug(opts.slug, { client_email: email })
  return email
}
