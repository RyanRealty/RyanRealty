import { describe, it, expect } from 'vitest'
import { isValidCronAuth } from './cron-auth'

// The CRON_SECRET bearer check is an auth-bypass surface (audit p3.2 critical
// path: auth guards). A wrong comparison lets an automation endpoint be called
// unauthenticated. Lock the exact accept/reject contract.
describe('isValidCronAuth', () => {
  it('accepts the exact secret or the Bearer-prefixed form', () => {
    expect(isValidCronAuth('s3cr3t', 's3cr3t')).toBe(true)
    expect(isValidCronAuth('Bearer s3cr3t', 's3cr3t')).toBe(true)
  })
  it('rejects a wrong / partial / differently-cased header', () => {
    expect(isValidCronAuth('nope', 's3cr3t')).toBe(false)
    expect(isValidCronAuth('bearer s3cr3t', 's3cr3t')).toBe(false) // case-sensitive
    expect(isValidCronAuth('Bearer s3cr3t ', 's3cr3t')).toBe(false) // trailing space
    expect(isValidCronAuth('s3cr3t-extra', 's3cr3t')).toBe(false)
  })
  it('NEVER authorizes when the secret is unset/empty (fail closed)', () => {
    expect(isValidCronAuth('anything', undefined)).toBe(false)
    expect(isValidCronAuth('anything', '')).toBe(false)
    expect(isValidCronAuth('Bearer ', '')).toBe(false)
  })
  it('rejects a null/undefined/empty header', () => {
    expect(isValidCronAuth(null, 's3cr3t')).toBe(false)
    expect(isValidCronAuth(undefined, 's3cr3t')).toBe(false)
    expect(isValidCronAuth('', 's3cr3t')).toBe(false)
  })
})
