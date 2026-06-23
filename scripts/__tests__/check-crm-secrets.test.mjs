import { describe, it, expect } from 'vitest'
import {
  referencedSecrets,
  listsEnvVar,
  unlistedSecrets,
  orphanCrons,
} from '../check-crm-secrets.mjs'

describe('check-crm-secrets pure helpers (9.8)', () => {
  describe('referencedSecrets', () => {
    it('extracts CRM signing secrets referenced via process.env', () => {
      const src = `
        const SECRET =
          process.env.EMAIL_TRACKING_SECRET ||
          process.env.CMA_PREVIEW_SECRET ||
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          'insecure-dev-secret'
      `
      expect(referencedSecrets(src)).toEqual(['CMA_PREVIEW_SECRET', 'EMAIL_TRACKING_SECRET'])
    })

    it('matches CRON_SECRET and *_SIGNING_SECRET / *_TRACKING_SECRET shapes', () => {
      const src = `
        process.env.CRON_SECRET
        process.env.WEBHOOK_SIGNING_SECRET
        process.env.PIXEL_TRACKING_SECRET
      `
      expect(referencedSecrets(src)).toEqual([
        'CRON_SECRET',
        'PIXEL_TRACKING_SECRET',
        'WEBHOOK_SIGNING_SECRET',
      ])
    })

    it('ignores non-secret config + public env vars', () => {
      const src = `
        process.env.NEXT_PUBLIC_SITE_URL
        process.env.SPARK_API_KEY
        process.env.SUPABASE_SERVICE_ROLE_KEY
        process.env.RESEND_API_KEY
      `
      expect(referencedSecrets(src)).toEqual([])
    })

    it('de-duplicates a secret referenced twice', () => {
      const src = 'process.env.CRON_SECRET; if (process.env.CRON_SECRET) {}'
      expect(referencedSecrets(src)).toEqual(['CRON_SECRET'])
    })

    it('returns empty for a source with no secret references', () => {
      expect(referencedSecrets('const x = 1')).toEqual([])
    })
  })

  describe('listsEnvVar', () => {
    const envSrc = `
      export const EnvSchema = z.object({
        EMAIL_TRACKING_SECRET: z.string().optional(),
        CRON_SECRET: z.string().optional(),
      })
    `
    it('finds a var declared as an EnvSchema property', () => {
      expect(listsEnvVar(envSrc, 'EMAIL_TRACKING_SECRET')).toBe(true)
      expect(listsEnvVar(envSrc, 'CRON_SECRET')).toBe(true)
    })

    it('returns false for a var not in the schema', () => {
      expect(listsEnvVar(envSrc, 'CMA_PREVIEW_SECRET')).toBe(false)
    })

    it('does not count a bare comment mention as listed', () => {
      const src = '// CMA_PREVIEW_SECRET is used downstream\nFOO: z.string()'
      expect(listsEnvVar(src, 'CMA_PREVIEW_SECRET')).toBe(false)
    })
  })

  describe('unlistedSecrets', () => {
    const envSrc = 'EnvSchema = z.object({ CRON_SECRET: z.string() })'

    it('flags a referenced secret absent from the schema', () => {
      const out = unlistedSecrets(envSrc, {
        'lib/email-tracking.ts': ['EMAIL_TRACKING_SECRET', 'CRON_SECRET'],
      })
      expect(out).toEqual([{ name: 'EMAIL_TRACKING_SECRET', file: 'lib/email-tracking.ts' }])
    })

    it('returns nothing when every referenced secret is listed', () => {
      expect(unlistedSecrets(envSrc, { 'lib/auth/cron-auth.ts': ['CRON_SECRET'] })).toEqual([])
    })

    it('sorts deterministically by name then file', () => {
      const out = unlistedSecrets('', {
        'b.ts': ['ZULU_SIGNING_SECRET'],
        'a.ts': ['ALPHA_SIGNING_SECRET'],
      })
      expect(out.map((u) => u.name)).toEqual(['ALPHA_SIGNING_SECRET', 'ZULU_SIGNING_SECRET'])
    })
  })

  describe('orphanCrons', () => {
    const crmFilter = (d) => /^crm-/.test(d)

    it('flags a CRM cron dir not registered in vercel.json', () => {
      const dirs = ['crm-sequence-engine', 'crm-smart-followups', 'refresh-mvs']
      const registered = ['/api/cron/crm-sequence-engine', '/api/cron/refresh-mvs']
      expect(orphanCrons(dirs, registered, crmFilter)).toEqual(['/api/cron/crm-smart-followups'])
    })

    it('ignores non-CRM cron dirs even when unregistered', () => {
      const dirs = ['market-report', 'sync-full']
      expect(orphanCrons(dirs, [], crmFilter)).toEqual([])
    })

    it('returns empty when every CRM cron is registered', () => {
      const dirs = ['crm-auto-enroll']
      expect(orphanCrons(dirs, ['/api/cron/crm-auto-enroll'], crmFilter)).toEqual([])
    })
  })
})
