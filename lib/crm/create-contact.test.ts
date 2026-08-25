import { describe, expect, it } from 'vitest'
import {
  canSubmitCreateContact,
  createContactAddress,
  createContactRequirement,
  parseCreateContactForm,
  validateCreateContact,
} from './create-contact'

function fd(fields: Record<string, string>) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

describe('create-contact quick add', () => {
  it('accepts a name with both an email and a phone', () => {
    const input = parseCreateContactForm(
      fd({ firstName: 'Odessa', email: 'odessa@example.com', phone: '5415550100' }),
    )
    expect(validateCreateContact(input)).toEqual({ ok: true })
    expect(createContactAddress(input)).toBeNull()
  })

  it('keeps a typed address as a structured field, never a note', () => {
    const input = parseCreateContactForm(
      fd({
        firstName: 'Odessa',
        lastName: 'Ryan',
        email: 'odessa@example.com',
        phone: '5415550100',
        street: '123 NW Bond St',
        city: 'Bend',
        state: 'OR',
        zip: '97703',
        note: '123 NW Bond St Bend',
      }),
    )
    expect(input).not.toHaveProperty('note')
    expect(validateCreateContact(input)).toEqual({ ok: true })
    expect(createContactAddress(input)).toEqual({
      street: '123 NW Bond St',
      city: 'Bend',
      state: 'OR',
      zip: '97703',
      country: 'US',
    })
  })

  it('accepts name + phone with no email', () => {
    const input = parseCreateContactForm(
      fd({ firstName: 'Nealon', phone: '5415550101', street: '123 NW Bond St' }),
    )
    expect(validateCreateContact(input)).toEqual({ ok: true })
  })

  it('accepts name + email with no phone', () => {
    const input = parseCreateContactForm(
      fd({ firstName: 'Blake', email: 'marketing+blake@ryan-realty.com' }),
    )
    expect(validateCreateContact(input)).toEqual({ ok: true })
    expect(canSubmitCreateContact(input)).toBe(true)
  })

  it('rejects a contact with no email and no phone', () => {
    const input = parseCreateContactForm(fd({ firstName: 'Odessa', street: '123 NW Bond St' }))
    expect(validateCreateContact(input)).toEqual({
      ok: false,
      error: 'Add an email, or a phone number',
    })
  })

  it('rejects a missing first name', () => {
    const input = parseCreateContactForm(fd({ email: 'odessa@example.com' }))
    expect(validateCreateContact(input)).toEqual({ ok: false, error: 'First name required' })
  })

  it('names the missing field instead of silently disabling submit', () => {
    expect(createContactRequirement({ firstName: '', email: '', phone: '' })).toBe('Add a first name')
    expect(createContactRequirement({ firstName: 'Blake', email: '', phone: '' })).toBe(
      'Add an email or a phone number',
    )
    expect(createContactRequirement({ firstName: 'Blake', email: 'b@x.com', phone: '' })).toBeNull()
  })
})
