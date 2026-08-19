import { describe, expect, it } from 'vitest'
import { adminLoginHref, isSafeAdminReturnPath } from './admin-return-path'

describe('isSafeAdminReturnPath', () => {
  it('accepts admin review and view URLs', () => {
    expect(isSafeAdminReturnPath('/admin/cmas/cma-648-se-douglas')).toBe(true)
    expect(isSafeAdminReturnPath('/admin/cmas/cma-648-se-douglas/view')).toBe(true)
    expect(isSafeAdminReturnPath('/admin')).toBe(true)
  })

  it('accepts the broker CMA PDF path', () => {
    expect(isSafeAdminReturnPath('/api/cma/cma-648-se-douglas/pdf')).toBe(true)
    expect(isSafeAdminReturnPath('/api/cma/cma-648-se-douglas/pdf?download=1')).toBe(true)
  })

  it('rejects open redirects and public CMA drafts', () => {
    expect(isSafeAdminReturnPath('https://evil.com')).toBe(false)
    expect(isSafeAdminReturnPath('//evil.com')).toBe(false)
    expect(isSafeAdminReturnPath('/cma/cma-648-se-douglas')).toBe(false)
    expect(isSafeAdminReturnPath('/api/cma/cma-648-se-douglas/gmail-draft')).toBe(false)
  })
})

describe('adminLoginHref', () => {
  it('preserves the view path through login', () => {
    expect(adminLoginHref('/admin/cmas/cma-648-se-douglas/view')).toBe(
      '/admin/login?next=%2Fadmin%2Fcmas%2Fcma-648-se-douglas%2Fview',
    )
  })
})
