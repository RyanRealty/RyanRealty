import { describe, expect, it } from 'vitest'
import { cmaComposeRowMatchesPerson } from './compose-target'

describe('cmaComposeRowMatchesPerson', () => {
  it('matches the 648 CMA on person_id 63285', () => {
    expect(
      cmaComposeRowMatchesPerson({
        rowPersonId: 63285,
        clientEmail: 'odessa@example.com',
        personId: 63285,
        personEmails: ['odessa@example.com'],
      }),
    ).toBe(true)
  })

  it('falls back to household email when person_id is missing', () => {
    expect(
      cmaComposeRowMatchesPerson({
        rowPersonId: null,
        clientEmail: 'jane@example.com',
        personId: 63290,
        personEmails: ['JANE@example.com'],
      }),
    ).toBe(true)
  })

  it('rejects a CMA that belongs to someone else', () => {
    expect(
      cmaComposeRowMatchesPerson({
        rowPersonId: 1,
        clientEmail: 'other@example.com',
        personId: 63285,
        personEmails: ['odessa@example.com'],
      }),
    ).toBe(false)
  })
})
