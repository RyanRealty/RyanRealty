import { describe, it, expect, afterEach } from 'vitest'
import { resolveFrom } from './resend'

const savedFrom = process.env.RESEND_FROM
const savedVercel = process.env.VERCEL_ENV
afterEach(() => {
  if (savedFrom === undefined) delete process.env.RESEND_FROM
  else process.env.RESEND_FROM = savedFrom
  if (savedVercel === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = savedVercel
})

describe('resolveFrom (9.1 — never sandbox in prod)', () => {
  it('uses an explicit per-send from above all', () => {
    process.env.RESEND_FROM = 'env@x.com'
    expect(resolveFrom('Broker <b@ryan-realty.com>')).toEqual({ from: 'Broker <b@ryan-realty.com>' })
  })
  it('uses RESEND_FROM when no explicit from', () => {
    process.env.RESEND_FROM = 'noreply@mail.ryan-realty.com'
    expect(resolveFrom()).toEqual({ from: 'noreply@mail.ryan-realty.com' })
  })
  it('FAILS in production when RESEND_FROM is unset (refuses the sandbox)', () => {
    delete process.env.RESEND_FROM
    process.env.VERCEL_ENV = 'production'
    const r = resolveFrom()
    expect(r.from).toBeUndefined()
    expect(r.error).toMatch(/RESEND_FROM not set in production/)
  })
  it('allows the sandbox only outside production', () => {
    delete process.env.RESEND_FROM
    delete process.env.VERCEL_ENV
    expect(resolveFrom().from).toContain('onboarding@resend.dev')
  })
})
