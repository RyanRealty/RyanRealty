/**
 * Quick-add contact: name + email + phone.
 * Address is an optional first-class field on the same screen, never a note.
 * Stage, tags, relationships, long notes, assignment extras, and property
 * live on person detail after create.
 */

import { personAddressFromFields, type PersonAddress } from '@/lib/crm/person-address'

export type CreateContactInput = {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  city: string
  state: string
  zip: string
}

export function parseCreateContactForm(formData: FormData): CreateContactInput {
  return {
    firstName: String(formData.get('firstName') ?? '').trim(),
    lastName: String(formData.get('lastName') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    phone: String(formData.get('phone') ?? '').trim(),
    street: String(formData.get('street') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    state: String(formData.get('state') ?? '').trim(),
    zip: String(formData.get('zip') ?? '').trim(),
  }
}

export function validateCreateContact(
  input: CreateContactInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.firstName) return { ok: false, error: 'First name required' }
  if (!input.email) return { ok: false, error: 'Email required' }
  if (!input.phone) return { ok: false, error: 'Phone required' }
  return { ok: true }
}

export function createContactAddress(input: CreateContactInput): PersonAddress | null {
  if (!input.street && !input.city && !input.state && !input.zip) return null
  return personAddressFromFields(input)
}
