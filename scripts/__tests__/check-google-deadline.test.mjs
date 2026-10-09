import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { audit, checkHelper, listFiles, scanSource } from '../check-google-deadline.mjs'

/**
 * Break-tests for ci:google-deadline (scripts/check-google-deadline.mjs, G82).
 * Every rule must be able to fail, and the safe shapes must stay green: a
 * comment or a string naming a JWT, a `{ version }` object in a file that never
 * loads googleapis. The last case runs the gate on the live tree, so a missed
 * client fails `npm run test:unit` even off this gate's lane.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const violations = (src, rel = 'lib/x.ts') => scanSource(rel, src).violations

describe('R1: every JWT is built through withAuthDeadline', () => {
  it('flags a bare JWT, in each constructor shape', () => {
    expect(violations(`import { google } from 'googleapis'\nconst a = new google.auth.JWT({ email, key })`)).toEqual([
      expect.stringContaining('lib/x.ts:2 R1'),
    ])
    expect(violations(`import { auth } from 'googleapis/build/src/apis/searchconsole'\nnew auth.JWT({ email })`)).toHaveLength(1)
    expect(violations(`import { JWT } from 'google-auth-library'\nnew JWT(opts)`)).toHaveLength(1)
  })

  it('flags transporterOptions written by hand: the helper is the one way', () => {
    const src = `import { google } from 'googleapis'\nnew google.auth.JWT({ email, transporterOptions: { timeout: 10_000 } })`
    expect(violations(src)).toHaveLength(1)
  })

  it('passes a JWT built through the helper', () => {
    const src = `import { google } from 'googleapis'\nimport { withAuthDeadline } from '@/lib/google-deadline'\nnew google.auth.JWT(withAuthDeadline({ email, key }))`
    expect(violations(src)).toEqual([])
    expect(scanSource('lib/x.ts', src).jwts).toBe(1)
  })

  it('is not tripped by a comment or a string', () => {
    expect(violations(`// new google.auth.JWT({ email })\nconst s = 'new google.auth.JWT({})'`)).toEqual([])
  })
})

describe('R2: every googleapis client sets a timeout', () => {
  it('flags a client with no timeout, static or dynamic import, barrel or single API', () => {
    expect(violations(`import { google } from 'googleapis'\ngoogle.gmail({ version: 'v1', auth })`)).toEqual([
      expect.stringContaining('lib/x.ts:2 R2'),
    ])
    expect(violations(`import { searchconsole } from 'googleapis/build/src/apis/searchconsole'\nsearchconsole({ version: 'v1', auth: jwt })`)).toHaveLength(1)
    expect(violations(`async function f() { const { google } = await import('googleapis'); return google.admin({ version: 'directory_v1', auth }) }`)).toHaveLength(1)
  })

  it('passes a client with a timeout', () => {
    const src = `import { google } from 'googleapis'\ngoogle.calendar({ version: 'v3', auth, timeout: 8_000 })`
    expect(violations(src)).toEqual([])
    expect(scanSource('lib/x.ts', src).clients).toBe(1)
  })

  it('ignores a { version } object in a file that never loads googleapis', () => {
    expect(violations(`save({ version: 3, rows })`)).toEqual([])
  })
})

describe('R3: the helper holds, and the scan is not empty', () => {
  it('flags a missing helper, a missing export, or a helper that dropped the timeout', () => {
    expect(checkHelper(null)).toHaveLength(1)
    expect(checkHelper('export const GOOGLE_AUTH_TIMEOUT_MS = 10_000')).toHaveLength(2)
    expect(checkHelper('export function withAuthDeadline(o) { return { ...o } }')).toEqual([
      expect.stringContaining('no longer sets transporterOptions'),
    ])
  })

  it('flags an audit that found nothing to check', () => {
    const { violations: v } = audit(REPO, ['lib/google-deadline.ts'])
    expect(v).toEqual([expect.stringContaining('found no JWT'), expect.stringContaining('found no Google API client')])
  })

  it('passes on the live tree, with every JWT and client counted', () => {
    const res = audit(REPO, listFiles(REPO))
    expect(res.violations).toEqual([])
    expect(res.jwts).toBeGreaterThanOrEqual(9)
    expect(res.clients).toBeGreaterThanOrEqual(13)
  })
})
