import { describe, it, expect } from 'vitest'
import { resolveSubmittedIdentity } from './submitted-identity'

describe('resolveSubmittedIdentity', () => {
  it('THE REGRESSION: a different email on a cookied browser never inherits the cookie person', () => {
    // Quinn submitting on the browser where Blake (63425) once filled a form.
    expect(
      resolveSubmittedIdentity({ cookiePersonId: 63425, emailPersonId: null, hasEmail: true }),
    ).toEqual({ personId: null, alreadyKnown: false })
  })

  it('uses the email person when the email is already known', () => {
    expect(
      resolveSubmittedIdentity({ cookiePersonId: 63425, emailPersonId: 999, hasEmail: true }),
    ).toEqual({ personId: 999, alreadyKnown: true })
  })

  it('keeps the cookie when the email resolves to that same person', () => {
    expect(
      resolveSubmittedIdentity({ cookiePersonId: 63425, emailPersonId: 63425, hasEmail: true }),
    ).toEqual({ personId: 63425, alreadyKnown: true })
  })

  it('falls back to the cookie only when no email was submitted', () => {
    expect(
      resolveSubmittedIdentity({ cookiePersonId: 63425, emailPersonId: null, hasEmail: false }),
    ).toEqual({ personId: 63425, alreadyKnown: true })
  })

  it('creates when there is neither an email nor a cookie', () => {
    expect(
      resolveSubmittedIdentity({ cookiePersonId: null, emailPersonId: null, hasEmail: false }),
    ).toEqual({ personId: null, alreadyKnown: false })
  })

  it('creates for a brand-new email with no cookie', () => {
    expect(
      resolveSubmittedIdentity({ cookiePersonId: null, emailPersonId: null, hasEmail: true }),
    ).toEqual({ personId: null, alreadyKnown: false })
  })
})
