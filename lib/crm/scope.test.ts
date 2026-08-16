import { describe, it, expect } from 'vitest'
import { scopeBroker, isPersonInScope, UNMAPPED_OWN_BOOK, type ScopeAccess } from './scope'

describe('scopeBroker (Option A — Matt is owner/superuser)', () => {
  it('owner/superuser → null (unrestricted, sees ALL brokers)', () => {
    // Matt's email maps to the 'matt' slug, but the superuser role wins.
    const matt: ScopeAccess = { role: 'superuser', brokerSlug: 'matt' }
    expect(scopeBroker(matt)).toBeNull()
  })

  it('superuser with no mapped slug → null', () => {
    const owner: ScopeAccess = { role: 'superuser', brokerSlug: null }
    expect(scopeBroker(owner)).toBeNull()
  })

  it('restricted broker → their own slug', () => {
    const rebecca: ScopeAccess = { role: 'broker', brokerSlug: 'rebecca' }
    const paul: ScopeAccess = { role: 'broker', brokerSlug: 'paul' }
    expect(scopeBroker(rebecca)).toBe('rebecca')
    expect(scopeBroker(paul)).toBe('paul')
  })

  it('report_viewer is scoped like any non-superuser (own slug)', () => {
    expect(scopeBroker({ role: 'report_viewer', brokerSlug: 'paul' })).toBe('paul')
  })

  it('unmapped non-superuser fail-closes to UNMAPPED_OWN_BOOK (empty book, never all)', () => {
    expect(scopeBroker({ role: 'broker', brokerSlug: null })).toBe(UNMAPPED_OWN_BOOK)
    expect(scopeBroker({ role: 'broker', brokerSlug: '  ' })).toBe(UNMAPPED_OWN_BOOK)
    expect(scopeBroker({ role: 'report_viewer', brokerSlug: null })).toBe(UNMAPPED_OWN_BOOK)
  })
})

describe('isPersonInScope (the pure ownership decision behind requirePersonInScope)', () => {
  it('slug null (superuser) → always ok, regardless of the contact owner', () => {
    expect(isPersonInScope(null, 'rebecca')).toBe(true)
    expect(isPersonInScope(null, null)).toBe(true)
    expect(isPersonInScope(null, undefined)).toBe(true)
  })

  it('matching slug → ok', () => {
    expect(isPersonInScope('rebecca', 'rebecca')).toBe(true)
  })

  it('mismatched slug → not ok', () => {
    expect(isPersonInScope('rebecca', 'paul')).toBe(false)
    expect(isPersonInScope('paul', 'matt')).toBe(false)
  })

  it('missing/null contact owner under a restricted broker → not ok', () => {
    expect(isPersonInScope('rebecca', null)).toBe(false)
    expect(isPersonInScope('rebecca', undefined)).toBe(false)
  })

  it('unmapped sentinel never owns a contact', () => {
    expect(isPersonInScope(UNMAPPED_OWN_BOOK, 'paul')).toBe(false)
    expect(isPersonInScope(UNMAPPED_OWN_BOOK, UNMAPPED_OWN_BOOK)).toBe(false)
    expect(isPersonInScope(UNMAPPED_OWN_BOOK, null)).toBe(false)
  })
})
