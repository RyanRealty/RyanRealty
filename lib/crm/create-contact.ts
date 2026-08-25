/**
 * Quick-add contact: a name plus at least one way to reach the person —
 * an email address or a phone number.
 * Address is a first-class field, never a note.
 * Stage, tags, relationships, notes, and property live on person detail.
 *
 * Phone was required here until 2026-08-25. That rule made an email-only
 * contact impossible to create in the UI, so every web lead, newsletter
 * signup, and email-test address had to be inserted around the CRM. The
 * book already holds tens of thousands of email-only people; the form now
 * accepts what the data model always allowed.
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
}): boolean {
  return Boolean(input.firstName.trim() && (input.email.trim() || input.phone.trim()))
}

/**
 * What is still missing before the form can submit, phrased for the operator.
 * Null once the form is submittable. The submit button renders this instead of
 * sitting disabled with no explanation.
 */
export function createContactRequirement(input: {
  firstName: string
  email: string
  phone: string
}): string | null {
  if (!input.firstName.trim()) return 'Add a first name'
  if (!input.email.trim() && !input.phone.trim()) return 'Add an email or a phone number'
  return null
}

export function validateCreateContact(
  input: CreateContactInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.firstName) return { ok: false, error: 'First name required' }
  if (!input.email && !input.phone) {
    return { ok: false, error: 'Add an email, or a phone number' }
  }
  return { ok: true }
}

export function createContactAddress(input: CreateContactInput): PersonAddress | null {
  if (!input.street && !input.city && !input.state && !input.zip) return null
  return personAddressFromFields(input)
}
