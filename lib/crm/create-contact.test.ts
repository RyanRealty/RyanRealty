import { describe, expect, it } from 'vitest'
import { createContactAddress, parseCreateContactForm, validateCreateContact } from './create-contact'

function fd(fields: Record<string, string>) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  return form
}

describe('create-contact quick add', () => {
  it('requires name + email + phone', () => {
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

  it('accepts name + phone + street without email', () => {
    const input = parseCreateContactForm(
      fd({ firstName: 'Nealon', phone: '5415550101', street: '123 NW Bond St' }),
    )
    expect(validateCreateContact(input)).toEqual({ ok: true })
  })

  it('rejects missing email and street', () => {
    const input = parseCreateContactForm(fd({ firstName: 'Odessa', phone: '5415550100' }))
    expect(validateCreateContact(input)).toEqual({ ok: false, error: 'Add an email, or a street address' })
  })

  it('rejects a missing phone', () => {
    const input = parseCreateContactForm(
      fd({ firstName: 'Odessa', email: 'odessa@example.com' }),
    )
    expect(validateCreateContact(input)).toEqual({ ok: false, error: 'Phone required' })
  })
})
