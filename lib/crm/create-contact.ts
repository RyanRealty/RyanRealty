/**
 * Quick-add contact: name + phone plus email OR street.
 * Address is a first-class field, never a note.
 * Stage, tags, relationships, notes, and property live on person detail.
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

export function canSubmitCreateContact(input: {
  firstName: string
  email: string
  phone: string
  street: string
}): boolean {
  return Boolean(
    input.firstName.trim() &&
    input.phone.trim() &&
    (input.email.trim() || input.street.trim()),
  )
}

export function validateCreateContact(
  input: CreateContactInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.firstName) return { ok: false, error: 'First name required' }
  if (!input.phone) return { ok: false, error: 'Phone required' }
  if (!input.email && !input.street) {
    return { ok: false, error: 'Add an email, or a street address' }
  }
  return { ok: true }
}

export function createContactAddress(input: CreateContactInput): PersonAddress | null {
  if (!input.street && !input.city && !input.state && !input.zip) return null
  return personAddressFromFields(input)
}
