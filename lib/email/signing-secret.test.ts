import { afterEach, describe, it, expect, vi } from 'vitest'
import { emailSigningSecret, INSECURE_DEV_SECRET, MissingSigningSecretError } from './signing-secret'
import { signUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token'

function clearSecrets() {
  vi.stubEnv('EMAIL_TRACKING_SECRET', '')
  vi.stubEnv('CMA_PREVIEW_SECRET', '')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('emailSigningSecret (fix s: no forgeable tokens in production)', () => {
  it('uses the first configured secret in the chain', () => {
    clearSecrets()
    vi.stubEnv('CMA_PREVIEW_SECRET', 'cma-secret')
    expect(emailSigningSecret('t')).toBe('cma-secret')
    vi.stubEnv('EMAIL_TRACKING_SECRET', 'tracking-secret')
    expect(emailSigningSecret('t')).toBe('tracking-secret')
  })

  it('falls back to the development string outside production', () => {
    clearSecrets()
    vi.stubEnv('NODE_ENV', 'development')
    expect(emailSigningSecret('t')).toBe(INSECURE_DEV_SECRET)
  })

  it('refuses in production when only the public string is left', () => {
    clearSecrets()
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => emailSigningSecret('unsubscribe-token')).toThrow(MissingSigningSecretError)
  })

  it('the unsubscribe token refuses to sign or verify in production without a real secret', () => {
    clearSecrets()
    vi.stubEnv('NODE_ENV', 'development')
    const devToken = signUnsubscribeToken(7)
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => signUnsubscribeToken(7)).toThrow(MissingSigningSecretError)
    expect(() => verifyUnsubscribeToken(devToken)).toThrow(MissingSigningSecretError)
  })

  it('resolves per call, so a secret set later is used', () => {
    clearSecrets()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('EMAIL_TRACKING_SECRET', 'late-secret')
    const token = signUnsubscribeToken(9)
    expect(verifyUnsubscribeToken(token)).toEqual({ personId: 9, channel: 'email' })
  })
})
