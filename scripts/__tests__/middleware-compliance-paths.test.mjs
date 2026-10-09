import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * The A2P 10DLC message flow (scripts/crm-a2p-resubmit.mjs) tells carrier
 * reviewers to verify the SMS consent checkbox on CTA_URLS. Their tooling often
 * sends an HTTP-library User-Agent, which middleware's bot screen 403s unless
 * the path is in COMPLIANCE_VERIFICATION_PATHS (Twilio 30909, twice on
 * 2026-06-11). The two lists drifted: after the /lp pages 308'd on 2026-09-06
 * the bypass still named them and missed /sell, /sell/expired-listings and
 * /homes-for-sale. Read as text: the script reads .env.local on import.
 */
const middleware = readFileSync('middleware.ts', 'utf8')
const resubmit = readFileSync('scripts/crm-a2p-resubmit.mjs', 'utf8')

const quoted = (block) => [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])
const bypass = quoted(middleware.match(/const COMPLIANCE_VERIFICATION_PATHS = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '')
const ctaPaths = quoted(resubmit.match(/const CTA_URLS = \[([\s\S]*?)\];/)?.[1] ?? '').map((u) => new URL(u).pathname)
const LINKED_POLICIES = ['/privacy', '/terms']

describe('compliance bypass covers every page the A2P filing cites', () => {
  it('both lists parse', () => {
    expect(ctaPaths.length).toBeGreaterThan(0)
    expect(bypass.length).toBeGreaterThan(0)
  })

  it('every CTA_URLS page is reachable by reviewer tooling', () => {
    expect(ctaPaths.filter((p) => !bypass.includes(p))).toEqual([])
  })

  it('the bypass holds only filed pages: the CTA pages plus the linked privacy and terms', () => {
    expect(bypass.filter((p) => !ctaPaths.includes(p) && !LINKED_POLICIES.includes(p))).toEqual([])
    for (const p of LINKED_POLICIES) expect(resubmit).toContain(`https://ryan-realty.com${p}`)
  })
})
