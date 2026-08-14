import { describe, expect, it } from 'vitest'
import { assertMattOwnedRecipients, MATT_OWNED_MAILBOX, planOrefMattEmail } from './oref-matt-email'

describe('assertMattOwnedRecipients', () => {
  it('allows Matt’s broker mailbox', () => {
    expect(assertMattOwnedRecipients(['Matt@Ryan-Realty.com'])).toEqual({
      ok: true,
      to: [MATT_OWNED_MAILBOX],
    })
  })

  it('refuses a client recipient', () => {
    const r = assertMattOwnedRecipients(['buyer@example.com'])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/client/i)
  })

  it('refuses a mixed list that includes a client', () => {
    const r = assertMattOwnedRecipients([MATT_OWNED_MAILBOX, 'seller@gmail.com'])
    expect(r.ok).toBe(false)
  })

  it('refuses another broker mailbox on this Matt-only path', () => {
    const r = assertMattOwnedRecipients(['paul@ryan-realty.com'])
    expect(r.ok).toBe(false)
  })
})

describe('planOrefMattEmail', () => {
  it('defaults to Matt when no To is supplied', () => {
    expect(planOrefMattEmail()).toEqual({ ok: true, to: [MATT_OWNED_MAILBOX] })
  })

  it('still refuses a caller-supplied client To', () => {
    const r = planOrefMattEmail(['client@hotmail.com'])
    expect(r.ok).toBe(false)
  })
})
