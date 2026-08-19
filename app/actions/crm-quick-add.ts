'use server'

/**
 * Fast People quick-add. Same create as the CRM action, but only
 * revalidates the new person so Save does not wait on the People list.
 */

import { requireCrmAccess, type CrmActionResult } from '@/app/actions/crm'
import {
  createContactAddress,
  parseCreateContactForm,
  validateCreateContact,
} from '@/lib/crm/create-contact'
import { persistCreatedContactAddress, resolveCreatedPersonId } from '@/lib/crm/persist-created-contact'
import { revalidatePerson } from '@/lib/crm/revalidate-person'

export async function createQuickContactAction(
  formData: FormData,
): Promise<CrmActionResult & { personId?: number }> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const input = parseCreateContactForm(formData)
  const valid = validateCreateContact(input)
  if (!valid.ok) return valid
  const address = createContactAddress(input)
  const broker = access.access.brokerSlug ?? 'matt'

  const { sendEvent } = await import('@/lib/crm/send-event')
  const sent = await sendEvent({
    type: 'General Inquiry',
    source: 'Manual entry',
    system: 'RyanRealtyPlatform',
    person: {
      firstName: input.firstName,
      lastName: input.lastName || undefined,
      emails: input.email ? [{ value: input.email }] : undefined,
      phones: input.phone ? [{ value: input.phone }] : undefined,
    },
    brokerAttribution: { brokerSlug: broker },
  })
  if (!sent.ok) return { ok: false, error: `Lead create failed: ${'error' in sent ? sent.error : sent.status}` }

  const personId = await resolveCreatedPersonId({
    sentPersonId: sent.personId ?? undefined,
    email: input.email,
    phone: input.phone,
  })
  if (personId && address) await persistCreatedContactAddress(personId, address)
  if (personId) revalidatePerson(personId)
  return { ok: true, personId }
}
